import os

# All LLM calls (text_completion + embedding + rerank) route through LiteLLM.
LITELLM_BASE_URL = os.getenv("LITELLM_BASE_URL", "http://litellm:4000")

# Model names as registered in infra/litellm/config.yaml
LLM_MODEL = os.getenv("LLM_MODEL", "llama3")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "embedder")
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "reranker")

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
RRF_TOP_N = int(os.getenv("RRF_TOP_N", "10"))
RERANK_TOP_N = int(os.getenv("RERANK_TOP_N", "5"))
