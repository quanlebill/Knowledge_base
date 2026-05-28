from __future__ import annotations

from typing import TypeVar, Generic
from pydantic import BaseModel

T = TypeVar("T")


class ResponseModel(BaseModel, Generic[T]):
    code: int = 200
    data: T | None = None
    error: str | None = None


def Success(data: T = None) -> ResponseModel[T]:
    return ResponseModel(data=data, error=None)


def Error(code: int, error: str) -> ResponseModel[None]:
    return ResponseModel(code=code, error=error)
