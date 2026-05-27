from pydantic import BaseModel
from typing import Optional, Any


class ResponseModel(BaseModel):
    code: int = 200
    data: Any | None = None
    error: str | None = None

def Success(data = None) -> ResponseModel:
    return ResponseModel(data=data, error=None)

def Error(code, error) -> ResponseModel:
    return ResponseModel(code = code, error=error)
