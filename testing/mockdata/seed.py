"""
AeroFlow KB — comprehensive mock data seeder.

Seeds every table in TABLE_REGISTRY plus Qdrant vectors and Neo4j graph nodes,
using the generic db_client functions (pg.create / pg.read / pg.update / pg.delete)
and the Qdrant / Neo4j db_client wrappers.

Run from the project root:
    python testing/mockdata/seed.py
"""

import asyncio
import random
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from services.database_connector.postgres import db_client as pg
from services.database_connector.qdrant  import db_client as qd
from services.database_connector.neo4j   import db_client as neo

# ── Fixed UUIDs (deterministic across runs) ───────────────────────────────────

TENANT_A   = "11111111-1111-1111-1111-111111111111"
TENANT_B   = "22222222-2222-2222-2222-222222222222"
ROLE_ID    = "33333333-3333-3333-3333-333333333333"
ADDED_BY   = "44444444-4444-4444-4444-444444444444"

VECTOR_DIM        = 128
COLLECTION_CHUNKS = "kb_chunks_v1"
COLLECTION_TABLES = "kb_tables_v1"

# ── Helpers ───────────────────────────────────────────────────────────────────

def ok(result, label: str):
    if result.code >= 400:
        print(f"  [x] {label}  ->  {result.error}")
        sys.exit(1)
    print(f"  [+] {label}")
    return result.data or {}


def _vec(seed) -> list[float]:
    rng = random.Random(seed)
    v = [rng.gauss(0, 1) for _ in range(VECTOR_DIM)]
    norm = sum(x ** 2 for x in v) ** 0.5
    return [x / norm for x in v]


# ── Section 1 — Models ────────────────────────────────────────────────────────

async def seed_models() -> dict:
    print("\n[Models]")

    res = ok(await pg.create("KBModel", {
        "model_name": "text-embed-v1",
        "task_type":  "embedding",
    }), "KBModel: text-embed-v1")
    embed_model_id = res["model_id"]

    ok(await pg.create("KBModelVersion", {
        "model_id":       embed_model_id,
        "version_number": 1,
        "is_active":      False,
        "config":         {"vector_size": VECTOR_DIM, "max_tokens": 512},
    }), "KBModelVersion: embed v1 (draft)")

    ok(await pg.create("KBModelVersion", {
        "model_id":       embed_model_id,
        "version_number": 2,
        "is_active":      True,
        "config":         {"vector_size": VECTOR_DIM, "max_tokens": 1024},
    }), "KBModelVersion: embed v2 (active)")

    res = ok(await pg.create("KBModel", {
        "model_name": "vision-lm-v1",
        "task_type":  "Vision Language Model",
    }), "KBModel: vision-lm-v1")
    vlm_model_id = res["model_id"]

    ok(await pg.create("KBModelVersion", {
        "model_id":       vlm_model_id,
        "version_number": 1,
        "is_active":      True,
        "config":         {"vector_size": 512, "max_tokens": 2048},
    }), "KBModelVersion: vlm v1 (active)")

    return {"embed_model_id": embed_model_id, "vlm_model_id": vlm_model_id}


# ── Section 2 — Policies ──────────────────────────────────────────────────────

async def seed_policies() -> dict:
    print("\n[Policies]")

    res = ok(await pg.create("KBFilterPolicy", {
        "tenant_id":   TENANT_A,
        "policy_name": "PII Redaction — English",
        "configformat": "Natural Language",
        "is_active":   True,
        "language":    "english",
        "config": {
            "rules": [
                "Remove all personal identification numbers",
                "Mask email addresses in the format user@domain",
                "Redact phone numbers matching E.164 or local formats",
            ],
            "threshold": 0.85,
        },
    }), "KBFilterPolicy: PII Redaction")
    fp1_id = res["policy_id"]

    res = ok(await pg.create("KBFilterPolicy", {
        "tenant_id":   TENANT_A,
        "policy_name": "Financial Keywords — Exact",
        "configformat": "Exact Match For Word or Phrase",
        "is_active":   True,
        "language":    "english",
        "config": {
            "rules": ["EBITDA", "net income", "gross margin", "revenue forecast"],
            "threshold": 1.0,
        },
    }), "KBFilterPolicy: Financial Keywords")
    fp2_id = res["policy_id"]

    res = ok(await pg.create("KBExtractionPolicy", {
        "tenant_id":   TENANT_A,
        "policy_name": "Named Entity Extraction",
        "policy_type": "Entity",
        "language":    "english",
        "custom_override": "Extract organisations, financial metrics, and product names.",
    }), "KBExtractionPolicy: Named Entity")
    ep1_id = res["policy_id"]

    res = ok(await pg.create("KBExtractionPolicy", {
        "tenant_id":   TENANT_A,
        "policy_name": "Relationship Edge Extraction",
        "policy_type": "Relationship Edge",
        "language":    "english",
    }), "KBExtractionPolicy: Relationship Edge")
    ep2_id = res["policy_id"]

    return {
        "filter_policy_ids":     [fp1_id, fp2_id],
        "extraction_policy_ids": [ep1_id, ep2_id],
    }


