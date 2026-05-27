_CONFLICT_TYPE_DISPLAY: dict[str, str] = {
    "content_contradiction": "Content Contradiction",
    "content_conflict": "Content Conflict",
    "content_duplicate": "Content Duplicate",
    "content_update": "Content Update",
    "table_schema": "Table Schema",
}
_SEVERITY_DISPLAY: dict[str, str] = {"high": "High", "medium": "Medium", "low": "Low"}


def map_conflict_type(v: str) -> str:
    return _CONFLICT_TYPE_DISPLAY.get(v, v)


def map_severity(v: str) -> str:
    return _SEVERITY_DISPLAY.get(v, v)
