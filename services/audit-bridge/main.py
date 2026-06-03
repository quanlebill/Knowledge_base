"""
Keycloak Auth Event Bridge → Kafka

Polls Keycloak Admin REST API for auth events and publishes them to
the audit.auth.events Kafka topic. The consumer (audit-consumer service)
reads from that topic and writes to the audit_logs PostgreSQL table.

Delivery: at-least-once (Kafka acks=all, manual offset commit).
State: last-seen event timestamp persisted to /tmp/last_event_time.txt.
"""
import os
import json
import logging
import time

import requests
from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [audit-bridge] %(levelname)s %(message)s",
)
log = logging.getLogger("audit-bridge")

KC_BASE = os.environ.get("KEYCLOAK_URL", "http://keycloak-lb:8080")
REALM = os.environ.get("KEYCLOAK_REALM", "aeroflow")
KC_ADMIN = os.environ.get("KEYCLOAK_ADMIN", "admin")
KC_PASS = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "admin")
KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
KAFKA_SASL_USER = os.environ.get("KAFKA_SASL_USERNAME", "")
KAFKA_SASL_PASS = os.environ.get("KAFKA_SASL_PASSWORD", "")
KAFKA_SECURITY_PROTOCOL = os.environ.get("KAFKA_SECURITY_PROTOCOL", "SASL_PLAINTEXT")
KAFKA_SASL_MECHANISM = os.environ.get("KAFKA_SASL_MECHANISM", "PLAIN")
TOPIC = os.environ.get("KAFKA_TOPIC", "audit.auth.events")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "10"))
# Mount /data as a Docker volume so state survives container restarts.
STATE_FILE = os.environ.get("STATE_FILE", "/data/last_event_time.txt")


def wait_for_kafka(bootstrap: str, retries: int = 30, delay: int = 5) -> KafkaProducer:
    for attempt in range(1, retries + 1):
        try:
            kwargs: dict = dict(
                bootstrap_servers=bootstrap,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                acks="all",
                retries=5,
            )
            if KAFKA_SASL_USER:
                kwargs.update(
                    security_protocol=KAFKA_SECURITY_PROTOCOL,
                    sasl_mechanism=KAFKA_SASL_MECHANISM,
                    sasl_plain_username=KAFKA_SASL_USER,
                    sasl_plain_password=KAFKA_SASL_PASS,
                )
            producer = KafkaProducer(**kwargs)
            log.info("Kafka connected")
            return producer
        except NoBrokersAvailable:
            log.warning(f"Kafka not ready, attempt {attempt}/{retries}, retry in {delay}s")
            time.sleep(delay)
    raise RuntimeError("Kafka unavailable after retries")


def get_admin_token() -> str:
    r = requests.post(
        f"{KC_BASE}/realms/master/protocol/openid-connect/token",
        data={
            "client_id": "admin-cli",
            "username": KC_ADMIN,
            "password": KC_PASS,
            "grant_type": "password",
        },
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def load_last_ts() -> int:
    try:
        return int(open(STATE_FILE).read().strip())
    except Exception:
        # Default: 10 minutes ago (milliseconds, Keycloak epoch)
        return (int(time.time()) - 600) * 1000


def save_last_ts(ts: int) -> None:
    with open(STATE_FILE, "w") as f:
        f.write(str(ts))


def poll_events(token: str, since_ms: int) -> list:
    # dateFrom narrows the server-side query so we don't fetch events we'll filter out anyway.
    # Keycloak expects a date string; subtract 1 minute to avoid dropping events at boundary.
    from datetime import datetime, timezone, timedelta
    date_from = datetime.fromtimestamp(
        max(0, since_ms / 1000 - 60), tz=timezone.utc
    ).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    r = requests.get(
        f"{KC_BASE}/admin/realms/{REALM}/events",
        headers={"Authorization": f"Bearer {token}"},
        params={"first": 0, "max": 200, "dateFrom": date_from},
        timeout=10,
    )
    r.raise_for_status()
    return [e for e in r.json() if e.get("time", 0) > since_ms]


def main():
    producer = wait_for_kafka(KAFKA_BOOTSTRAP)

    while True:
        try:
            token = get_admin_token()
            last_ts = load_last_ts()
            new_events = poll_events(token, last_ts)

            if new_events:
                for event in sorted(new_events, key=lambda e: e.get("time", 0)):
                    # Partition by userId for ordered per-user delivery; use event id when
                    # available so the consumer can deduplicate on source_event_id.
                    msg_key = (event.get("id") or event.get("userId") or "")
                    producer.send(TOPIC, key=msg_key.encode("utf-8"), value=event)
                    log.info(
                        "published type=%-30s user=%s",
                        event.get("type", "?"),
                        event.get("userId", "anonymous"),
                    )
                producer.flush()
                max_ts = max(e.get("time", 0) for e in new_events)
                save_last_ts(max_ts)
                log.info("Flushed %d events to %s", len(new_events), TOPIC)

        except requests.HTTPError as e:
            log.error("Keycloak API error: %s", e)
        except Exception as e:
            log.error("Bridge error: %s", e)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
