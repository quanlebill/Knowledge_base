import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import asyncpg
from pydantic import ValidationError

from services.database_connector.db_config import DBConfig
from services.database_connector.response_model import ResponseModel, Success, Error
from .input_schema.join import ReadJoinRequest
from .input_schema.create import (
    KBModelCreate, KBModelVersionCreate, KBDataCreate, KBLifecycleHistoryCreate,
    KBFilterPolicyCreate, KBExtractionPolicyCreate,
    KBConflictBatchCreate, KBConflictCreate,
    KBWarehouseCreate, KBWarehouseConfigCreate, KBTableCreate,
    KBTextBlockCreate, KBTextBlockVersionCreate, KBTextTableCreate,
    KBQdrantConnectionCreate, KBQdrantCollectionCreate,
    KBNeo4jConnectionCreate, KBNeo4jNodeCreate, KBNeo4jRelationshipCreate,
    KBEntityLookupCreate, KBPublishAPICreate,
)
from .input_schema.update import (
    KBModelUpdate, KBModelVersionUpdate, KBDataUpdate, KBLifecycleHistoryUpdate,
    KBFilterPolicyUpdate, KBExtractionPolicyUpdate,
    KBConflictBatchUpdate, KBConflictUpdate,
    KBWarehouseUpdate, KBWarehouseConfigUpdate, KBTableUpdate,
    KBTextBlockUpdate, KBTextBlockVersionUpdate, KBTextTableUpdate,
    KBQdrantConnectionUpdate, KBQdrantCollectionUpdate,
    KBNeo4jConnectionUpdate, KBNeo4jNodeUpdate, KBNeo4jRelationshipUpdate,
    KBEntityLookupUpdate, KBPublishAPIUpdate,
)
from .input_schema.read import (
    KBModelRead, KBModelVersionRead, KBDataRead, KBLifecycleHistoryRead,
    KBFilterPolicyRead, KBExtractionPolicyRead,
    KBConflictBatchRead, KBConflictRead,
    KBWarehouseRead, KBWarehouseConfigRead, KBTableRead,
    KBTextBlockRead, KBTextBlockVersionRead, KBTextTableRead,
    KBQdrantConnectionRead, KBQdrantCollectionRead,
    KBNeo4jConnectionRead, KBNeo4jNodeRead, KBNeo4jRelationshipRead,
    KBEntityLookupRead, KBPublishAPIRead,
)
from .input_schema.delete import (
    KBModelDelete, KBModelVersionDelete, KBDataDelete, KBLifecycleHistoryDelete,
    KBFilterPolicyDelete, KBExtractionPolicyDelete,
    KBConflictBatchDelete, KBConflictDelete,
    KBWarehouseDelete, KBWarehouseConfigDelete, KBTableDelete,
    KBTextBlockDelete, KBTextBlockVersionDelete, KBTextTableDelete,
    KBQdrantConnectionDelete, KBQdrantCollectionDelete,
    KBNeo4jConnectionDelete, KBNeo4jNodeDelete, KBNeo4jRelationshipDelete,
    KBEntityLookupDelete, KBPublishAPIDelete,
)

# ── Pool ──────────────────────────────────────────────────────────────────────

_pool: asyncpg.Pool | None = None


async def _init_conn(conn: asyncpg.Connection) -> None:
    for pg_type in ("json", "jsonb"):
        await conn.set_type_codec(
            pg_type,
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )


async def pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DBConfig.postgres_url(), setup=_init_conn)
    return _pool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _json(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, default=str)


def _rows(records) -> list[dict]:
    return [dict(r) for r in records]


# ── Table registry ────────────────────────────────────────────────────────────

@dataclass
class TableConfig:
    table: str
    pk: list[str]
    # "uuid"     — client generates uuid4() for each pk col
    # "serial"   — DB generates via SERIAL; use RETURNING on insert
    # "provided" — pk col(s) come from the create payload as-is
    pk_strategy: str
    create: type
    update: type
    read: type
    delete: type
    json_fields: list[str] = field(default_factory=list)
    ts_create: str | None = None   # column set to NOW() on INSERT
    order_by: str | None = None    # default ORDER BY for SELECT


