import os

# LLM text generation (enhance / canonicalize) — direct to llama server, no LiteLLM.
LLAMA_BASE_URL = os.getenv("LLAMA_BASE_URL", "http://llama:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3")

# Embedding and reranking go to the dedicated model-service (no LiteLLM).
MODEL_SERVICE_URL = os.getenv("MODEL_SERVICE_URL", "http://model-service:8001")

# Databases
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")
NEO4J_URL = os.getenv("NEO4J_URL", "bolt://neo4j:7687")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "knowledge")
QDRANT_CACHE_COLLECTION = os.getenv("QDRANT_CACHE_COLLECTION", "query_cache")
CACHE_THRESHOLD = float(os.getenv("CACHE_THRESHOLD", "0.92"))

# Pipeline tuning
QDRANT_PASS1_LIMIT = int(os.getenv("QDRANT_PASS1_LIMIT", "3"))
QDRANT_PASS2_LIMIT = int(os.getenv("QDRANT_PASS2_LIMIT", "2"))
NEO4J_MAX_HOPS = int(os.getenv("NEO4J_MAX_HOPS", "1"))
NEO4J_MAX_NEIGHBOURS = int(os.getenv("NEO4J_MAX_NEIGHBOURS", "5"))
# Max entities (from ranked pass1 results) used as graph expansion starting points
NEO4J_TOP_ENTITIES = int(os.getenv("NEO4J_TOP_ENTITIES", "3"))
RRF_TOP_N = int(os.getenv("RRF_TOP_N", "10"))
RERANK_TOP_N = int(os.getenv("RERANK_TOP_N", "5"))
