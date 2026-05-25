#!/bin/bash
# Custom launch script: pre-seeds SCRAM-SHA-256 users at storage format time.
# Replaces /opt/kafka/docker/launch in the apache/kafka:3.7.0 image.
set -e

if [ -z "${KAFKA_CLUSTER_ID}" ]; then
  echo "ERROR: KAFKA_CLUSTER_ID is required"
  exit 1
fi

/opt/kafka/bin/kafka-storage.sh format \
    -t "${KAFKA_CLUSTER_ID}" \
    -c /mnt/shared/config/server.properties \
    --add-scram 'SCRAM-SHA-256=[name=admin,iterations=8192,password=KafkaAdmin@1234]' \
    --add-scram 'SCRAM-SHA-256=[name=audit-bridge,iterations=8192,password=AuditBridge@1234]' \
    --add-scram 'SCRAM-SHA-256=[name=audit-consumer,iterations=8192,password=AuditConsumer@1234]' \
    --ignore-formatted

exec /opt/kafka/bin/kafka-server-start.sh /mnt/shared/config/server.properties
