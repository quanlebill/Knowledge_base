from fastapi import APIRouter

from runtime_services.langfuse_proxy import get_trace_observations

router = APIRouter()


@router.get("/api/traces/{conv_id}")
async def get_traces_by_conv(conv_id: str):
    return await get_trace_observations(conv_id)