TABLE_REGISTRY: dict[str, TableConfig] = {
    "KBModel": TableConfig(
        table="KBModel", pk=["model_id"], pk_strategy="uuid",
        json_fields=[],
        create=KBModelCreate, update=KBModelUpdate,
        read=KBModelRead, delete=KBModelDelete,
    ),
    "KBModelVersion": TableConfig(
        table="KBModelVersion", pk=["version_id"], pk_strategy="serial",
        json_fields=["config"], ts_create="added_on",
        create=KBModelVersionCreate, update=KBModelVersionUpdate,
        read=KBModelVersionRead, delete=KBModelVersionDelete,
        order_by="version_number",
    ),
    "KBData": TableConfig(
        table="KBData", pk=["data_id"], pk_strategy="uuid",
        json_fields=["metadata"], ts_create="added_on",
        create=KBDataCreate, update=KBDataUpdate,
        read=KBDataRead, delete=KBDataDelete,
    ),
    "KBLifecycleHistory": TableConfig(
        table="KBLifecycleHistory", pk=["history_id"], pk_strategy="uuid",
        json_fields=[], ts_create="transitioned_at",
        create=KBLifecycleHistoryCreate, update=KBLifecycleHistoryUpdate,
        read=KBLifecycleHistoryRead, delete=KBLifecycleHistoryDelete,
        order_by="transitioned_at",
    ),
    "KBFilterPolicy": TableConfig(
        table="KBFilterPolicy", pk=["policy_id"], pk_strategy="uuid",
        json_fields=["config"], ts_create="created_at",
        create=KBFilterPolicyCreate, update=KBFilterPolicyUpdate,
        read=KBFilterPolicyRead, delete=KBFilterPolicyDelete,
    ),
    "KBExtractionPolicy": TableConfig(
        table="KBExtractionPolicy", pk=["policy_id"], pk_strategy="uuid",
        json_fields=[], ts_create="created_at",
        create=KBExtractionPolicyCreate, update=KBExtractionPolicyUpdate,
        read=KBExtractionPolicyRead, delete=KBExtractionPolicyDelete,
    ),
    "KBConflictBatch": TableConfig(
        table="KBConflictBatch", pk=["batch_id"], pk_strategy="uuid",
        json_fields=[], ts_create="created_at",
        create=KBConflictBatchCreate, update=KBConflictBatchUpdate,
        read=KBConflictBatchRead, delete=KBConflictBatchDelete,
        order_by="created_at DESC",
    ),
    "KBConflict": TableConfig(
        table="KBConflict", pk=["conflict_id"], pk_strategy="uuid",
        json_fields=["existing_snapshot", "incoming_snapshot"], ts_create="detected_at",
        create=KBConflictCreate, update=KBConflictUpdate,
        read=KBConflictRead, delete=KBConflictDelete,
        order_by="detected_at DESC",
    ),
    "KBWarehouse": TableConfig(
        table="KBWarehouse", pk=["warehouse_id"], pk_strategy="uuid",
        json_fields=[],
        create=KBWarehouseCreate, update=KBWarehouseUpdate,
        read=KBWarehouseRead, delete=KBWarehouseDelete,
        order_by="service",
    ),
    "KBWarehouse_Config": TableConfig(
        table="KBWarehouse_Config", pk=["config_id"], pk_strategy="uuid",
        json_fields=["config"], ts_create="created_at",
        create=KBWarehouseConfigCreate, update=KBWarehouseConfigUpdate,
        read=KBWarehouseConfigRead, delete=KBWarehouseConfigDelete,
        order_by="version_number",
    ),
    "KBTable": TableConfig(
        table="KBTable", pk=["table_id"], pk_strategy="uuid",
        json_fields=["schema"], ts_create="created_on",
        create=KBTableCreate, update=KBTableUpdate,
        read=KBTableRead, delete=KBTableDelete,
        order_by="table_name",
    ),
    "KBTextBlock": TableConfig(
        table="KBTextBlock", pk=["block_id"], pk_strategy="uuid",
        json_fields=[],
        create=KBTextBlockCreate, update=KBTextBlockUpdate,
        read=KBTextBlockRead, delete=KBTextBlockDelete,
        order_by="block_index",
    ),
    "KBTextBlockVersion": TableConfig(
        table="KBTextBlockVersion", pk=["version_id"], pk_strategy="uuid",
        json_fields=["payload"], ts_create="created_at",
        create=KBTextBlockVersionCreate, update=KBTextBlockVersionUpdate,
        read=KBTextBlockVersionRead, delete=KBTextBlockVersionDelete,
        order_by="version_number",
    ),
    "KBTextTable": TableConfig(
        table="KBTextTable", pk=["version_id"], pk_strategy="provided",
        json_fields=["data"],
        create=KBTextTableCreate, update=KBTextTableUpdate,
        read=KBTextTableRead, delete=KBTextTableDelete,
    ),
    "KBQdrantConnection": TableConfig(
        table="KBQdrantConnection", pk=["connection_id"], pk_strategy="uuid",
        json_fields=[], ts_create="created_at",
        create=KBQdrantConnectionCreate, update=KBQdrantConnectionUpdate,
        read=KBQdrantConnectionRead, delete=KBQdrantConnectionDelete,
    ),
    "KBQdrantCollection": TableConfig(
        table="KBQdrantCollection", pk=["collection_id"], pk_strategy="uuid",
        json_fields=[],
        create=KBQdrantCollectionCreate, update=KBQdrantCollectionUpdate,
        read=KBQdrantCollectionRead, delete=KBQdrantCollectionDelete,
        order_by="collection_name",
    ),
    "KBNeo4jConnection": TableConfig(
        table="KBNeo4jConnection", pk=["connection_id"], pk_strategy="uuid",
        json_fields=[], ts_create="created_at",
        create=KBNeo4jConnectionCreate, update=KBNeo4jConnectionUpdate,
        read=KBNeo4jConnectionRead, delete=KBNeo4jConnectionDelete,
    ),
    "KBNeo4jNode": TableConfig(
        table="KBNeo4jNode", pk=["node_id"], pk_strategy="uuid",
        json_fields=[], ts_create="inserted_at",
        create=KBNeo4jNodeCreate, update=KBNeo4jNodeUpdate,
        read=KBNeo4jNodeRead, delete=KBNeo4jNodeDelete,
        order_by="node_name",
    ),
    "KBNeo4jRelationship": TableConfig(
        table="KBNeo4jRelationship", pk=["from_node", "to_node"], pk_strategy="provided",
        json_fields=[],
        create=KBNeo4jRelationshipCreate, update=KBNeo4jRelationshipUpdate,
        read=KBNeo4jRelationshipRead, delete=KBNeo4jRelationshipDelete,
    ),
    "KBEntityLookup": TableConfig(
        table="KBEntityLookup", pk=["lookup_id"], pk_strategy="uuid",
        json_fields=[], ts_create="created_at",
        create=KBEntityLookupCreate, update=KBEntityLookupUpdate,
        read=KBEntityLookupRead, delete=KBEntityLookupDelete,
    ),
    "KBPublishAPI": TableConfig(
        table="KBPublishAPI", pk=["id"], pk_strategy="uuid",
        json_fields=[],
        create=KBPublishAPICreate, update=KBPublishAPIUpdate,
        read=KBPublishAPIRead, delete=KBPublishAPIDelete,
    ),
}


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def create(table_name: str, data: dict) -> ResponseModel:
    cfg = TABLE_REGISTRY.get(table_name)
    if cfg is None:
        return Error(code=400, error=f"Unknown table: {table_name}")

    try:
        validated = cfg.create.model_validate(data)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    row: dict[str, Any] = validated.model_dump()

    if cfg.pk_strategy == "uuid":
        for col in cfg.pk:
            if row.get(col) is None:
                row[col] = uuid.uuid4()

    if cfg.ts_create:
        row[cfg.ts_create] = _now()

    for f in cfg.json_fields:
        if f in row:
            row[f] = _json(row[f])

    if cfg.pk_strategy == "serial":
        # Exclude PK column(s) — DB generates them via SERIAL
        insert_row = {k: v for k, v in row.items() if k not in cfg.pk}
        cols = list(insert_row.keys())
        placeholders = [f"${i + 1}" for i in range(len(cols))]
        values = [insert_row[c] for c in cols]
        sql = (
            f"INSERT INTO {cfg.table} ({', '.join(cols)}) "
            f"VALUES ({', '.join(placeholders)}) "
            f"RETURNING {cfg.pk[0]}"
        )
        p = await pool()
        async with p.acquire() as conn:
            result_row = await conn.fetchrow(sql, *values)
        return Success(data={cfg.pk[0]: result_row[cfg.pk[0]]})

    # uuid / provided strategies: all pk cols are already in row
    cols = list(row.keys())
    placeholders = [f"${i + 1}" for i in range(len(cols))]
    values = [row[c] for c in cols]
    sql = (
        f"INSERT INTO {cfg.table} ({', '.join(cols)}) "
        f"VALUES ({', '.join(placeholders)})"
    )
    p = await pool()
    async with p.acquire() as conn:
        try:
            await conn.execute(sql, *values)
        except asyncpg.UniqueViolationError:
            return Error(code=409, error=f"Record already exists in {table_name}")

    return Success(data={col: str(row[col]) for col in cfg.pk if row.get(col) is not None})


