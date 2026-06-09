"""
LightRAG Retrieval Pipeline
============================
All step functions + orchestrator in one file.
Clients are injected — no module-level singletons.

Pipeline flow:
  1.  canonicalize     — Llama3 via LiteLLM → {intent, entities, relationships}
  2.  cache_lookup     — Qdrant semantic cache → early return on hit
  3.  qdrant_search    — Pass 1: entity filter (any), LIMIT=3
  4.  rank_entities    — score entities from pass1 by frequency × relevance
  5.  graph_expand     — Neo4j: top-N entities → related entity names (tenant-filtered)
  6.  qdrant_search    — Pass 2: expanded Neo4j entities (any), LIMIT=2
  7.  rrf_merge        — pass1 + pass2 → top 10
  8.  rerank           — cross-encoder on summaries → top 5
  9.  hydrate          — fetch actual chunk text + source info from Postgres (active version)
"""
from __future__ import annotations

import json
import logging
import uuid as _uuid

import httpx
from neo4j import AsyncDriver
from qdrant_client.async_qdrant_client import AsyncQdrantClient

from services.database_connector.qdrant_connector import vector_search as qdrant_vector_search
from services.database_connector.postgres_connector import PostgresClient
from services.database_connector.model_connector import ModelServiceClient
from basemodel.services_databaseconnector.qdrant_model import (
    MatchingPayload,
    MatchType,
    SearchRequest,
)
from basemodel.services_databaseconnector.postgres_model import (
    ReadJoinRequest,
    SelectedColumn,
    WhereFilter,
)

from services.backend.pipeline.light_rag import config as cfg

log = logging.getLogger(__name__)

_RRF_K = 60


# ═══════════════════════════════════════════════════════════════════════════════
# LLM helpers — direct to llama server /api/generate (no LiteLLM proxy)
# X-System-Type header tells the llama server which pre-cached KV snapshot to use.
# ═══════════════════════════════════════════════════════════════════════════════

# Timeout for pipeline LLM calls — increased for CPU inference.
# On timeout or error the step returns empty and the pipeline continues with vector search only.
_LLM_TIMEOUT = 60.0


