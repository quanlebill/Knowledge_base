"""
LightRAG Retrieval Pipeline
============================
All step functions + orchestrator in one file.

Step functions are pure async functions — no class state, no filter logic.
LightRAGPipeline.run() only calls steps in order.

Pipeline flow:
  1. enhance_query     — Llama3 via LiteLLM → brief answer + 5 sub-queries
  2. canonicalize      — Llama3 via LiteLLM → {intent, entities, relationships}
  3. cache_lookup      — Qdrant semantic cache → early return on hit
  4. embed_texts       — LiteLLM embeddings for all 5 sub-queries
  5. qdrant_search ×5  — Pass 1: entity + intent filter (any), LIMIT=3 per query
  6. graph_expand      — Neo4j: top-3 points → related entity names (hop=1, n=5)
  7. qdrant_search ×5  — Pass 2: Neo4j entity filter (any), LIMIT=2 per query
  8. rrf_merge         — 5 × (pass1 + pass2) lists → top 10
  9. rerank            — cross-encoder on point summaries → top 5
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import LiteralString

import httpx
import litellm
from neo4j import AsyncDriver
from qdrant_client.async_qdrant_client import AsyncQdrantClient

from services.database_connector.qdrant_connector import vector_search as qdrant_vector_search
from basemodel.services_databaseconnector.qdrant_model import (
    MatchingPayload,
    MatchType,
    SearchRequest,
)

from app.pipeline.light_rag import config as cfg

log = logging.getLogger(__name__)

_HTTP_TIMEOUT = httpx.Timeout(connect=5.0, read=60.0, write=5.0, pool=5.0)
_RRF_K = 60


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — LLM client
# litellm.atext_completion → /v1/completions → LiteLLM proxy → /api/generate on llama.
# X-System-Type in extra_headers is forwarded so the llama server loads the pre-cached
# system KV snapshot and only tokenizes the user content per call.
# ═══════════════════════════════════════════════════════════════════════════════

async def _llm_generate(base_url: str, model: str, system_type: str, user: str,
                        temperature: float = 0.1, max_tokens: int = 512) -> str:
    resp = await litellm.atext_completion(
        model=model,
        prompt=user,
        api_base=base_url,
        extra_headers={"X-System-Type": system_type},
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].text


async def _llm_generate_json(base_url: str, model: str, system_type: str, user: str,
                              temperature: float = 0.1, max_tokens: int = 512) -> dict:
    raw = await _llm_generate(base_url, model, system_type, user, temperature, max_tokens)
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
# STEP 1 — Query Enhancement
# ═══════════════════════════════════════════════════════════════════════════════

_ENHANCE_SYSTEM = """\
You are a retrieval assistant. Given a user query:
1. Provide a brief answer (1-2 sentences).
2. Generate exactly 5 alternative questions covering different angles of the \
same topic — these will be used to retrieve supporting knowledge.