async def read(table_name: str, filters: dict) -> ResponseModel:
    cfg = TABLE_REGISTRY.get(table_name)
    if cfg is None:
        return Error(code=400, error=f"Unknown table: {table_name}")

    try:
        validated = cfg.read.model_validate(filters)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    all_fields = validated.model_dump()
    limit = all_fields.pop("limit", None)
    offset = all_fields.pop("offset", 0)

    filter_fields = {k: v for k, v in all_fields.items() if v is not None}
    params: list[Any] = list(filter_fields.values())

    where_clause = ""
    if filter_fields:
        where_parts = [f"{k} = ${i + 1}" for i, k in enumerate(filter_fields)]
        where_clause = f"WHERE {' AND '.join(where_parts)}"

    order_clause = f"ORDER BY {cfg.order_by}" if cfg.order_by else ""

    limit_clause = ""
    if limit is not None:
        lo_start = len(params) + 1
        params += [limit, offset]
        limit_clause = f"LIMIT ${lo_start} OFFSET ${lo_start + 1}"

    sql = " ".join(
        part for part in
        [f"SELECT * FROM {cfg.table}", where_clause, order_clause, limit_clause]
        if part
    )

    p = await pool()
    async with p.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return Success(data=_rows(rows))


async def update(table_name: str, data: dict) -> ResponseModel:
    cfg = TABLE_REGISTRY.get(table_name)
    if cfg is None:
        return Error(code=400, error=f"Unknown table: {table_name}")

    try:
        validated = cfg.update.model_validate(data)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    all_fields = validated.model_dump(exclude_none=True)

    pk_values = {k: all_fields.pop(k) for k in cfg.pk if k in all_fields}
    if len(pk_values) != len(cfg.pk):
        return Error(code=422, error=f"Missing primary key field(s): {cfg.pk}")

    update_fields = all_fields
    if not update_fields:
        return Error(code=400, error="No fields to update")

    for f in cfg.json_fields:
        if f in update_fields:
            update_fields[f] = _json(update_fields[f])

    pk_count = len(cfg.pk)
    where_clause = " AND ".join(f"{k} = ${i + 1}" for i, k in enumerate(cfg.pk))
    set_clause = ", ".join(
        f"{k} = ${pk_count + i + 1}" for i, k in enumerate(update_fields)
    )
    params = [pk_values[k] for k in cfg.pk] + list(update_fields.values())

    sql = f"UPDATE {cfg.table} SET {set_clause} WHERE {where_clause}"

    p = await pool()
    async with p.acquire() as conn:
        result = await conn.execute(sql, *params)

    if result == "UPDATE 0":
        return Error(code=404, error=f"Record not found in {table_name}")
    return Success()


