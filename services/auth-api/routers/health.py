from fastapi import APIRouter

from auth_core import *
from schemas import *

router = APIRouter()


@router.get("/api/auth/health")
def health():
    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
# IP ALLOWLIST CONFIG (allow_all toggle)