# ── Section 3 — Documents (KBData + KBLifecycleHistory) ───────────────────────

async def seed_documents() -> dict:
    print("\n[Documents]")
    ids = {}

    # ── Bronze docs (never promoted) ──────────────────────────────────────────
    res = ok(await pg.create("KBData", {
        "tenant_id":   TENANT_A,
        "role_id":     ROLE_ID,
        "name":        "Refund_Policy_EMEA_Draft.pdf",
        "extension":   "pdf",
        "language":    "english",
        "source_type": "doc",
        "current_tier": "bronze",
        "added_by":    ADDED_BY,
        "abstract":    "Draft refund policy for the EMEA region, pending legal review.",
        "metadata": {
            "source_type":    "doc",
            "doc_type":       "PDF",
            "author":         "Sarah Chen",
            "published_date": "2026-01-15T00:00:00",
        },
    }), "KBData: Refund_Policy_EMEA_Draft (bronze)")
    ids["bronze_doc"] = res["data_id"]

    res = ok(await pg.create("KBData", {
        "tenant_id":   TENANT_A,
        "role_id":     ROLE_ID,
        "name":        "Onboarding_Flowcard.png",
        "extension":   "png",
        "language":    "english",
        "source_type": "image",
        "current_tier": "bronze",
        "added_by":    ADDED_BY,
        "abstract":    "High-resolution onboarding flowcard for new hires.",
        "metadata": {
            "source_type": "image",
            "video_type":  "PNG",
            "height":      3508,
            "width":       2480,
            "color_space": "sRGB",
        },
    }), "KBData: Onboarding_Flowcard (bronze/image)")
    ids["bronze_image"] = res["data_id"]

    res = ok(await pg.create("KBData", {
        "tenant_id":   TENANT_A,
        "role_id":     ROLE_ID,
        "name":        "Help_Center_Web_Specs",
        "extension":   "html",
        "language":    "english",
        "source_type": "web",
        "current_tier": "bronze",
        "added_by":    ADDED_BY,
        "abstract":    "Help centre specifications scraped from the public portal.",
        "metadata": {
            "source_type": "web",
            "url":         "https://help.globalcorp.com/specs",
            "web_name":    "GlobalCorp Help Centre",
        },
    }), "KBData: Help_Center_Web_Specs (bronze/web)")
    ids["bronze_web"] = res["data_id"]

    # ── Silver doc ────────────────────────────────────────────────────────────
    res = ok(await pg.create("KBData", {
        "tenant_id":   TENANT_A,
        "role_id":     ROLE_ID,
        "name":        "H1_Cloud_Architecture_Specs.md",
        "extension":   "md",
        "language":    "english",
        "source_type": "doc",
        "current_tier": "silver",
        "added_by":    ADDED_BY,
        "abstract":    "H1 cloud architecture specifications covering VPC, IAM, and data residency.",
        "metadata": {
            "source_type":    "doc",
            "doc_type":       "Markdown",
            "author":         "Alex Rivera",
            "published_date": "2026-05-01T00:00:00",
        },
    }), "KBData: H1_Cloud_Architecture (silver)")
    ids["silver_doc"] = res["data_id"]

    ok(await pg.create("KBLifecycleHistory", {
        "data_id":  ids["silver_doc"],
        "from_tier": "bronze",
        "to_tier":   "silver",
        "approved_by": ADDED_BY,
        "notes":    "Passed OCR and chunking pipeline; promoted to silver.",
    }), "KBLifecycleHistory: bronze -> silver")

    # ── Gold doc (with tables) ─────────────────────────────────────────────────
    res = ok(await pg.create("KBData", {
        "tenant_id":   TENANT_A,
        "role_id":     ROLE_ID,
        "name":        "RAG_Pipeline_Technical_Guide.pdf",
        "extension":   "pdf",
        "language":    "english",
        "source_type": "doc",
        "current_tier": "gold",
        "added_by":    ADDED_BY,
        "abstract":    "Technical guide covering RAG architecture, vector embeddings, and graph retrieval.",
        "metadata": {
            "source_type":    "doc",
            "doc_type":       "PDF",
            "author":         "AeroFlow Team",
            "published_date": "2026-01-01T00:00:00",
        },
    }), "KBData: RAG_Pipeline_Guide (gold)")
    ids["gold_doc"] = res["data_id"]

    for from_t, to_t, note in [
        ("bronze", "silver", "OCR complete; embeddings generated."),
        ("silver", "gold",   "Entity graph extracted; quality review passed."),
    ]:
        ok(await pg.create("KBLifecycleHistory", {
            "data_id":   ids["gold_doc"],
            "from_tier": from_t,
            "to_tier":   to_t,
            "approved_by": ADDED_BY,
            "notes":     note,
        }), f"KBLifecycleHistory: {from_t} -> {to_t}")

    # ── Gold warehouse ─────────────────────────────────────────────────────────
    # warehouse_id is injected by seed_warehouse() after it creates KBWarehouse
    res = ok(await pg.create("KBData", {
        "tenant_id":   TENANT_A,   # same tenant as demo-admin so the router can resolve it
        "role_id":     ROLE_ID,
        "name":        "Snowflake_Analytics_DW",
        "extension":   "warehouse",
        "language":    "english",
        "source_type": "warehouse",
        "current_tier": "gold",
        "added_by":    ADDED_BY,
        "abstract":    "Snowflake analytics data warehouse with sales and finance schemas.",
        "metadata": {
            "source_type": "web",
            "url":         "snowflake://analytics.globalcorp.snowflakecomputing.com",
            "web_name":    "Snowflake Analytics DW",
        },
    }), "KBData: Snowflake_Analytics_DW (gold/warehouse)")
    ids["warehouse"] = res["data_id"]

    return ids