async def delete(table_name: str, data: dict) -> ResponseModel:
    cfg = TABLE_REGISTRY.get(table_name)
    if cfg is None:
        return Error(code=400, error=f"Unknown table: {table_name}")

    try:
        validated = cfg.delete.model_validate(data)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    pk_fields = validated.model_dump()
    where_clause = " AND ".join(f"{k} = ${i + 1}" for i, k in enumerate(pk_fields))
    params = list(pk_fields.values())

    sql = f"DELETE FROM {cfg.table} WHERE {where_clause}"

    p = await pool()
    async with p.acquire() as conn:
        result = await conn.execute(sql, *params)

    if result == "DELETE 0":
        return Error(code=404, error=f"Record not found in {table_name}")
    return Success()


# ── Join read ─────────────────────────────────────────────────────────────────

async def read_join(request: dict) -> ResponseModel:
    try:
        validated = ReadJoinRequest.model_validate(request)
    except ValidationError as e:
        return Error(code=422, error=str(e))

    # Validate all table names exist in the registry
    unknown = [t for t in validated.joins_table if t not in TABLE_REGISTRY]
    if unknown:
        return Error(code=400, error=f"Unknown table(s): {unknown}")

    base_table = validated.joins_table[0]

    # ── SELECT clause ─────────────────────────────────────────────────────────
    select_parts: list[str] = []
    for col in validated.selected_columns:
        qualified = f"{col.table_name}.{col.column_name}"
        label = col.alias or f"{col.table_name}__{col.column_name}"
        select_parts.append(f'{qualified} AS "{label}"')

    # ── JOIN clauses ──────────────────────────────────────────────────────────
    join_parts: list[str] = []
    for i, join_table in enumerate(validated.joins_table[1:]):
        on = validated.join_on[i]
        join_parts.append(
            f"{on.join_type} JOIN {join_table} "
            f"ON {on.left_table}.{on.left_column} = {on.right_table}.{on.right_column}"
        )

    # ── WHERE clause ──────────────────────────────────────────────────────────
    params: list[Any] = []
    where_parts: list[str] = []
    for f in validated.filters:
        params.append(f.value)
        where_parts.append(f"{f.table_name}.{f.column_name} = ${len(params)}")

    where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    # ── ORDER BY / LIMIT / OFFSET ─────────────────────────────────────────────
    order_clause = f"ORDER BY {validated.order_by}" if validated.order_by else ""

    lo_start = len(params) + 1
    params += [validated.limit, validated.offset]
    limit_clause = f"LIMIT ${lo_start} OFFSET ${lo_start + 1}"

    sql = " ".join(
        part for part in [
            f"SELECT {', '.join(select_parts)}",
            f"FROM {base_table}",
            *join_parts,
            where_clause,
            order_clause,
            limit_clause,
        ]
        if part
    )

    p = await pool()
    async with p.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return Success(data=_rows(rows))