async def _llm_generate(
    base_url: str, model: str, system_type: str, user: str,
    temperature: float = 0.1, max_tokens: int = 512,
) -> str:
    payload = {
        "model":  model,
        "prompt": user,
        "format": "json",
        "stream": False,
        "options": {
            "num_predict": max_tokens,
            "temperature": temperature,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=_LLM_TIMEOUT) as client:
            resp = await client.post(
                f"{base_url}/api/generate",
                json=payload,
                headers={"X-System-Type": system_type},
            )
            resp.raise_for_status()
        return resp.json().get("response", "")
    except Exception as exc:
        log.warning("llm | %s timed out or failed (%s) — continuing without LLM step", system_type, exc)
        return ""


async def _llm_generate_json(
    base_url: str, model: str, system_type: str, user: str,
    temperature: float = 0.1, max_tokens: int = 512,
) -> dict:
    raw = await _llm_generate(base_url, model, system_type, user, temperature, max_tokens)
    if not raw:
        return {}
    stripped = raw.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("```", 2)[1]
        if stripped.startswith("json"):
            stripped = stripped[4:]
        stripped = stripped.rsplit("```", 1)[0].strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError as exc:
        log.warning("llm | JSON parse failed: %r — %s", raw[:200], exc)
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Canonicalize Query
# ═══════════════════════════════════════════════════════════════════════════════

_CANONICALIZE_SYSTEM = """\
Convert the user's query into a structured semantic format for knowledge retrieval.
Detect the language (English or Vietnamese) and keep names in that language.

Respond ONLY with valid JSON:
{"intent": "<label>", "entities": ["<e1>", "<e2>"], "relationships": [["<e1>", "<rel>", "<e2>"]]}

Examples:
Query: "Distance between NYU and Trento"
{"intent":"distance_query","entities":["NYU","Trento"],"relationships":[["NYU","geographic_distance","Trento"]]}

Query: "Gia xang co anh huong den gia o to?"
{"intent":"causal_query","entities":["gia xang","gia oto"],"relationships":[["gia xang","anh huong","gia oto"]]}"""


async def canonicalize(base_url: str, model: str, query: str) -> dict:
    result = await _llm_generate_json(base_url, model, "canonicalize", query, temperature=0.0, max_tokens=256)
    entities = result.get("entities", [])
    return {
        "intent": str(result.get("intent", "general")),
        "entities": [str(e) for e in (entities if isinstance(entities, list) else [])],
        "relationships": result.get("relationships", []),
    }


SYSTEM_PROMPTS: dict[str, str] = {
    "canonicalize": _CANONICALIZE_SYSTEM,
}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Cache Lookup
# ═══════════════════════════════════════════════════════════════════════════════

async def cache_lookup(
    qdrant: AsyncQdrantClient,
    collection: str,
    query_vector: list[float],
    tenant_id: str,
    threshold: float,
) -> dict | None:
    req = SearchRequest(
        tenant_id=tenant_id,
        collection_name=collection,
        query_vector=query_vector,
        limit=1,
    )
    try:
        resp = await qdrant_vector_search(qdrant, req)
        if resp.code != 200 or not resp.data:
            return None
        top = resp.data[0]
        if top.score >= threshold:
            log.info("cache | HIT score=%.3f", top.score)
            return top.payload or {}
    except Exception as exc:
        log.warning("cache | lookup failed: %s", exc)
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 & 7 — Qdrant Semantic Search
# ═══════════════════════════════════════════════════════════════════════════════

async def qdrant_search(
    qdrant: AsyncQdrantClient,
    collection: str,
    query_vector: list[float],
    tenant_id: str,
    limit: int,
    entities: list[str] | None = None,
) -> list[dict]:
    # Only filter on entities — intent is too specific and would exclude chunks
    # stored before entity/intent extraction was stable.
    matching: list[MatchingPayload] = []
    if entities:
        matching.append(MatchingPayload(field="entities", values=entities))

    req = SearchRequest(
        tenant_id=tenant_id,
        collection_name=collection,
        query_vector=query_vector,
        limit=limit,
        matching_payload=matching or None,
        match_type=MatchType.any,
    )
    try:
        resp = await qdrant_vector_search(qdrant, req)
        if resp.code != 200 or not resp.data:
            return []
        return [
            {
                "point_id": str(pt.id),
                "score":    pt.score,
                "payload":  (pt.payload or {}),
            }
            for pt in resp.data
        ]
    except Exception as exc:
        log.warning("qdrant_search | failed: %s", exc)
        return []


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Entity Ranking + Neo4j Graph Expansion
# ═══════════════════════════════════════════════════════════════════════════════

def _rank_entities(pass1_results: list[list[dict]], top_n: int) -> list[str]:
    """Score entities extracted from Qdrant pass1 results by frequency × relevance score.

    Entities that appear in many high-scoring results are ranked highest and
    used as graph expansion seeds — limiting starting nodes avoids an
    exponentially growing neighbourhood set.
    """
    freq: dict[str, float] = {}
    for hits in pass1_results:
        for h in hits:
            score = float(h.get("score") or 1.0)
            for ent in (h.get("payload") or {}).get("entities", []):
                if isinstance(ent, str) and ent.strip():
                    freq[ent] = freq.get(ent, 0.0) + score
    return sorted(freq, key=lambda e: freq[e], reverse=True)[:top_n]


async def graph_expand(
    driver: AsyncDriver,
    entity_names: list[str],
    tenant_id: str,
    max_hops: int,
    max_neighbours: int,
    query_vec: list[float],
) -> list[str]:
    """Find neighbour entity names ranked by Neo4j vector similarity to the query.

    Uses vector.similarity.cosine() (Neo4j 5.x built-in) to score and order
    neighbours inside Cypher — no vectors are pulled back to Python.
    Entities without a stored vector are excluded via the IS NOT NULL guard.
    """
    seen: set[str] = set(entity_names)
    expanded: list[str] = []

    for name in entity_names:
        try:
            cypher = (
                f"MATCH (s:Entity {{name: $name, tenant_id: $tid}})"
                f"-[*1..{max_hops}]-(nb:Entity) "
                f"WHERE nb.name <> $name AND nb.tenant_id = $tid AND nb.vector IS NOT NULL "
                f"WITH DISTINCT nb, "
                f"vector.similarity.cosine(nb.vector, $qvec) AS score "
                f"ORDER BY score DESC "
                f"LIMIT $lim "
                f"RETURN nb.name AS name"
            )
            async with driver.session() as session:
                result = await session.run(
                    cypher,
                    name=name,
                    tid=tenant_id,
                    qvec=query_vec,
                    lim=max_neighbours,
                )
                records = await result.data()
            for r in records:
                nb_name = r.get("name")
                if isinstance(nb_name, str) and nb_name.strip() and nb_name not in seen:
                    seen.add(nb_name)
                    expanded.append(nb_name)
        except Exception as exc:
            log.warning("graph_expand | entity=%s: %s", name, exc)

    log.info("graph_expand | %d seeds → %d neighbours", len(entity_names), len(expanded))
    return expanded


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8 — RRF Merge
# ═══════════════════════════════════════════════════════════════════════════════

def rrf_merge(ranked_lists: list[list[dict]], top_n: int) -> list[dict]:
    scores: dict[str, float] = {}
    meta: dict[str, dict] = {}
    for result_list in ranked_lists:
        for rank, hit in enumerate(result_list, start=1):
            pid = hit.get("point_id")
            if not pid:
                continue
            scores[pid] = scores.get(pid, 0.0) + 1.0 / (_RRF_K + rank)
            meta.setdefault(pid, hit)
    sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
    merged = [
        {**meta[pid], "rrf_score": scores[pid], "rrf_rank": i}
        for i, pid in enumerate(sorted_ids[:top_n], start=1)
    ]
    log.info("rrf | %d lists → %d unique → top %d", len(ranked_lists), len(scores), len(merged))
    return merged


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9 — Reranking (cross-encoder/ms-marco-MiniLM-L-6-v2 via model-service)
# Scores summaries stored in Qdrant — actual text is hydrated in step 11.
# ═══════════════════════════════════════════════════════════════════════════════

async def rerank(
    model: ModelServiceClient,
    query: str,
    hits: list[dict],
    top_n: int,
) -> list[dict]:
    if not hits:
        return []
    documents = [(h.get("payload") or {}).get("summary", "") for h in hits]
    non_empty = [(i, d) for i, d in enumerate(documents) if d.strip()]
    if not non_empty:
        return hits[:top_n]
    indices, docs = zip(*non_empty)
    try:
        ranked = await model.rerank(query, list(docs), min(top_n, len(docs)))
        return [
            {
                **hits[indices[r["index"]]],
                "rerank_score": r.get("relevance_score", 0.0),
                "rerank_rank":  i,
            }
            for i, r in enumerate(ranked[:top_n], start=1)
        ]
    except Exception as exc:
        log.warning("rerank | failed: %s — using rrf order", exc)
        return hits[:top_n]


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 10 — Postgres Hydration
# Fetches the *active* KBTextBlockVersion text + KBData source info for each
# block_id returned by Qdrant.  block_id is the 1-to-1 key between Qdrant and
# the KBTextBlock table in Postgres.
# ═══════════════════════════════════════════════════════════════════════════════

async def _fetch_chunks_postgres(
    postgres: PostgresClient,
    block_ids: list[str],
    tenant_id: str,
) -> dict[str, dict]:
    """Return a dict keyed by block_id (str) with row data from Postgres."""
    if not block_ids:
        return {}
    rows: dict[str, dict] = {}
    for bid in block_ids:
        try:
            resp = await postgres.read(ReadJoinRequest(
                joins_table=["KBTextBlock", "KBTextBlockVersion", "KBData"],
                selected_columns=[
                    SelectedColumn(table_name="KBTextBlock",        column_name="block_id"),
                    SelectedColumn(table_name="KBTextBlock",        column_name="block_index"),
                    SelectedColumn(table_name="KBTextBlockVersion", column_name="content"),
                    SelectedColumn(table_name="KBTextBlockVersion", column_name="version_number"),
                    SelectedColumn(table_name="KBData", column_name="data_id",      alias="doc_id"),
                    SelectedColumn(table_name="KBData", column_name="name",         alias="doc_name"),
                    SelectedColumn(table_name="KBData", column_name="source_type"),
                    SelectedColumn(table_name="KBData", column_name="current_tier"),
                ],
                filters=[
                    WhereFilter(
                        table_name="KBTextBlock",
                        column_name="block_id",
                        value=_uuid.UUID(bid),
                    ),
                    WhereFilter(
                        table_name="KBTextBlockVersion",
                        column_name="is_active",
                        value=True,
                    ),
                    WhereFilter(
                        table_name="KBTextBlockVersion",
                        column_name="is_deleted",
                        value=False,
                    ),
                    WhereFilter(
                        table_name="KBData",
                        column_name="tenant_id",
                        value=_uuid.UUID(tenant_id),
                    ),
                    WhereFilter(
                        table_name="KBData",
                        column_name="is_deleted",
                        value=False,
                    ),
                ],
                limit=1,
            ))
            if resp.code == 200 and resp.data:
                rows[bid] = resp.data[0]
            elif resp.code != 200:
                log.warning("_fetch_chunks_postgres | block_id=%s code=%d: %s", bid, resp.code, resp.error)
        except Exception as exc:
            log.warning("_fetch_chunks_postgres | block_id=%s: %s", bid, exc)
    return rows


def _build_result_list(final: list[dict], pg_rows: dict[str, dict]) -> list[dict]:
    """Merge rerank scores with actual chunk text and Postgres source info."""
    enriched = []
    for hit in final:
        bid = str((hit.get("payload") or {}).get("block_id") or "")
        pg = pg_rows.get(bid) or {}
        enriched.append({
            "chunk_rank":    hit.get("rerank_rank", 0),
            "chunk_score":   hit.get("rerank_score", hit.get("rrf_score", 0.0)),
            # Actual chunk text from active Postgres version; fall back to Qdrant summary
            "chunk_context": pg.get("content") or (hit.get("payload") or {}).get("summary", ""),
            "source": {
                "block_id":    bid,
                "block_index": pg.get("block_index"),
                "doc_id":      str(pg.get("doc_id") or ""),
                "doc_name":    str(pg.get("doc_name") or ""),
                "source_type": str(pg.get("source_type") or ""),
                "tier":        str(pg.get("current_tier") or ""),
            },
        })
    return enriched


# ═══════════════════════════════════════════════════════════════════════════════
# ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════

class LightRAGPipeline:
    """Stateless pipeline — all DB clients injected per run() call."""

    async def run(
        self,
        query: str,
        tenant_id: str,
        qdrant: AsyncQdrantClient,
        neo4j: AsyncDriver,
        model: ModelServiceClient,
        postgres: PostgresClient,
        collection: str = cfg.QDRANT_COLLECTION,
    ) -> dict:
        # 1. Canonicalize — extract intent, entities, relationships
        canonical = await canonicalize(cfg.LLAMA_BASE_URL, cfg.LLM_MODEL, query)

        # 2. Embed query + cache lookup
        query_vecs = await model.embed([query])
        query_vec = query_vecs[0] if query_vecs else []
        if query_vec:
            hit = await cache_lookup(
                qdrant, cfg.QDRANT_CACHE_COLLECTION,
                query_vec, tenant_id, cfg.CACHE_THRESHOLD,
            )
            if hit:
                return {
                    "source":    "cache",
                    "canonical": canonical,
                    "results":   [hit],
                }

        # 3. Qdrant pass 1 — entity payload filter (any) + vector similarity, tenant-filtered
        pass1: list[dict] = await qdrant_search(
            qdrant, collection, query_vec, tenant_id,
            limit=cfg.QDRANT_PASS1_LIMIT,
            entities=canonical["entities"] or None,
        )

        # 4. Rank entities from pass1 by frequency × relevance; take top-N for graph seeds
        top_entities = _rank_entities([pass1], cfg.NEO4J_TOP_ENTITIES)
        log.info("run | ranked entities (top %d): %r", cfg.NEO4J_TOP_ENTITIES, top_entities)

        # 5. Neo4j graph expansion — tenant-filtered, using entity names as node keys
        neo4j_entities: list[str] = []
        if top_entities:
            try:
                neo4j_entities = await graph_expand(
                    neo4j, top_entities, tenant_id,
                    cfg.NEO4J_MAX_HOPS, cfg.NEO4J_MAX_NEIGHBOURS,
                    query_vec,
                )
            except Exception as exc:
                log.warning("run | graph_expand failed: %s", exc)

        # 6. Qdrant pass 2 — expanded Neo4j entities (any), tenant-filtered
        pass2: list[dict] = []
        if neo4j_entities:
            pass2 = await qdrant_search(
                qdrant, collection, query_vec, tenant_id,
                limit=cfg.QDRANT_PASS2_LIMIT,
                entities=neo4j_entities,
            )

        # 7. RRF merge pass1 + pass2 → top-N
        rrf_top = rrf_merge([pass1, pass2], top_n=cfg.RRF_TOP_N)

        # 8. Rerank by cross-encoder on stored summaries → top-N
        final = await rerank(model, query, rrf_top, cfg.RERANK_TOP_N)

        # 9. Hydrate — fetch actual text + source from Postgres (active version only)
        block_ids = [
            str((h.get("payload") or {}).get("block_id") or "")
            for h in final
            if (h.get("payload") or {}).get("block_id")
        ]
        pg_rows = await _fetch_chunks_postgres(postgres, block_ids, tenant_id)
        results = _build_result_list(final, pg_rows)

        log.info("run | query=%r rrf=%d hydrated=%d", query[:60], len(rrf_top), len(results))
        return {
            "source":    "pipeline",
            "canonical": canonical,
            "results":   results,
        }