# ── Section 4 — Warehouse ─────────────────────────────────────────────────────

async def seed_warehouse(doc_ids: dict) -> dict:
    print("\n[Warehouse]")

    res = ok(await pg.create("KBWarehouse", {
        "service":     "Snowflake",
        "description": "Corporate analytics data warehouse — sales and finance schemas.",
    }), "KBWarehouse: Snowflake")
    wh_id = res["warehouse_id"]

    ok(await pg.create("KBWarehouse_Config", {
        "warehouse_id":   wh_id,
        "version_number": 1,
        "is_active":      False,
        "created_by":     ADDED_BY,
        "config": {
            "host":             "analytics.globalcorp.snowflakecomputing.com",
            "port":             443,
            "database":         "ANALYTICS_DW",
            "selected_tables":  ["sales.orders", "sales.customers"],
            "sync_schedule":    "0 2 * * *",
            "schema_filter":    ["sales"],
        },
    }), "KBWarehouse_Config: Snowflake v1 (inactive)")

    ok(await pg.create("KBWarehouse_Config", {
        "warehouse_id":   wh_id,
        "version_number": 2,
        "is_active":      True,
        "created_by":     ADDED_BY,
        "config": {
            "host":            "analytics.globalcorp.snowflakecomputing.com",
            "port":            443,
            "database":        "ANALYTICS_DW",
            "selected_tables": ["sales.orders", "sales.customers", "finance.invoices"],
            "sync_schedule":   "0 1 * * *",
            "schema_filter":   ["sales", "finance"],
        },
    }), "KBWarehouse_Config: Snowflake v2 (active)")

    # Link the KBData warehouse doc to this KBWarehouse so the router can resolve
    # GET /api/knowledge/warehouses/{doc_id}/configs → KBWarehouse_Config
    ok(await pg.update("KBData", {
        "data_id":  doc_ids["warehouse"],
        "metadata": {
            "source_type":  "web",
            "url":          "snowflake://analytics.globalcorp.snowflakecomputing.com",
            "web_name":     "Snowflake Analytics DW",
            "warehouse_id": wh_id,
        },
    }), "KBData: inject warehouse_id into warehouse doc metadata")

    return {"warehouse_id": wh_id}


