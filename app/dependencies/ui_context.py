"""Shared FastAPI dependencies for UI-facing routes."""
from fastapi import Header, HTTPException, Request


def get_ui_context(
    x_role:      str = Header(default="AI_ENGINEER", alias="X-Role"),
    x_tenant_id: str = Header(default="",            alias="X-Tenant-Id"),
    x_user_id:   str = Header(default="dev-user",    alias="X-User-Id"),
) -> dict:
    """
    Lenient context for UI-facing routes.
    In production Kong injects X-Tenant-Id / X-User-Id.
    In development the UI only sends X-Role — defaults are used for the rest.
    """
    return {"role": x_role, "tenant_id": x_tenant_id or None, "user_id": x_user_id}


def svc(request: Request, name: str):
    obj = getattr(request.app.state, name, None)
    if obj is None:
        raise HTTPException(status_code=503, detail=f"Service '{name}' not initialised")
    return obj
