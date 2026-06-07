"""
/api/data/* — document list, promote, delete.
These are the primary routes consumed by AppStateContext and AssetInventory.
"""
from fastapi import APIRouter, Depends, HTTPException, Request

from basemodel.services_databaseconnector.shared_model import ResponseModel
from basemodel.UI_model.data import RequestUpdateDocument
from app.dependencies.ui_context import get_ui_context, svc
from app.pipeline.kb_ui_operation.document_ops import (
    fetch_one, list_documents, promote_document, delete_document,
)

router = APIRouter(prefix="/api/data", tags=["Data"])


@router.get("/documents", response_model=ResponseModel)
async def list_documents_route(request: Request, ctx: dict = Depends(get_ui_context)):
    result = await list_documents(
        postgres=svc(request, "postgres"),
        tenant_id=ctx["tenant_id"],
    )
    return ResponseModel(code=200, data=result)


@router.patch("/documents/{data_id}", response_model=ResponseModel)
async def promote_document_route(
    data_id: str,
    body: RequestUpdateDocument,
    request: Request,
    ctx: dict = Depends(get_ui_context),
):
    postgres = svc(request, "postgres")
    record = await fetch_one(postgres, data_id, ctx["tenant_id"])
    if not record:
        return ResponseModel(code=404, error=f"Document not found: {data_id}")
    result = await promote_document(
        postgres=postgres,
        kafka_producer=svc(request, "kafka_producer"),
        data_id=data_id,
        target=body.layer.upper() if body.layer else "",
        status=body.status or "",
        ctx=ctx,
        record=record,
    )
    return ResponseModel(code=200, data=result)


@router.delete("/documents/{data_id}", response_model=ResponseModel)
async def delete_document_route(
    data_id: str,
    request: Request,
    ctx: dict = Depends(get_ui_context),
):
    postgres = svc(request, "postgres")
    record = await fetch_one(postgres, data_id, ctx["tenant_id"])
    if not record:
        return ResponseModel(code=404, error=f"Document not found: {data_id}")
    await delete_document(
        postgres=postgres,
        data_id=data_id,
        tenant_id=ctx["tenant_id"],
        record=record,
    )
    return ResponseModel(code=200, data=None)
