import os

POSTGRES_URL      = os.getenv("POSTGRES_URL",      "postgresql+asyncpg://aeroflow:aeroflow_secret@postgres/aeroflow_kb")
MONGO_URL         = os.getenv("MONGO_URL",         "mongodb://mongo:27017/dataagent")
MINIO_URL         = os.getenv("MINIO_URL",         "http://minioadmin:minioadmin@minio:9000")
KAFKA_URL         = os.getenv("KAFKA_URL",         "kafka:9092")
QDRANT_URL        = os.getenv("QDRANT_URL",        "http://qdrant:6333")
NEO4J_URI         = os.getenv("NEO4J_URI",         "bolt://neo4j:7687")
MODEL_SERVICE_URL = os.getenv("MODEL_SERVICE_URL", "http://model-service:8001")
LITELLM_BASE_URL  = os.getenv("LITELLM_BASE_URL",  "http://litellm:4000")
LLAMA_BASE_URL    = os.getenv("LLAMA_BASE_URL",    "http://llama:11434")

KAFKA_CONSUMER_GROUP = os.getenv("KAFKA_CONSUMER_GROUP", "kb-ingestion")
KAFKA_TOPIC_SILVER   = os.getenv("KAFKA_TOPIC_SILVER",   "kb.promote.silver")
KAFKA_TOPIC_GOLD     = os.getenv("KAFKA_TOPIC_GOLD",     "kb.promote.gold")

MINIO_BUCKET      = os.getenv("MINIO_BUCKET",      "knowledge-base")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "knowledge")
CONFLICT_SIMILARITY_THRESHOLD = float(os.getenv("CONFLICT_SIMILARITY_THRESHOLD", "0.92"))

# Entity registry
ENTITY_COLLECTION             = os.getenv("ENTITY_COLLECTION",              "entity_registry")
ENTITY_SIMILARITY_THRESHOLD   = float(os.getenv("ENTITY_SIMILARITY_THRESHOLD",   "0.88"))
ENTITY_SOFT_THRESHOLD         = float(os.getenv("ENTITY_SOFT_THRESHOLD",          "0.72"))
ENTITY_WORD_OVERLAP_THRESHOLD = float(os.getenv("ENTITY_WORD_OVERLAP_THRESHOLD",  "0.50"))

LLM_MODEL          = os.getenv("LLM_MODEL",          "llama3")
VLM_MODEL          = os.getenv("VLM_MODEL",           "qwen2.5-vl")
VLM_FRAME_INTERVAL = int(os.getenv("VLM_FRAME_INTERVAL", "30"))
USE_VLM            = os.getenv("USE_VLM", "false").lower() == "true"