# ── Section 5 — Text Blocks + Versions + Tables ───────────────────────────────

BLOCK_DATA = [
    {
        "index":   0,
        "content": (
            "Retrieval-Augmented Generation (RAG) is an architecture that combines "
            "a retrieval system with a large language model. The retrieval system "
            "queries a knowledge base to fetch relevant context, which is then passed "
            "to the LLM to generate a grounded response."
        ),
        "summary":  "Overview of the RAG architecture combining retrieval and LLM generation.",
        "entities": ["RAG", "Knowledge Base", "LLM"],
        "intents":  ["understand", "overview"],
        "has_table": False,
    },
    {
        "index":   1,
        "content": (
            "Embedding models convert raw text into dense vector representations in "
            "a high-dimensional vector space. Semantic similarity between passages is "
            "measured as cosine distance between their vectors, enabling semantic search "
            "that goes beyond keyword matching."
        ),
        "summary":  "How text is encoded into vectors for semantic similarity search.",
        "entities": ["Embedding Model", "Vector Space", "Semantic Search"],
        "intents":  ["implement", "encode"],
        "has_table": False,
    },
    {
        "index":   2,
        "content": (
            "Knowledge graphs represent entities and their relationships as nodes and "
            "edges in a graph. Neo4j stores these graphs and allows traversal queries "
            "that expand context beyond a single retrieved chunk, improving recall for "
            "complex multi-hop questions."
        ),
        "summary":  "Graph-based retrieval using entity relationships to expand context.",
        "entities": ["Knowledge Graph", "Neo4j", "Entity", "Relationship"],
        "intents":  ["traverse", "expand", "retrieve"],
        "has_table": True,
        "table": {
            "name":        "graph_retrieval_metrics",
            "description": "Benchmark results for graph traversal vs flat vector search.",
            "data": {
                "columns": ["method", "recall@5", "latency_ms"],
                "rows": [
                    ["flat_vector",   0.71, 12],
                    ["graph_1hop",    0.83, 28],
                    ["graph_2hop",    0.91, 55],
                ],
            },
        },
    },
]


