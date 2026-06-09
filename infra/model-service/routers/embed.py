from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models import get_embed, is_ready

router = APIRouter()


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


@router.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    if not is_ready():
        raise HTTPException(503, "Model not loaded")
    if not req.texts:
        return EmbedResponse(embeddings=[])
    vecs = get_embed().encode(req.texts, normalize_embeddings=True)
    return EmbedResponse(embeddings=vecs.tolist())
