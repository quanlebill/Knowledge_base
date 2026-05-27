import json
from typing import Any


def to_string(v) -> str:
    return str(v) if v is not None else ""


def handle_response(res) -> Any:
    if res.code >= 400:
        raise ValueError(res.error or f"DB error {res.code}")
    return res.data if res.data is not None else []


def parse_jsonb(v) -> dict:
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return {}
    return v or {}