async def seed_text_blocks(doc_ids: dict, model_ids: dict) -> dict:
    print("\n[TextBlocks + Versions]")

    embed_model_id = model_ids["embed_model_id"]
    results: dict[int, dict] = {}

    for block in BLOCK_DATA:
        # Create block under the gold doc
        res = ok(await pg.create("KBTextBlock", {
            "owner_id":    doc_ids["gold_doc"],
            "block_index": block["index"],
        }), f"KBTextBlock: gold_doc block={block['index']}")
        block_id = res["block_id"]

        # v1 — inactive draft
        ok(await pg.create("KBTextBlockVersion", {
            "block_id":          block_id,
            "version_number":    1,
            "content":           block["content"] + " [v1 draft]",
            "created_by":        ADDED_BY,
            "embedding_model_id": embed_model_id,
            "table_involved":    block["has_table"],
            "payload": {
                "summary":  "Draft version.",
                "entities": [],
                "intents":  [],
            },
        }), f"  KBTextBlockVersion: block={block['index']} v1 (draft)")

        # v2 — active
        res = ok(await pg.create("KBTextBlockVersion", {
            "block_id":          block_id,
            "version_number":    2,
            "content":           block["content"],
            "created_by":        ADDED_BY,
            "embedding_model_id": embed_model_id,
            "table_involved":    block["has_table"],
            "payload": {
                "summary":  block["summary"],
                "entities": block["entities"],
                "intents":  block["intents"],
            },
        }), f"  KBTextBlockVersion: block={block['index']} v2 (active)")
        version_id = res["version_id"]

        # Activate v2
        ok(await pg.update("KBTextBlockVersion", {
            "version_id": version_id,
            "is_active":  True,
        }), f"  Activate block={block['index']} v2")

        # KBTextTable for blocks that have a structured table
        if block["has_table"]:
            t = block["table"]
            ok(await pg.create("KBTextTable", {
                "version_id":  version_id,
                "table_name":  t["name"],
                "description": t["description"],
                "data":        t["data"],
            }), f"  KBTextTable: {t['name']}")

        results[block["index"]] = {
            "block_id":   block_id,
            "version_id": version_id,
        }

    # Also seed 2 blocks for the silver doc (no tables, no versions switching)
    for i, summary in enumerate([
        "VPC design principles for multi-region deployments.",
        "IAM role hierarchy and least-privilege access patterns.",
    ]):
        res = ok(await pg.create("KBTextBlock", {
            "owner_id":    doc_ids["silver_doc"],
            "block_index": i,
        }), f"KBTextBlock: silver_doc block={i}")
        block_id = res["block_id"]

        ok(await pg.create("KBTextBlockVersion", {
            "block_id":          block_id,
            "version_number":    1,
            "content":           summary + " (full content placeholder)",
            "created_by":        ADDED_BY,
            "is_active":         True,
            "embedding_model_id": embed_model_id,
            "table_involved":    False,
            "payload": {
                "summary":  summary,
                "entities": ["VPC" if i == 0 else "IAM", "Cloud Architecture"],
                "intents":  ["configure", "design"],
            },
        }), f"  KBTextBlockVersion: silver block={i} v1 (active)")

    # KBTable (standalone table registry for gold doc)
    ok(await pg.create("KBTable", {
        "owner_id":   doc_ids["gold_doc"],
        "table_name": "graph_retrieval_metrics",
        "description": "Registered table extracted from the RAG guide.",
        "created_by": ADDED_BY,
        "schema": {
            "columns": [
                {"name": "method",      "type": "text"},
                {"name": "recall_at_5", "type": "float"},
                {"name": "latency_ms",  "type": "int"},
            ],
        },
    }), "KBTable: graph_retrieval_metrics")

    return results


# ── Section 6 — Conflicts ─────────────────────────────────────────────────────

async def seed_conflicts() -> dict:
    print("\n[Conflicts]")
    batch_ids = {}

    # Batch 1 — pending content conflicts
    res = ok(await pg.create("KBConflictBatch", {
        "tenant_id":   TENANT_A,
        "batch_title": "May 2026 — Policy Document Conflicts",
        "status":      "pending",
    }), "KBConflictBatch: May 2026 Policy")
    batch1_id = res["batch_id"]
    batch_ids["pending_batch"] = batch1_id

    ok(await pg.create("KBConflict", {
        "tenant_id":     TENANT_A,
        "batch_id":      batch1_id,
        "conflict_type": "content_contradiction",
        "severity":      "high",
        "status":        "pending",
        "detailed_explanation": (
            "Section 4.2 states refund window is 30 days in the EMEA draft "
            "but the global policy document specifies 14 days."
        ),
        "existing_snapshot": {
            "doc_id":  "Refund_Policy_EMEA_Draft",
            "section": "4.2",
            "text":    "Refunds must be requested within 14 days of purchase.",
        },
        "incoming_snapshot": {
            "doc_id":  "Refund_Policy_EMEA_v2",
            "section": "4.2",
            "text":    "Refunds must be requested within 30 days of purchase.",
        },
    }), "KBConflict: content_contradiction (high, pending)")

    ok(await pg.create("KBConflict", {
        "tenant_id":     TENANT_A,
        "batch_id":      batch1_id,
        "conflict_type": "content_duplicate",
        "severity":      "medium",
        "status":        "pending",
        "detailed_explanation": (
            "Identical paragraph detected in both the Employee SOP and the "
            "Onboarding Guide — likely a copy-paste artefact."
        ),
        "existing_snapshot": {"doc_id": "Employee_SOP", "chunk_index": 3},
        "incoming_snapshot": {"doc_id": "Onboarding_Guide", "chunk_index": 7},
    }), "KBConflict: content_duplicate (medium, pending)")

    # Batch 2 — awaiting AI merge
    res = ok(await pg.create("KBConflictBatch", {
        "tenant_id":   TENANT_A,
        "batch_title": "Q1 Finance — Data Table Schema Conflicts",
        "status":      "awaiting",
    }), "KBConflictBatch: Q1 Finance Schema")
    batch2_id = res["batch_id"]
    batch_ids["awaiting_batch"] = batch2_id

    ok(await pg.create("KBConflict", {
        "tenant_id":     TENANT_A,
        "batch_id":      batch2_id,
        "conflict_type": "table_schema",
        "severity":      "high",
        "status":        "awaiting",
        "detailed_explanation": (
            "The 'revenue' column changed type from FLOAT to DECIMAL(18,4) "
            "between the Q4 and Q1 reports — downstream aggregations will break."
        ),
        "resolution_instruction": "Merge using DECIMAL(18,4) as canonical type.",
        "existing_snapshot": {"table": "finance.revenue", "col_type": "FLOAT"},
        "incoming_snapshot": {"table": "finance.revenue", "col_type": "DECIMAL(18,4)"},
    }), "KBConflict: table_schema (high, awaiting)")

    # Batch 3 — resolved
    res = ok(await pg.create("KBConflictBatch", {
        "tenant_id":   TENANT_A,
        "batch_title": "April 2026 — Cloud Spec Version Conflicts",
        "status":      "resolved",
    }), "KBConflictBatch: April Cloud Spec")
    batch3_id = res["batch_id"]
    batch_ids["resolved_batch"] = batch3_id

    ok(await pg.create("KBConflict", {
        "tenant_id":     TENANT_A,
        "batch_id":      batch3_id,
        "conflict_type": "content_update",
        "severity":      "low",
        "status":        "resolved",
        "detailed_explanation": "Cloud architecture spec updated from v1.3 to v1.4 — minor wording.",
        "resolution_instruction": "Kept incoming (newer version).",
    }), "KBConflict: content_update (low, resolved)")

    return batch_ids


