"""
Kafka consume loop — handles silver and gold ingestion stages.
All imports are local (worker dir) or shared libraries (services/, basemodel/).
No imports from app/.
"""
from __future__ import annotations

import logging

from services.database_connector.kafka_connector import KafkaConsumerClient, KafkaProducerClient
from services.database_connector.minio_connector import MinIOClient
from services.database_connector.model_connector import ModelServiceClient
from services.database_connector.mongo_connector import MongoClient
from services.database_connector.postgres_connector import PostgresClient
from services.database_connector.qdrant_connector import QdrantClient as QdrantService
from services.database_connector.neo4j_connector import Neo4jClient

import config as cfg
from silver import promote_to_silver
from gold import promote_to_gold
from docling_parser import InlineDoclingParser
from log_writer import write_log
from pipeline_events import PipelineEventEmitter

log = logging.getLogger(__name__)


async def consume_loop(
    consumer: KafkaConsumerClient,
    kafka_producer: KafkaProducerClient,
    minio: MinIOClient,
    postgres: PostgresClient,
    mongo: MongoClient,
    qdrant_svc: QdrantService,
    neo4j_svc: Neo4jClient,
    model: ModelServiceClient,
    docling_parser: InlineDoclingParser,
) -> None:
    db = mongo.get_client()

    async def handler(event: dict) -> None:
        stage       = event.get("event", "")
        data_id     = event.get("data_id", "")
        tenant_id   = event.get("tenant_id", "")
        approved_by = event.get("approved_by", "system")

        if not data_id or not tenant_id:
            log.warning("Worker: Kafka event missing required fields: %s", event)
            return

        if stage == "promote_silver":
            await write_log(db, data_id, "RUNNING", "Silver stage started")
            emitter = await PipelineEventEmitter.create(db, data_id)
            try:
                await write_log(db, data_id, "CHUNKING", "Parsing document with Docling")
                result = await promote_to_silver(
                    minio=minio,
                    postgres=postgres,
                    docling=docling_parser,
                    mongo=mongo,
                    kafka_producer=kafka_producer,
                    data_id=data_id,
                    tenant_id=tenant_id,
                    approved_by=approved_by,
                    emitter=emitter,
                )
                await write_log(
                    db, data_id, "EMBEDDING",
                    f"Silver complete — {result['chunks_count']} chunks accepted, queued for gold",
                )
            except Exception as exc:
                log.error("Worker: Silver failed data_id=%s: %s", data_id, exc)
                await write_log(db, data_id, "FAILED", f"Silver stage failed: {exc}", level="ERROR")
                try:
                    await emitter.emit("pipeline.error", {"stage": "silver", "error": str(exc)[:300]})
                except Exception:
                    pass

        elif stage == "promote_gold":
            await write_log(db, data_id, "GRAPH_EXTRACTING", "Gold stage started — extracting entities")
            emitter = await PipelineEventEmitter.create(db, data_id)
            try:
                result = await promote_to_gold(
                    postgres=postgres,
                    qdrant=qdrant_svc.get_client(),
                    neo4j=neo4j_svc.get_client(),
                    mongo=mongo,
                    model=model,
                    data_id=data_id,
                    tenant_id=tenant_id,
                    approved_by=approved_by,
                    emitter=emitter,
                )
                msg = (
                    f"Gold complete — {result['committed']} blocks committed, "
                    f"{result['conflicted']} conflicts detected"
                )
                await write_log(db, data_id, "PUBLISHED", msg)
            except Exception as exc:
                log.error("Worker: Gold failed data_id=%s: %s", data_id, exc)
                await write_log(db, data_id, "FAILED", f"Gold stage failed: {exc}", level="ERROR")
                try:
                    await emitter.emit("pipeline.error", {"stage": "gold", "error": str(exc)[:300]})
                except Exception:
                    pass

        else:
            log.warning("Worker: unknown event type %r", stage)

    await consumer.start_consuming(
        topics=[cfg.KAFKA_TOPIC_SILVER, cfg.KAFKA_TOPIC_GOLD],
        handler=handler,
    )
