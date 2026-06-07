"""/api/knowledge/conflicts — ConflictWorkspace data."""
from fastapi import APIRouter, Depends, Request

from basemodel.services_databaseconnector.shared_model import ResponseModel
from basemodel.UI_model.conflict import RequestResolveConflict
from app.dependencies.ui_context import get_ui_context, svc
from app.pipeline.kb_ui_operation.conflict_ops import (
    list_conflicts, get_conflict, resolve_conflict,
)

router = APIRouter(prefix="/api/knowledge/conflicts", tags=["Knowledge-Conflicts"])


@router.get("", response_model=ResponseModel)
async def list_conflicts_route(request: Request, ctx: dict = Depends(get_ui_context)):
    result = await list_conflicts(
        postgres=svc(request, "postgres"),
        tenant_id=ctx["tenant_id"],
    )
    return ResponseModel(code=200, data=result)


@router.get("/{conflict_id}", response_model=ResponseModel)
async def get_conflict_route(
    conflict_id: str, request: Request, ctx: dict = Depends(get_ui_context),
):
    result = await get_conflict(
        postgres=svc(request, "postgres"),
        conflict_id=conflict_id,
        tenant_id=ctx["tenant_id"],
    )
    return ResponseModel(code=200, data=result)


@router.patch("/{conflict_id}", response_model=ResponseModel)
async def resolve_conflict_route(
    conflict_id: str, body: RequestResolveConflict,
    request: Request, ctx: dict = Depends(get_ui_context),
):
    result = await resolve_conflict(
        postgres=svc(request, "postgres"),
        conflict_id=conflict_id,
        method=body.selected_resolution_method,
        instruction=body.resolution_instruction or "",
        user_id=ctx["user_id"],
    )
    return ResponseModel(code=200, data=result)
