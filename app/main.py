import asyncio
import logging
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from basemodel.services_databaseconnector.postgres_orm.base import Base
import basemodel.services_databaseconnector.postgres_orm  # noqa: F401 — registers ORM models

from basemodel.services_databaseconnector.shared_model import RetryConfig, HealthCheckLoopConfig
from services.database_connector.postgres_connector import PostgresClient
from services.database_connector.qdrant_connector import QdrantClient as QdrantService
from services.database_connector.neo4j_connector import Neo4jClient
from services.database_connector.mongo_connector import MongoClient
from services.database_connector.minio_connector import MinIOClient
from services.database_connector.kafka_connector import KafkaProducerClient, KafkaConsumerClient
from services.docling.docling_service import DoclingClient

from app.pipeline.light_rag.pipeline import LightRAGPipeline
from app.pipeline.light_rag.pipeline import SYSTEM_PROMPTS as _LR_SYSTEM_PROMPTS
from app.pipeline.light_rag import config as cfg
from app.pipeline.ingestion.pipeline import IngestionPipeline, consume_loop
from app.pipeline.ingestion import config as cfg_ingestion
from app.pipeline.ingestion.gold import SYSTEM_PROMPTS as _GOLD_SYSTEM_PROMPTS
from app.pipeline.ingestion.silver import SYSTEM_PROMPTS as _SILVER_SYSTEM_PROMPTS

log = logging.getLogger(__name__)

_LLAMA_BASE_URL = os.environ.get("LLAMA_BASE_URL", "http://llama:11434")

_ALL_SYSTEM_PROMPTS: dict[str, str] = {
    **_GOLD_SYSTEM_PROMPTS,
    **_SILVER_SYSTEM_PROMPTS,
    **_LR_SYSTEM_PROMPTS,
}


async def _register_system_prompts() -> None:
    """POST each system prompt to the llama server's /api/system endpoint.
    Pre-computes KV cache snapshots so each generation call only tokenizes user content.
    Best-effort — failures are logged but don't block startup."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        for name, prompt in _ALL_SYSTEM_PROMPTS.items():
            try:
                resp = await client.post(
                    f"{_LLAMA_BASE_URL}/api/system",
                    json={"name": name, "prompt": prompt},
                )
                resp.raise_for_status()
                log.info("startup: registered system type %r on llama server", name)
            except Exception as exc:
                log.warning("startup: failed to register system type %r: %s", name, exc)

_POSTGRES_URL  = os.environ.get("POSTGRES_URL",  "postgresql+asyncpg://aeroflow:aeroflow_secret@postgres/aeroflow_kb")
_MONGO_URL     = os.environ.get("MONGO_URL",     "mongodb://mongo:27017/dataagent")
_MINIO_URL     = os.environ.get("MINIO_URL",     "http://minioadmin:minioadmin@minio:9000")
_KAFKA_URL     = os.environ.get("KAFKA_URL",     "kafka:9092")

# One instance per service — shared for the full process lifetime
_postgres = PostgresClient()
_qdrant   = QdrantService()
_neo4j    = Neo4jClient()
_mongo    = MongoClient()
_minio    = MinIOClient()
_docling  = DoclingClient()

_kafka_producer = KafkaProducerClient()
_kafka_consumer = KafkaConsumerClient()
_kafka_consumer.set_group_id(cfg_ingestion.KAFKA_CONSUMER_GROUP)

# Stateless pipelines — clients injected per request from app.state
_light_rag  = LightRAGPipeline()
_ingestion  = IngestionPipeline()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Postgres bootstrap ────────────────────────────────────────────────────
    admin_url = _POSTGRES_URL.rsplit("/", 1)[0] + "/aeroflow"
    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = 'aeroflow_kb'")
        )
        if not exists:
            await conn.execute(text("CREATE DATABASE aeroflow_kb"))
    await admin_engine.dispose()

    kb_engine = create_async_engine(_POSTGRES_URL)
    async with kb_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await kb_engine.dispose()

    # ── Set URLs ──────────────────────────────────────────────────────────────
    retry = RetryConfig()

    _postgres.set_url(_POSTGRES_URL)
    _qdrant.set_url(cfg.QDRANT_URL)
    _neo4j.set_url(cfg.NEO4J_URL)
    _mongo.set_url(_MONGO_URL)
    _minio.set_url(_MINIO_URL)
    _kafka_producer.set_url(_KAFKA_URL)
    _kafka_consumer.set_url(_KAFKA_URL)

    # ── Open all connections ──────────────────────────────────────────────────
    await _postgres.open(retry)
    await _qdrant.open(retry)
    await _neo4j.open(retry)
    await _mongo.open(retry)
    await _minio.open(retry)
    await _docling.open(retry)
    await _kafka_producer.open(retry)
    await _kafka_consumer.open(retry)

    # ── Register system prompts on llama server (best-effort) ────────────────
    await _register_system_prompts()

    # ── Expose on app.state ───────────────────────────────────────────────────
    app.state.postgres       = _postgres
    app.state.qdrant         = _qdrant
    app.state.neo4j          = _neo4j
    app.state.mongo          = _mongo
    app.state.minio          = _minio
    app.state.docling        = _docling
    app.state.kafka_producer = _kafka_producer
    app.state.kafka_consumer = _kafka_consumer
    app.state.light_rag      = _light_rag
    app.state.ingestion      = _ingestion

    # ── Background: health check loops ────────────────────────────────────────
    hc = HealthCheckLoopConfig()
    hc_tasks = [
        asyncio.create_task(_postgres.health_check_loop(hc),       name="hc-postgres"),
        asyncio.create_task(_qdrant.health_check_loop(hc),         name="hc-qdrant"),
        asyncio.create_task(_neo4j.health_check_loop(hc),          name="hc-neo4j"),
        asyncio.create_task(_mongo.health_check_loop(hc),          name="hc-mongo"),
        asyncio.create_task(_minio.health_check_loop(hc),          name="hc-minio"),
        asyncio.create_task(_kafka_producer.health_check_loop(hc), name="hc-kafka-producer"),
        asyncio.create_task(_kafka_consumer.health_check_loop(hc), name="hc-kafka-consumer"),
    ]

    # ── Background: Kafka ingestion consumer ──────────────────────────────────
    consumer_task = asyncio.create_task(
        consume_loop(
            consumer=_kafka_consumer,
            pipeline=_ingestion,
            minio=_minio,
            postgres=_postgres,
            mongo=_mongo,
            docling=_docling,
            kafka_producer=_kafka_producer,
            qdrant=_qdrant.get_client(),
            neo4j=_neo4j.get_client(),
        ),
        name="kafka-ingestion-consumer",
    )

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    consumer_task.cancel()
    for task in hc_tasks:
        task.cancel()
    await asyncio.gather(consumer_task, *hc_tasks, return_exceptions=True)

    await _postgres.close()
    await _qdrant.close()
    await _neo4j.close()
    await _mongo.close()
    await _minio.close()
    await _docling.close()
    await _kafka_producer.close()
    await _kafka_consumer.close()


app = FastAPI(title="AeroFlow KB API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.router.knowledge import router

app.include_router(router)