# ── Section 7 — Qdrant (connection registry + collections + vectors) ──────────

async def seed_qdrant(doc_ids: dict, block_results: dict, model_ids: dict) -> dict:
    print("\n[Qdrant]")

    # Postgres registry
    res = ok(await pg.create("KBQdrantConnection", {
        "tenant_id":        TENANT_A,
        "is_active":        True,
        "total_collection": 2,
    }), "KBQdrantConnection: tenant_a")
    qdrant_conn_id = res["connection_id"]

    res = ok(await pg.create("KBQdrantCollection", {
        "connection_id":     qdrant_conn_id,
        "collection_name":   COLLECTION_CHUNKS,
        "is_active":         True,
        "similarity_metric": "cosine",
        "points_count":      len(BLOCK_DATA),
        "vector_dimension":  VECTOR_DIM,
        "embedding_model_id": model_ids["embed_model_id"],
    }), f"KBQdrantCollection: {COLLECTION_CHUNKS}")
    col1_id = res["collection_id"]

    res = ok(await pg.create("KBQdrantCollection", {
        "connection_id":     qdrant_conn_id,
        "collection_name":   COLLECTION_TABLES,
        "is_active":         True,
        "similarity_metric": "cosine",
        "points_count":      1,
        "vector_dimension":  VECTOR_DIM,
        "embedding_model_id": model_ids["embed_model_id"],
    }), f"KBQdrantCollection: {COLLECTION_TABLES}")
    col2_id = res["collection_id"]

    # Qdrant collections — drop first so seed is idempotent
    ok(await qd.delete_collection(COLLECTION_CHUNKS), f"Qdrant delete_collection: {COLLECTION_CHUNKS}")
    ok(await qd.create_collection({
        "name":            COLLECTION_CHUNKS,
        "vector_size":     VECTOR_DIM,
        "distance_metric": "Cosine",
    }), f"Qdrant create_collection: {COLLECTION_CHUNKS}")

    ok(await qd.delete_collection(COLLECTION_TABLES), f"Qdrant delete_collection: {COLLECTION_TABLES}")
    ok(await qd.create_collection({
        "name":            COLLECTION_TABLES,
        "vector_size":     VECTOR_DIM,
        "distance_metric": "Cosine",
    }), f"Qdrant create_collection: {COLLECTION_TABLES}")

    # Upsert chunk points
    chunk_points = []
    for block in BLOCK_DATA:
        br = block_results[block["index"]]
        chunk_points.append({
            "id":     br["version_id"],
            "vector": _vec(block["index"]),
            "payload": {
                "tenant_id": TENANT_A,
                "block_id":  br["block_id"],
                "data_id":   doc_ids["gold_doc"],
                "summary":   block["summary"],
                "entities":  block["entities"],
                "intents":   block["intents"],
            },
        })

    ok(await qd.add_points({
        "collection_name": COLLECTION_CHUNKS,
        "points":          chunk_points,
    }), f"Qdrant add_points: {len(chunk_points)} chunk vectors")

    # Upsert the table block as a separate point in the table collection
    table_block  = BLOCK_DATA[2]
    table_result = block_results[table_block["index"]]
    ok(await qd.add_points({
        "collection_name": COLLECTION_TABLES,
        "points": [{
            "id":     str(uuid.uuid5(uuid.NAMESPACE_DNS, str(table_result["version_id"]) + "-tbl")),
            "vector": _vec("table_vec"),
            "payload": {
                "tenant_id": TENANT_A,
                "block_id":  table_result["block_id"],
                "data_id":   doc_ids["gold_doc"],
                "summary":   "Benchmark results for graph traversal vs flat vector search.",
                "entities":  ["Knowledge Graph", "Neo4j", "Recall", "Latency"],
                "intents":   ["benchmark", "compare"],
            },
        }],
    }), "Qdrant add_points: 1 table vector")

    return {"qdrant_conn_id": qdrant_conn_id, "col_ids": [col1_id, col2_id]}


