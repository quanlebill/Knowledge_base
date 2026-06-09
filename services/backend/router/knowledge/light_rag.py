from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from services.backend.dependencies.ui_context import get_ui_context, svc
from services.backend.pipeline.light_rag import config as cfg

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pipeline/light-rag", tags=["LightRAG"])


class RetrieveRequest(BaseModel):
    query: str
    tenant_id: str = ""
    collection: str = cfg.QDRANT_COLLECTION


class RetrieveResponse(BaseModel):
    source: str
    canonical: dict[str, Any]
    results: list[dict[str, Any]]


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(
    body: RetrieveRequest,
    request: Request,
    ctx: dict = Depends(get_ui_context),
):
    tenant_id = body.tenant_id or ctx["tenant_id"] or "default"
    log.info("POST /retrieve | query=%r tenant=%s", body.query[:80], tenant_id)
    try:
        return await svc(request, "light_rag").run(
            query=body.query,
            tenant_id=tenant_id,
            qdrant=svc(request, "qdrant").get_client(),
            neo4j=svc(request, "neo4j").get_client(),
            model=svc(request, "model").get_client(),
            postgres=svc(request, "postgres"),   # PostgresClient — not a session
            collection=body.collection,
        )
    except Exception as exc:
        log.exception("light_rag | unhandled error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/health")
async def health(request: Request, ctx: dict = Depends(get_ui_context)):
    pipeline = getattr(request.app.state, "light_rag", None)
    return {"status": "ok" if pipeline else "not_initialised"}
