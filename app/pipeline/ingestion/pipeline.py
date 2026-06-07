"""
IngestionPipeline — stateless orchestrator for the three-tier ingestion flow.
DB clients are injected per-call; no stored service references.

consume_loop() is the Kafka background task entry point used in main.py.
"""
from __future__ import annotations

import logging

from neo4j import AsyncDriver
from qdrant_client.async_qdrant_client import AsyncQdrantClient

from basemodel.services_databaseconnector.postgres_model import Language, SourceType
from services.database_connector.kafka_connector import KafkaConsumerClient, KafkaProducerClient
from services.database_connector.minio_connector import MinIOClient
from services.database_connector.mongo_connector import MongoClient
from services.database_connector.postgres_connector import PostgresClient
from services.docling.docling_service import DoclingClient

from app.pipeline.ingestion import config as cfg
from app.pipeline.ingestion.bronze import upload_to_bronze
from app.pipeline.ingestion.silver import promote_to_silver
from app.pipeline.ingestion.gold import promote_to_gold

log = logging.getLogger(__name__)


class IngestionPipeline:
    """Stateless. All services injected at call-time."""

    async def ingest_bronze(
        self,
        minio: MinIOClient,
        postgres: PostgresClient,
        file_data: bytes,
        filename: str,
        extension: str,
        source_type: SourceType,
        tenant_id: str,
        role_id: str,
        added_by: str,
        abstract: str,
        language: Language,
        doc_metadata,  # MetadataType instance
    ) -> dict:
        return await upload_to_bronze(
            minio=minio,
            postgres=postgres,
            file_data=file_data,
            filename=filename,
            extension=extension,
            source_type=source_type,
            tenant_id=tenant_id,
            role_id=role_id,
            added_by=added_by,
            abstract=abstract,
            language=language,
            doc_metadata=doc_metadata,
        )

    async def promote_silver(
        self,
        minio: MinIOClient,
        postgres: PostgresClient,
        docling: DoclingClient,
        mongo: MongoClient,
        kafka_producer: KafkaProducerClient,
        data_id: str,
        tenant_id: str,
        approved_by: str,
    ) -> dict:
        return await promote_to_silver(
            minio=minio,
            postgres=postgres,
            docling=docling,
            mongo=mongo,
            kafka_producer=kafka_producer,
            data_id=data_id,
            tenant_id=tenant_id,
            approved_by=approved_by,
        )

    async def promote_gold(
        self,
        postgres: PostgresClient,
        qdrant: AsyncQdrantClient,
        neo4j: AsyncDriver,
        mongo: MongoClient,
        data_id: str,
        tenant_id: str,
        approved_by: str,
    ) -> dict:
        return await promote_to_gold(
            postgres=postgres,
            qdrant=qdrant,
            neo4j=neo4j,
            mongo=mongo,
            data_id=data_id,
            tenant_id=tenant_id,
            approved_by=approved_by,
        )


async def consume_loop(
    consumer: KafkaConsumerClient,
    pipeline: IngestionPipeline,
    minio: MinIOClient,
    postgres: PostgresClient,
    mongo: MongoClient,
    docling: DoclingClient,
    kafka_producer: KafkaProducerClient,
    qdrant: AsyncQdrantClient,
    neo4j: AsyncDriver,
) -> None:
    """
    Long-running background task: subscribes to both Silver and Gold Kafka topics,
    dispatches each event to the appropriate pipeline stage.
    """
    async def handler(event: dict) -> None:
        stage = event.get("stage")
        data_id = event.get("data_id")
        tenant_id = event.get("tenant_id")
        approved_by = event.get("approved_by", "system")

        if not data_id or not tenant_id:
            log.warning("Kafka event missing required fields: %s", event)
            return

        try:
            if stage == "silver":
                await pipeline.promote_silver(
                    minio=minio,
                    postgres=postgres,
                    docling=docling,
                    mongo=mongo,
                    kafka_producer=kafka_producer,
                    data_id=data_id,
                    tenant_id=tenant_id,
                    approved_by=approved_by,
                )
            elif stage == "gold":
                await pipeline.promote_gold(
                    postgres=postgres,
                    qdrant=qdrant,
                    neo4j=neo4j,
                    mongo=mongo,
                    data_id=data_id,
                    tenant_id=tenant_id,
                    approved_by=approved_by,
                )
            else:
                log.warning("Unknown stage in Kafka event: %s", stage)
        except Exception as exc:
            log.error("Ingestion consumer error stage=%s data_id=%s: %s", stage, data_id, exc)

    await consumer.start_consuming(
        topics=[cfg.KAFKA_TOPIC_SILVER, cfg.KAFKA_TOPIC_GOLD],
        handler=handler,
    )
