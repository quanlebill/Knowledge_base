#!/usr/bin/env bash
# ─── Kafka ACL Setup ──────────────────────────────────────────────────
# Configures per-topic ACLs so each service can only access what it needs.
# Run AFTER docker compose up (Kafka must be healthy).
#
# Usage:
#   bash infra/kafka/kafka-setup.sh
#
# Idempotent: safe to re-run.

set -uo pipefail

KAFKA_CONTAINER="${KAFKA_CONTAINER:-aeroflow-kafka}"
BOOTSTRAP="localhost:9092"

# Admin credentials (inter-broker user, has full access)
ADMIN_USER="${KAFKA_ADMIN_USER:-admin}"
ADMIN_PASS="${KAFKA_ADMIN_PASSWORD:-KafkaAdmin@1234}"

echo "🔐 Configuring Kafka ACLs..."
echo "   Container : $KAFKA_CONTAINER"
echo "   Bootstrap : $BOOTSTRAP"

# Write admin client properties into the container
docker exec "$KAFKA_CONTAINER" bash -c "
printf 'security.protocol=SASL_PLAINTEXT\nsasl.mechanism=PLAIN\nsasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username=\"${ADMIN_USER}\" password=\"${ADMIN_PASS}\";\n' > /tmp/admin.props
"

run_kafka() {
  docker exec "$KAFKA_CONTAINER" bash -c "$1"
}

# ── 1. Create topics explicitly ────────────────────────────────────────
echo ""
echo "📋 Creating topics..."

run_kafka "/opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server $BOOTSTRAP \
  --command-config /tmp/admin.props \
  --create --if-not-exists \
  --topic __consumer_offsets \
  --partitions 50 \
  --replication-factor 1 \
  --config cleanup.policy=compact" \
  && echo "  → topic: __consumer_offsets (50 partitions, compact)"

run_kafka "/opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server $BOOTSTRAP \
  --command-config /tmp/admin.props \
  --create --if-not-exists \
  --topic audit.auth.events \
  --partitions 3 \
  --replication-factor 1 \
  --config retention.ms=2592000000 \
  --config cleanup.policy=delete" \
  && echo "  → topic: audit.auth.events (3 partitions, 30d retention)"

# ── 2. Enable ACLs (authorizer must be configured) ─────────────────────
echo ""
echo "🛡️  Applying ACLs..."

# audit-bridge: WRITE only to audit.auth.events
run_kafka "/opt/kafka/bin/kafka-acls.sh \
  --bootstrap-server $BOOTSTRAP \
  --command-config /tmp/admin.props \
  --add \
  --allow-principal User:audit-bridge \
  --operation Write \
  --operation Describe \
  --topic audit.auth.events" \
  && echo "  → audit-bridge: Write + Describe on audit.auth.events"

# audit-consumer: READ from audit.auth.events + consumer group access
run_kafka "/opt/kafka/bin/kafka-acls.sh \
  --bootstrap-server $BOOTSTRAP \
  --command-config /tmp/admin.props \
  --add \
  --allow-principal User:audit-consumer \
  --operation Read \
  --operation Describe \
  --topic audit.auth.events" \
  && echo "  → audit-consumer: Read + Describe on audit.auth.events"

run_kafka "/opt/kafka/bin/kafka-acls.sh \
  --bootstrap-server $BOOTSTRAP \
  --command-config /tmp/admin.props \
  --add \
  --allow-principal User:audit-consumer \
  --operation Read \
  --group audit-consumer-group" \
  && echo "  → audit-consumer: Read on group audit-consumer-group"

# ── 3. Show current ACL summary ────────────────────────────────────────
echo ""
echo "📊 Current ACLs:"
run_kafka "/opt/kafka/bin/kafka-acls.sh \
  --bootstrap-server $BOOTSTRAP \
  --command-config /tmp/admin.props \
  --list"

echo ""
echo "✅ Kafka ACL setup complete."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  audit-bridge  → WRITE  audit.auth.events"
echo "  audit-consumer → READ   audit.auth.events (group: audit-consumer-group)"
echo "  admin          → ALL    (inter-broker + management)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
