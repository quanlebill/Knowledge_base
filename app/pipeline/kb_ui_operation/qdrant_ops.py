"""Business logic for Qdrant collection management and semantic search."""
import logging
import httpx
from fastapi import HTTPException
from sqlalchemy import update as sa_update

from basemodel.services_databaseconnector.postgres_model import ReadJoinRequest
from basemodel.services_databaseconnector.postgres_orm.knowledge_base_orm import KBQdrantCollectionORM
from basemodel.services_databaseconnector.qdrant_model import SearchRequest, MatchType
from services.database_connector.qdrant_connector import vector_search as qdrant_vector_search
from services.parse_for_ui.mappers import to_string

log = logging.getLogger(__name__)


def _to_qcollection(row: dict) -> dict:
    return {
        "id":              to_string(row.get("collection_id")),
        "name":            row.get("collection_name", ""),
        "points":          row.get("points_count", 0),
        "active":          bool(row.get("is_active", False)),
        "dimensions":      row.get("vector_dimension") or 0,
        "distance":        row.get("similarity_metric", "cosine"),
        "indexed":         row.get("points_count", 0),
        "embedding_model": to_string(row.get("embedding_model_id", "")),
    }


async def _live_collections(qdrant) -> list:
    try:
        result = await qdrant.get_client().get_collections()
        return [
            {
                "id":         c.name,
                "name":       c.name,
                "points":     0,
                "active":     True,
                "dimensions": 0,
                "distance":   "cosine",
                "indexed":    0,
            }
            for c in result.collections
        ]
    except Exception as e:
        log.warning("qdrant_ops: live collection fallback failed: %s", e)
        return []


async def list_collections(postgres, qdrant, tenant_id: str | None) -> list:
    resp = await postgres.read(ReadJoinRequest(
        tenant_id=tenant_id,
        joins_table=["KBQdrantConnection", "KBQdrantCollection"],
        limit=100,
    ))
    if resp.code != 200:
        return await _live_collections(qdrant)
    return [_to_qcollection(r) for r in (resp.data or [])]


async def toggle_collection(postgres, collection_id: str, is_active: bool) -> dict:
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBQdrantCollectionORM)
            .where(KBQdrantCollectionORM.collection_id == collection_id)
            .values(is_active=is_active)
        )
        await session.commit()
    return {"collection_id": collection_id, "active": is_active}


async def semantic_search(
    qdrant,
    collection_id: str,
    query: str,
    tenant_id: str,
    limit: int,
    litellm_base_url: str,
    embedding_model: str,
) -> list:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            emb_resp = await client.post(
                f"{litellm_base_url}/v1/embeddings",
                json={"model": embedding_model, "input": query},
            )
            emb_resp.raise_for_status()
            vector = emb_resp.json()["data"][0]["embedding"]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Embedding failed: {e}")

    search_resp = await qdrant_vector_search(qdrant.get_client(), SearchRequest(
        collection_name=collection_id,
        tenant_id=tenant_id,
        query_vector=vector,
        matching_payload=[],
        match_type=MatchType.must,
        limit=limit,
    ))
    if search_resp.code != 200:
        raise HTTPException(status_code=500, detail=search_resp.error)

    return [
        {
            "point_id": str(getattr(hit, "id", "")),
            "score":    round(getattr(hit, "score", 0.0), 4),
            "summary":  (getattr(hit, "payload", {}) or {}).get("summary", ""),
            "entities": (getattr(hit, "payload", {}) or {}).get("entities", []),
            "intent":   (getattr(hit, "payload", {}) or {}).get("intents", []),
        }
        for hit in (search_resp.data or [])
    ]
