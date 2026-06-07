from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from basemodel.services_databaseconnector.postgres_model import (
    Language, SourceType, Document, Image, Video, Web, Warehouse,
    ReadJoinRequest, WhereFilter,
)
from app.dependencies.ui_context import get_ui_context, svc
from app.pipeline.ingestion import config as cfg
from app.pipeline.ingestion.bronze import BronzeUploadRequest

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pipeline/ingestion", tags=["Ingestion"])

_META_CLS = {
    SourceType.DOC:       Document,
    SourceType.WEB:       Web,
    SourceType.IMAGE:     Image,
    SourceType.VIDEO:     Video,
    SourceType.WAREHOUSE: Warehouse,
}


class PromoteResponse(BaseModel):
    data_id: str
    stage: str
    message: str


@router.post("/bronze")
async def ingest_bronze(
    request: Request,
    file: UploadFile = File(...),
    role_id: str = Form(...),
    abstract: str = Form(...),
    language: str = Form("english"),
    source_type: str = Form(...),
    doc_metadata: str = Form("{}"),
    ctx: dict = Depends(get_ui_context),
):
    file_bytes = await file.read()
    filename   = file.filename or "upload"
    extension  = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    try:
        src  = SourceType(source_type)
        lang = Language(language)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        meta_dict = json.loads(doc_metadata)
        meta_dict["source_type"] = src.value
        metadata_obj = _META_CLS[src](**meta_dict)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid doc_metadata: {e}")

    log.info("POST /ingestion/bronze tenant=%s source=%s size=%d", ctx["tenant_id"], src, len(file_bytes))
    try:
        return await svc(request, "ingestion").bronze(
            BronzeUploadRequest(
                tenant_id=ctx["tenant_id"],
                role_id=role_id,
                name=filename,
                extension=extension,
                language=lang.value,
                source_type=src.value,
                added_by=ctx["user_id"],
                abstract=abstract,
                doc_metadata=metadata_obj.model_dump(mode="json"),
                file_bytes=file_bytes,
                content_type=file.content_type or "application/octet-stream",
            ),
            svc(request, "minio").get_client(),
            svc(request, "postgres"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.exception("Bronze ingestion error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/promote/{data_id}/silver", response_model=PromoteResponse)
async def promote_to_silver(
    data_id: str,
    request: Request,
    ctx: dict = Depends(get_ui_context),
):
    postgres       = svc(request, "postgres")
    kafka_producer = svc(request, "kafka_producer")

    resp = await postgres.read(ReadJoinRequest(
        tenant_id=ctx["tenant_id"],
        joins_table=["KBData"],
        filters=[WhereFilter(table_name="KBData", column_name="data_id", value=data_id)],
        limit=1,
    ))
    if resp.code != 200 or not resp.data:
        raise HTTPException(status_code=404, detail=f"KBData not found: {data_id}")

    record = resp.data[0]
    log.info("POST /ingestion/promote/%s/silver tenant=%s", data_id, ctx["tenant_id"])

    try:
        await kafka_producer.produce(
            topic=cfg.KAFKA_SILVER_TOPIC,
            value={
                "event":       "promote_silver",
                "data_id":     data_id,
                "tenant_id":   ctx["tenant_id"],
                "source_type": record.get("source_type", "doc"),
                "extension":   record.get("extension", ""),
                "minio_path":  record.get("path", ""),
                "approved_by": ctx["user_id"],
            },
            key=data_id,
        )
    except Exception as e:
        log.exception("Kafka produce error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return PromoteResponse(
        data_id=data_id,
        stage="silver",
        message="Silver promotion queued — processing asynchronously",
    )


@router.post("/promote/{data_id}/gold", response_model=PromoteResponse)
async def promote_to_gold(
    data_id: str,
    request: Request,
    ctx: dict = Depends(get_ui_context),
):
    postgres       = svc(request, "postgres")
    kafka_producer = svc(request, "kafka_producer")

    resp = await postgres.read(ReadJoinRequest(
        tenant_id=ctx["tenant_id"],
        joins_table=["KBData"],
        filters=[WhereFilter(table_name="KBData", column_name="data_id", value=data_id)],
        limit=1,
    ))
    if resp.code != 200 or not resp.data:
        raise HTTPException(status_code=404, detail=f"KBData not found: {data_id}")

    record = resp.data[0]
    if record.get("current_tier") != "silver":
        raise HTTPException(
            status_code=409,
            detail=f"Asset is not in SILVER tier (current: {record.get('current_tier')})",
        )

    log.info("POST /ingestion/promote/%s/gold tenant=%s", data_id, ctx["tenant_id"])

    try:
        await kafka_producer.produce(
            topic=cfg.KAFKA_GOLD_TOPIC,
            value={
                "event":               "promote_gold",
                "data_id":             data_id,
                "tenant_id":           ctx["tenant_id"],
                "neo4j_connection_id": record.get("neo4j_connection_id", ""),
                "approved_by":         ctx["user_id"],
            },
            key=data_id,
        )
    except Exception as e:
        log.exception("Kafka produce error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return PromoteResponse(
        data_id=data_id,
        stage="gold",
        message="Gold promotion queued — processing asynchronously",
    )
