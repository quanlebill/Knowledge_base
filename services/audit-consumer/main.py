"""
Kafka Audit Consumer → PostgreSQL

Reads from the audit.auth.events Kafka topic (published by audit-bridge)
and inserts rows into the audit_logs partitioned table.

Delivery: at-least-once. Offset committed after successful PostgreSQL COMMIT.
"""
import json
import logging
import os
import time

import psycopg2
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [audit-consumer] %(levelname)s %(message)s",
)
log = logging.getLogger("audit-consumer")


def _safe_json(raw: bytes):
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None

KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
KAFKA_SASL_USER = os.environ.get("KAFKA_SASL_USERNAME", "")
KAFKA_SASL_PASS = os.environ.get("KAFKA_SASL_PASSWORD", "")
TOPIC = os.environ.get("KAFKA_TOPIC", "audit.auth.events")
GROUP_ID = os.environ.get("KAFKA_GROUP_ID", "audit-consumer-group")
DB_HOST = os.environ.get("DB_HOST", "postgres")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "aeroflow")
DB_USER = os.environ.get("DB_USER", "aeroflow")
DB_PASS = os.environ.get("DB_PASSWORD", "aeroflow_secret")


def wait_for_postgres(retries: int = 20, delay: int = 5) -> psycopg2.extensions.connection:
    for attempt in range(1, retries + 1):
        try:
            conn = psycopg2.connect(
                host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS
            )
            conn.autocommit = False
            log.info("PostgreSQL connected")
            return conn
        except psycopg2.OperationalError:
            log.warning("PostgreSQL not ready, attempt %d/%d, retry in %ds", attempt, retries, delay)
            time.sleep(delay)
    raise RuntimeError("PostgreSQL unavailable after retries")


def wait_for_kafka(bootstrap: str, retries: int = 30, delay: int = 5) -> KafkaConsumer:
    for attempt in range(1, retries + 1):
        try:
            kwargs: dict = dict(
                bootstrap_servers=bootstrap,
                group_id=GROUP_ID,
                auto_offset_reset="earliest",
                enable_auto_commit=False,
                value_deserializer=lambda v: _safe_json(v),
                consumer_timeout_ms=1000,
            )
            if KAFKA_SASL_USER:
                kwargs.update(
                    security_protocol="SASL_PLAINTEXT",
                    sasl_mechanism="PLAIN",
                    sasl_plain_username=KAFKA_SASL_USER,
                    sasl_plain_password=KAFKA_SASL_PASS,
                )
            consumer = KafkaConsumer(TOPIC, **kwargs)
            log.info("Kafka consumer ready, subscribed to %s", TOPIC)
            return consumer
        except NoBrokersAvailable:
            log.warning("Kafka not ready, attempt %d/%d, retry in %ds", attempt, retries, delay)
            time.sleep(delay)
    raise RuntimeError("Kafka unavailable after retries")


def insert_event(cur, event: dict) -> None:
    event_type = event.get("type", "UNKNOWN")
    user_id = event.get("userId") or event.get("details", {}).get("username") or "system"
    ip = event.get("ipAddress") or ""
    client_id = event.get("clientId") or ""
    details = event.get("details") or {}
    status = "FAILED" if "ERROR" in event_type else "SUCCESS"

    cur.execute(
        """
        INSERT INTO audit_logs
          (actor, actor_type, action, resource_type, resource_id, status, metadata, ip_address)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (user_id, "USER", event_type, "AUTH", client_id, status, json.dumps(details), ip),
    )


def main():
    conn = wait_for_postgres()
    consumer = wait_for_kafka(KAFKA_BOOTSTRAP)

    log.info("Consuming from %s ...", TOPIC)
    while True:
        try:
            records = consumer.poll(timeout_ms=2000)
            if not records:
                continue

            for tp, messages in records.items():
                for msg in messages:
                    event = msg.value
                    if not isinstance(event, dict):
                        log.warning("Skipping non-dict message offset=%d", msg.offset)
                        continue
                    try:
                        with conn.cursor() as cur:
                            insert_event(cur, event)
                        conn.commit()
                    except Exception as db_err:
                        conn.rollback()
                        log.error("DB write failed for event %s: %s", event.get("type"), db_err)
                        # reconnect on broken connection
                        try:
                            conn.close()
                        except Exception:
                            pass
                        conn = wait_for_postgres()
                        continue

            consumer.commit()
            log.debug("Committed offsets for %d partitions", len(records))

        except Exception as e:
            log.error("Consumer error: %s", e)
            time.sleep(5)


if __name__ == "__main__":
    main()
