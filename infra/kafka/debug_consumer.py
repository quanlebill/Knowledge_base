import sys
from kafka import KafkaConsumer

KAFKA_BOOTSTRAP = "kafka:9092"
KAFKA_CONFIG = {
    "security_protocol": "SASL_PLAINTEXT",
    "sasl_mechanism": "PLAIN",
    "sasl_plain_username": "release-worker",
    "sasl_plain_password": "ReleaseWorker@1234",
}

try:
    consumer = KafkaConsumer(
        "release.pipeline.triggered",
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id="release-worker-group",   # correct group
        auto_offset_reset="earliest",
        consumer_timeout_ms=8000,
        value_deserializer=lambda v: v.decode("utf-8"),
        **KAFKA_CONFIG,
    )
    print("Consumer created OK", flush=True)
    count = 0
    for msg in consumer:
        count += 1
        print(f"MSG partition={msg.partition} offset={msg.offset}: {msg.value[:100]}", flush=True)
        if count >= 3:
            break
    print(f"Total: {count} messages", flush=True)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}", file=sys.stderr, flush=True)
    sys.exit(1)