# ── Section 8 — Neo4j (connection registry + nodes + relationships) ───────────

ENTITY_DATA = {
    "RAG":             "A technique combining retrieval systems with language model generation.",
    "Knowledge_Base":  "A structured collection of domain-specific information for retrieval.",
    "LLM":             "Large language model for text generation and understanding.",
    "Embedding_Model": "Neural model that converts text into dense vector representations.",
    "Vector_Space":    "Mathematical space where semantic similarity is measured by distance.",
    "Semantic_Search": "Search based on meaning rather than exact keyword matching.",
    "Knowledge_Graph": "Graph database structure storing entities and their relationships.",
    "Neo4j":           "Graph database management system for storing knowledge graphs.",
    "Entity":          "A named concept or object within the knowledge domain.",
    "Relationship":    "A directed connection between two entities in a knowledge graph.",
}

ENTITY_RELATIONS = [
    ("RAG",             "MENTIONS",   "Knowledge_Base"),
    ("RAG",             "MENTIONS",   "LLM"),
    ("RAG",             "USES",       "Embedding_Model"),
    ("RAG",             "USES",       "Knowledge_Graph"),
    ("Semantic_Search", "RELIES_ON",  "Embedding_Model"),
    ("Semantic_Search", "QUERIES",    "Vector_Space"),
    ("Knowledge_Graph", "CONTAINS",   "Entity"),
    ("Knowledge_Graph", "CONTAINS",   "Relationship"),
    ("Knowledge_Graph", "STORED_IN",  "Neo4j"),
]