Respond ONLY with valid JSON:
{"brief_answer": "<1-2 sentence answer>", "sub_queries": ["<q1>","<q2>","<q3>","<q4>","<q5>"]}"""


async def enhance_query(base_url: str, model: str, query: str) -> dict:
    result = await _llm_generate_json(base_url, model, "enhance", query, temperature=0.3, max_tokens=512)
    sub_queries = [str(q) for q in (result.get("sub_queries") or [])[:5]]
    while len(sub_queries) < 5:
        sub_queries.append(query)
    return {"brief_answer": result.get("brief_answer", ""), "sub_queries": sub_queries}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Canonicalize Query
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
    "enhance":      _ENHANCE_SYSTEM,
    "canonicalize": _CANONICALIZE_SYSTEM,
}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Cache Lookup
# ═══════════════════════════════════════════════════════════════════════════════

async def cache_lookup(qdrant: AsyncQdrantClient, collection: str, query_vector: list[float],
                       tenant_id: str, threshold: float) -> dict | None:
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
# STEP 4 — Embed Texts
# ═══════════════════════════════════════════════════════════════════════════════

async def embed_texts(base_url: str, model: str, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    resp = await litellm.aembedding(model=model, input=texts, api_base=base_url)
    data = sorted(resp.data, key=lambda x: x.get("index", 0))
    return [item["embedding"] for item in data]


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 & 7 — Qdrant Semantic Search
# ═══════════════════════════════════════════════════════════════════════════════

async def qdrant_search(qdrant: AsyncQdrantClient, collection: str, query_vector: list[float],
                        tenant_id: str, limit: int, entities: list[str] | None = None,
                        intent: str | None = None) -> list[dict]:
    matching: list[MatchingPayload] = []
    if entities:
        matching.append(MatchingPayload(field="entities", values=entities))
    if intent:
        matching.append(MatchingPayload(field="intents", values=[intent]))

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
        return [{"point_id": str(pt.id), "score": pt.score, "payload": pt.payload or {}}
                for pt in resp.data]
    except Exception as exc:
        log.warning("qdrant_search | failed: %s", exc)
        return []


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Neo4j Graph Expansion
# ═══════════════════════════════════════════════════════════════════════════════

async def _neo4j_node_id(driver: AsyncDriver, block_id: str) -> str | None:
    async with driver.session() as session:
        result = await session.run(
            "MATCH (n) WHERE n.block_id = $block_id RETURN n.id AS node_id LIMIT 1",
            block_id=block_id,
        )
        record = await result.single()
    return record["node_id"] if record else None


_HOP_QUERIES: dict[int, LiteralString] = {
    1: "MATCH (s {id: $nid})-[*1..1]-(nb) WHERE nb.id <> $nid WITH DISTINCT nb LIMIT $lim RETURN nb{.*} AS node",
    2: "MATCH (s {id: $nid})-[*1..2]-(nb) WHERE nb.id <> $nid WITH DISTINCT nb LIMIT $lim RETURN nb{.*} AS node",
    3: "MATCH (s {id: $nid})-[*1..3]-(nb) WHERE nb.id <> $nid WITH DISTINCT nb LIMIT $lim RETURN nb{.*} AS node",
}


async def _neo4j_neighbours(driver: AsyncDriver, node_id: str, max_hops: int, max_neighbours: int) -> list[dict]:
    cypher = _HOP_QUERIES.get(max_hops, _HOP_QUERIES[1])
    async with driver.session() as session:
        result = await session.run(cypher, nid=node_id, lim=max_neighbours)
        return [r["node"] for r in await result.data()]


async def graph_expand(driver: AsyncDriver, top_hits: list[dict], max_hops: int, max_neighbours: int) -> list[str]:
    seen: set[str] = set()
    names: list[str] = []
    for hit in top_hits:
        block_id = str(hit.get("payload", {}).get("block_id", ""))
        if not block_id:
            continue
        try:
            node_id = await _neo4j_node_id(driver, block_id)
            if not node_id:
                continue
            for props in await _neo4j_neighbours(driver, node_id, max_hops, max_neighbours):
                for f in ("description", "name", "label", "title"):
                    val = props.get(f)
                    if isinstance(val, str) and val.strip() and val not in seen:
                        seen.add(val)
                        names.append(val)
        except Exception as exc:
            log.warning("graph_expand | block_id=%s: %s", block_id, exc)
    log.info("graph_expand | %d hits → %d entities", len(top_hits), len(names))
    return names


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8 — RRF Ranking
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
    merged = [{**meta[pid], "rrf_score": scores[pid], "rrf_rank": i}
              for i, pid in enumerate(sorted_ids[:top_n], start=1)]
    log.info("rrf | %d lists → %d unique → top %d", len(ranked_lists), len(scores), len(merged))
    return merged


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9 — Reranking
# ═══════════════════════════════════════════════════════════════════════════════

async def rerank(base_url: str, model: str, query: str, hits: list[dict], top_n: int) -> list[dict]:
    if not hits:
        return []
    documents = [h.get("payload", {}).get("summary", "") for h in hits]
    non_empty = [(i, d) for i, d in enumerate(documents) if d.strip()]
    if not non_empty:
        return hits[:top_n]
    indices, docs = zip(*non_empty)
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.post(
                f"{base_url}/rerank",
                json={"model": model, "query": query, "documents": list(docs), "top_n": min(top_n, len(docs))},
            )
            resp.raise_for_status()
        ranked = sorted(resp.json().get("results", []), key=lambda r: r.get("relevance_score", 0.0), reverse=True)
        return [{**hits[indices[r["index"]]], "rerank_score": r.get("relevance_score", 0.0), "rerank_rank": i}
                for i, r in enumerate(ranked[:top_n], start=1)]
    except Exception as exc:
        log.warning("rerank | failed: %s — using rrf order", exc)
        return hits[:top_n]


# ═══════════════════════════════════════════════════════════════════════════════
# ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════

class LightRAGPipeline:
    """Stateless pipeline — receives injected DB clients on every run() call."""

    async def run(
        self,
        query: str,
        tenant_id: str,
        qdrant: AsyncQdrantClient,
        neo4j: AsyncDriver,
        collection: str = cfg.QDRANT_COLLECTION,
    ) -> dict:
        # 1. Enhance
        enhanced = await enhance_query(cfg.LITELLM_BASE_URL, cfg.LLM_MODEL, query)
        sub_queries = enhanced["sub_queries"]

        # 2. Canonicalize
        canonical = await canonicalize(cfg.LITELLM_BASE_URL, cfg.LLM_MODEL, query)

        # 3. Cache lookup (embed query first)
        query_vecs = await embed_texts(cfg.LITELLM_BASE_URL, cfg.EMBEDDING_MODEL, [query])
        if query_vecs:
            hit = await cache_lookup(qdrant, cfg.QDRANT_CACHE_COLLECTION,
                                     query_vecs[0], tenant_id, cfg.CACHE_THRESHOLD)
            if hit:
                return {"source": "cache", "brief_answer": enhanced["brief_answer"],
                        "canonical": canonical, "results": [hit]}

        # 4. Embed sub-queries
        sub_vecs = await embed_texts(cfg.LITELLM_BASE_URL, cfg.EMBEDDING_MODEL, sub_queries)

        # 5. Qdrant pass 1 — entity + intent (any), LIMIT=3
        pass1: list[list[dict]] = list(await asyncio.gather(*[
            qdrant_search(qdrant, collection, vec, tenant_id,
                          limit=cfg.QDRANT_PASS1_LIMIT,
                          entities=canonical["entities"], intent=canonical["intent"])
            for vec in sub_vecs
        ]))

        # 6. Neo4j graph expansion from top-3 unique hits
        seen: set[str] = set()
        top3: list[dict] = []
        for hits in pass1:
            for h in hits:
                if h["point_id"] not in seen and len(top3) < 3:
                    seen.add(h["point_id"])
                    top3.append(h)
        neo4j_entities: list[str] = []
        if top3:
            try:
                neo4j_entities = await graph_expand(neo4j, top3,
                                                    cfg.NEO4J_MAX_HOPS, cfg.NEO4J_MAX_NEIGHBOURS)
            except Exception as exc:
                log.warning("run | graph_expand failed: %s", exc)

        # 7. Qdrant pass 2 — Neo4j entities (any), LIMIT=2
        pass2: list[list[dict]] = []
        if neo4j_entities:
            pass2 = list(await asyncio.gather(*[
                qdrant_search(qdrant, collection, vec, tenant_id,
                              limit=cfg.QDRANT_PASS2_LIMIT, entities=neo4j_entities)
                for vec in sub_vecs
            ]))

        # 8. RRF — merge per-query lists → top 10
        merged = [(pass1[i] if i < len(pass1) else []) + (pass2[i] if i < len(pass2) else [])
                  for i in range(len(sub_queries))]
        rrf_top = rrf_merge(merged, top_n=cfg.RRF_TOP_N)

        # 9. Rerank → top 5
        final = await rerank(cfg.LITELLM_BASE_URL, cfg.RERANKER_MODEL, query, rrf_top, cfg.RERANK_TOP_N)

        log.info("run | query=%r rrf=%d final=%d", query[:60], len(rrf_top), len(final))
        return {"source": "pipeline", "brief_answer": enhanced["brief_answer"],
                "canonical": canonical, "results": final}
