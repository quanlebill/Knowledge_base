from fastapi import APIRouter, Request

from runtime_services.conversation_runner import run_conversation_stream
from schemas import RunRequest

router = APIRouter()


@router.post("/api/conversations/run")
async def run_conversation(req: RunRequest, request: Request):
    return await run_conversation_stream(req, request)