async def seed_neo4j(doc_ids: dict, block_results: dict, model_ids: dict) -> dict:
    print("\n[Neo4j]")

    # Postgres registry
    res = ok(await pg.create("KBNeo4jConnection", {
        "tenant_id":          TENANT_A,
        "is_connected":       True,
        "total_node":         len(ENTITY_DATA),
        "total_edge":         len(ENTITY_RELATIONS),
        "embedding_model_id": model_ids["embed_model_id"],
    }), "KBNeo4jConnection: tenant_a")
    neo4j_conn_id = res["connection_id"]

    # Use block 0 as the source block for all entity nodes (they come from the RAG guide)
    source_block = block_results[0]

    # Register nodes in Postgres, then create them in Neo4j
    node_ids: dict[str, str] = {}     # Neo4j internal IDs for add_relationship
    pg_node_ids: dict[str, str] = {}  # Postgres UUIDs for KBNeo4jRelationship FK
    for name, description in ENTITY_DATA.items():
        res = ok(await pg.create("KBNeo4jNode", {
            "connection_id":    neo4j_conn_id,
            "node_name":        name,
            "node_description": description,
        }), f"  KBNeo4jNode: {name}")
        pg_node_ids[name] = res["node_id"]

        res = ok(await neo.add_node({
            "node": {
                "label":    "Entity",
                "properties": {
                    "block_id":    str(source_block["block_id"]),
                    "tenant_id":   TENANT_A,
                    "data_id":     str(doc_ids["gold_doc"]),
                    "description": description,
                },
                "embedding": _vec(hash(name) & 0xFFFF),
            },
        }), f"  Neo4j add_node: {name}")
        node_ids[name] = res["id"]

    # Register relationships in Postgres, then create them in Neo4j
    for from_name, rel_type, to_name in ENTITY_RELATIONS:
        ok(await pg.create("KBNeo4jRelationship", {
            "from_node":   pg_node_ids[from_name],
            "to_node":     pg_node_ids[to_name],
            "score":       round(random.uniform(0.6, 0.98), 2),
            "description": f"{from_name} --[{rel_type}]--> {to_name}",
        }), f"  KBNeo4jRelationship: {from_name} -> {to_name}")

        ok(await neo.add_relationship({
            "from_node_id": node_ids[from_name],
            "to_node_id":   node_ids[to_name],
            "relationship": {
                "type":      rel_type,
                "direction": ">",
            },
        }), f"  Neo4j add_relationship: {from_name} -> {to_name}")

    return {"neo4j_conn_id": neo4j_conn_id, "node_ids": node_ids}


# ── Section 9 — Entity Lookup + Publish API ───────────────────────────────────

async def seed_lookup_and_api():
    print("\n[EntityLookup + PublishAPI]")

    for alias, canonical in [
        ("RAG",     "Retrieval-Augmented Generation"),
        ("LLM",     "Large Language Model"),
        ("VPC",     "Virtual Private Cloud"),
        ("IAM",     "Identity and Access Management"),
        ("EBITDA",  "Earnings Before Interest, Taxes, Depreciation, Amortisation"),
    ]:
        ok(await pg.create("KBEntityLookup", {
            "alias_name":     alias,
            "canonical_name": canonical,
        }), f"KBEntityLookup: {alias} -> {canonical}")

    ok(await pg.create("KBPublishAPI", {
        "tenant_id":    TENANT_A,
        "name":         "Retrieve Endpoint",
        "type":         "RETRIEVE",
        "endpoint_url": "/api/v1/retrieve",
        "http_method":  "POST",
        "is_published": True,
    }), "KBPublishAPI: Retrieve")

    ok(await pg.create("KBPublishAPI", {
        "tenant_id":    TENANT_A,
        "name":         "Qdrant Search Endpoint",
        "type":         "QDRANT",
        "endpoint_url": "/api/v1/search/qdrant",
        "http_method":  "POST",
        "is_published": True,
    }), "KBPublishAPI: Qdrant Search")

    ok(await pg.create("KBPublishAPI", {
        "tenant_id":    TENANT_A,
        "name":         "Neo4j Graph Endpoint",
        "type":         "NEO4J",
        "endpoint_url": "/api/v1/search/graph",
        "http_method":  "POST",
        "is_published": False,
    }), "KBPublishAPI: Neo4j Graph (unpublished)")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("AeroFlow KB - comprehensive mock data seeder")
    print("=" * 60)

    model_ids   = await seed_models()
    await seed_policies()
    doc_ids     = await seed_documents()
    await seed_warehouse(doc_ids)
    block_res   = await seed_text_blocks(doc_ids, model_ids)
    await seed_conflicts()
    await seed_qdrant(doc_ids, block_res, model_ids)
    neo_ids     = await seed_neo4j(doc_ids, block_res, model_ids)
    await seed_lookup_and_api()

    print("\n" + "=" * 60)
    print("Seed complete.")
    print(f"  embed_model_id : {model_ids['embed_model_id']}")
    print(f"  gold_doc_id    : {doc_ids['gold_doc']}")
    print(f"  qdrant chunks  : {COLLECTION_CHUNKS}  ({len(BLOCK_DATA)} points)")
    print(f"  neo4j nodes    : {len(ENTITY_DATA)}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
