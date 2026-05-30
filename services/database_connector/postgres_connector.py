import asyncio
import json
import uuid
from dataclasses import dataclass
from typing import Any

import asyncpg
from pydantic import BaseModel
from sqlalchemy.dialects.postgresql import JSONB

from services.database_connector.db_config import DBConfig
from services.database_connector.response_model import ResponseModel
from services.log_set_up import create_logger
from basemodel.services_databaseconnector.shared_model import RetryNumber, HealthCheckLoopConfig
from basemodel.services_databaseconnector.postgres_model import (
    REGISTRY, MODEL_TO_TABLE, ReadJoinRequest,
)

log = create_logger("services.postgres", "service_postgres")



class PostgresClient:
    __slots__ = (
        "_client", "_connection_wait", "_healthy",
        "_connected", "_timeout", "_timeout_incremental", "_url",
    )

    def __init__(self):
        self._client: asyncpg.Pool | None = None
        self._timeout: int = 10
        self._timeout_incremental: int = 1
        self._connection_wait: int = 5
        self._healthy: bool = False
        self._connected: bool = False
        self._url: str | None = None

    async def open(self, retry: RetryNumber | None = RetryNumber()) -> None:
        for attempt in range(retry.count):
            try:
                self._client = asyncpg.create_pool(
                    self._url or DBConfig.postgres_url(),
                    setup=_init_conn,
                )
                self._connected = True
                self._healthy = True
                return
            except asyncpg.InvalidCatalogNameError as e:
                raise ConnectionError(str(e)) from e
            except (
                OSError,
                asyncpg.CannotConnectNowError,
                asyncpg.TooManyConnectionsError,
            ):
                if attempt < retry.count - 1:
                    await asyncio.sleep(self._connection_wait)
        raise ConnectionError(f"Could not connect to Postgres after {retry.count} attempts")

    async def close(self) -> None:
        if self._client:
            try:
                await self._client.close()
            except Exception as e:
                log.info(f"Postgres pool close error (ignored): {e}")
            finally:
                self._client = None
        self._connected = False
        self._healthy = False

    async def health_check_loop(self, config: HealthCheckLoopConfig | None = None) -> None:
        config = config or HealthCheckLoopConfig()
        log.info("Postgres health check loop started")
        while True:
            try:
                if self._client is None:
                    log.info("Postgres client is None — attempting reconnect")
                    await self.open()

                async with self._client.acquire(timeout=config.timeout_for_health_check) as conn:
                    await conn.execute("SELECT 1")

                self._healthy = True
                log.info("Postgres health check succeeded")

            except asyncio.TimeoutError:
                self._healthy = False
                log.info("Postgres health check failed: timed out")

            except (OSError, asyncpg.PostgresConnectionError) as e:
                self._healthy = False
                self._client = None
                log.info(f"Postgres health check failed: connection lost — {e}")

            await asyncio.sleep(config.interval)

    def is_healthy(self) -> bool:
        return self._healthy

    def is_connected(self) -> bool:
        return self._connected

    def get_client(self) -> asyncpg.Pool:
        if self._client is None:
            raise RuntimeError("PostgresClient is not open — call open() first")
        return self._client

    def set_url(self, url: str) -> None:
        self._url = url


# ── Connection setup ──────────────────────────────────────────────────────────

async def _init_conn(conn: asyncpg.Connection) -> None:
    for pg_type in ("json", "jsonb"):
        await conn.set_type_codec(
            pg_type,
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )


# ── ORM introspection ─────────────────────────────────────────────────────────

def _pk_cols(orm_cls) -> list[str]:
    return [col.name for col in orm_cls.__table__.primary_key]


def _pk_strategy(orm_cls) -> str:
    pk = list(orm_cls.__table__.primary_key)
    if len(pk) > 1:
        return "provided"
    col = pk[0]
    if col.autoincrement is True:
        return "serial"
    if col.default is not None:
        return "uuid"
    return "provided"


def _json_cols(orm_cls) -> list[str]:
    return [col.name for col in orm_cls.__table__.columns if isinstance(col.type, JSONB)]


def _server_default_cols(orm_cls) -> set[str]:
    return {col.name for col in orm_cls.__table__.columns if col.server_default is not None}


# ── Prepared query types ──────────────────────────────────────────────────────

@dataclass
class _CreateQuery:
    sql: str
    params: list[Any]
    is_serial: bool
    pks: list[str]
    row: dict[str, Any]
    table_name: str


@dataclass
class _Query:
    sql: str
    params: list[Any]


# ── Helper functions ──────────────────────────────────────────────────────────

def _resolve(model: BaseModel) -> tuple[str, Any] | ResponseModel:
    table_name = MODEL_TO_TABLE.get(type(model))
    if table_name is None:
        return ResponseModel(code=400, error=f"Unregistered model: {type(model).__name__}")
    return table_name, REGISTRY[table_name].orm


def _prepare_create(data: BaseModel) -> _CreateQuery | ResponseModel:
    resolved = _resolve(data)
    if isinstance(resolved, ResponseModel):
        return resolved
    table_name, orm_cls = resolved

    row: dict[str, Any] = data.model_dump(mode="json")

    for col in _server_default_cols(orm_cls):
        row.pop(col, None)

    strategy = _pk_strategy(orm_cls)
    pks = _pk_cols(orm_cls)

    if strategy == "uuid":
        for pk in pks:
            if row.get(pk) is None:
                row[pk] = str(uuid.uuid4())

    for field in _json_cols(orm_cls):
        if field in row and row[field] is not None:
            row[field] = json.dumps(row[field], default=str)

    is_serial = strategy == "serial"
    insert_row = {k: v for k, v in row.items() if k not in pks} if is_serial else row
    cols = list(insert_row.keys())
    placeholders = [f"${i + 1}" for i in range(len(cols))]
    suffix = f" RETURNING {pks[0]}" if is_serial else ""
    sql = (
        f"INSERT INTO {orm_cls.__tablename__} ({', '.join(cols)}) "
        f"VALUES ({', '.join(placeholders)}){suffix}"
    )

    return _CreateQuery(
        sql=sql,
        params=[insert_row[c] for c in cols],
        is_serial=is_serial,
        pks=pks,
        row=row,
        table_name=table_name,
    )


def _prepare_read(data: BaseModel) -> _Query | ResponseModel:
    resolved = _resolve(data)
    if isinstance(resolved, ResponseModel):
        return resolved
    _, orm_cls = resolved

    all_fields = data.model_dump()
    limit = all_fields.pop("limit", 10)
    pagination_cursor = all_fields.pop("pagination_cursor", None)
    tenant_id = all_fields.pop("tenant_id", None)

    if tenant_id is None:
        return ResponseModel(code=400, error="tenant_id is required")

    filter_fields = {k: v for k, v in all_fields.items() if v is not None}

    params: list[Any] = list(filter_fields.values())
    conditions = [f"{k} = ${i + 1}" for i, k in enumerate(filter_fields)]

    params.append(tenant_id)
    conditions.append(f"tenant_id = ${len(params)}")

    params.append(False)
    conditions.append(f"is_deleted = ${len(params)}")

    if pagination_cursor is not None:
        params.append(pagination_cursor)
        conditions.append(f"created_at > ${len(params)}")

    params.append(limit)
    sql = (
        f"SELECT * FROM {orm_cls.__tablename__} "
        f"WHERE {' AND '.join(conditions)} "
        f"ORDER BY created_at ASC "
        f"LIMIT ${len(params)}"
    )

    return _Query(sql=sql, params=params)


def _prepare_update(data: BaseModel) -> _Query | ResponseModel:
    resolved = _resolve(data)
    if isinstance(resolved, ResponseModel):
        return resolved
    _, orm_cls = resolved

    pks = _pk_cols(orm_cls)
    all_fields = data.model_dump(exclude_none=True, mode="json")

    pk_values = {k: all_fields.pop(k) for k in pks if k in all_fields}
    if len(pk_values) != len(pks):
        return ResponseModel(code=422, error=f"Missing primary key field(s): {pks}")

    update_fields = all_fields
    if not update_fields:
        return ResponseModel(code=400, error="No fields to update")

    for field in _json_cols(orm_cls):
        if field in update_fields and update_fields[field] is not None:
            update_fields[field] = json.dumps(update_fields[field], default=str)

    pk_count = len(pks)
    where_clause = " AND ".join(f"{k} = ${i + 1}"
                                for i, k in enumerate(pks))
    set_clause = ", ".join(
        f"{k} = ${pk_count + i + 1}"
        for i, k in enumerate(update_fields)
    )

    sql = f"UPDATE {orm_cls.__tablename__} SET {set_clause} WHERE {where_clause}"

    return _Query(
        sql=sql,
        params=[pk_values[k] for k in pks] + list(update_fields.values()),
    )


def _prepare_soft_delete(data: BaseModel) -> _Query | ResponseModel:
    resolved = _resolve(data)
    if isinstance(resolved, ResponseModel):
        return resolved
    _, orm_cls = resolved

    all_fields = data.model_dump()
    tenant_id = all_fields.pop("tenant_id", None)
    if tenant_id is None:
        return ResponseModel(code=400, error="tenant_id is required")

    # remaining fields are the pk conditions
    pk_fields = {k: v for k, v in all_fields.items() if v is not None}

    params: list[Any] = [True]   # $1 — value for SET is_deleted
    conditions: list[str] = []

    for k, v in pk_fields.items():
        params.append(v)
        conditions.append(f"{k} = ${len(params)}")

    params.append(tenant_id)
    conditions.append(f"tenant_id = ${len(params)}")

    params.append(False)
    conditions.append(f"is_deleted = ${len(params)}")

    sql = (
        f"UPDATE {orm_cls.__tablename__} "
        f"SET is_deleted = $1 "
        f"WHERE {' AND '.join(conditions)}"
    )
    return _Query(sql=sql, params=params)


def _prepare_read_join(data: ReadJoinRequest) -> _Query | ResponseModel:
    unknown = [t for t in data.joins_table if t not in REGISTRY]
    if unknown:
        return ResponseModel(code=400, error=f"Unknown table(s): {unknown}")

    select_parts = [
        f'{col.table_name}.{col.column_name} AS "{col.alias or f"{col.table_name}__{col.column_name}"}"'
        for col in data.selected_columns
    ]
    join_parts = [
        f"{on.join_type} JOIN {data.joins_table[i + 1]} "
        f"ON {on.left_table}.{on.left_column} = {on.right_table}.{on.right_column}"
        for i, on in enumerate(data.join_on)
    ]

    params: list[Any] = []
    where_parts: list[str] = []
    for f in data.filters:
        params.append(f.value)
        where_parts.append(f"{f.table_name}.{f.column_name} = ${len(params)}")

    lo = len(params) + 1
    params += [data.limit, data.offset]

    sql = " ".join(
        part for part in [
            f"SELECT {', '.join(select_parts)}",
            f"FROM {data.joins_table[0]}",
            *join_parts,
            f"WHERE {' AND '.join(where_parts)}" if where_parts else "",
            f"ORDER BY {data.order_by}" if data.order_by else "",
            f"LIMIT ${lo} OFFSET ${lo + 1}",
        ]
        if part
    )

    return _Query(sql=sql, params=params)


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def create(client: PostgresClient, data: BaseModel) -> ResponseModel:
    query = _prepare_create(data)
    if isinstance(query, ResponseModel):
        return query

    async with client.get_client().acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            if query.is_serial:
                result_row = await conn.fetchrow(query.sql, *query.params)
                await tr.commit()
                return ResponseModel(code=200, data={query.pks[0]: result_row[query.pks[0]]})

            await conn.execute(query.sql, *query.params)
            await tr.commit()

        except asyncpg.UniqueViolationError:
            await tr.rollback()
            return ResponseModel(code=409, error=f"Record already exists in {query.table_name}")
        except Exception:
            await tr.rollback()
            raise

    return ResponseModel(code=200, data={pk: str(query.row[pk]) for pk in query.pks if query.row.get(pk) is not None})


async def read(client: PostgresClient, data: BaseModel) -> ResponseModel:
    query = _prepare_read(data)
    if isinstance(query, ResponseModel):
        return query

    async with client.get_client().acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            rows = await conn.fetch(query.sql, *query.params)
            await tr.commit()
        except Exception:
            await tr.rollback()
            raise

    return ResponseModel(code=200, data=[dict(r) for r in rows])


async def update(client: PostgresClient, data: BaseModel) -> ResponseModel:
    query = _prepare_update(data)
    if isinstance(query, ResponseModel):
        return query

    async with client.get_client().acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            result = await conn.execute(query.sql, *query.params)
            await tr.commit()
        except Exception:
            await tr.rollback()
            raise

    if result == "UPDATE 0":
        return ResponseModel(code=404, error="Record not found")
    return ResponseModel(code=200)


async def soft_delete(client: PostgresClient, data: BaseModel) -> ResponseModel:
    query = _prepare_soft_delete(data)
    if isinstance(query, ResponseModel):
        return query

    async with client.get_client().acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            result = await conn.execute(query.sql, *query.params)
            await tr.commit()
        except Exception:
            await tr.rollback()
            raise

    if result == "UPDATE 0":
        return ResponseModel(code=404, error="Record not found or already deleted")
    return ResponseModel(code=200)


async def delete(client: PostgresClient, table_name: str, tenant_id: str) -> ResponseModel:
    schema = REGISTRY.get(table_name)
    if schema is None:
        return ResponseModel(code=400, error=f"Unknown table: {table_name}")

    sql = f"DELETE FROM {schema.orm.__tablename__} WHERE is_deleted = $1 AND tenant_id = $2"

    async with client.get_client().acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await conn.execute(sql, True, tenant_id)
            await tr.commit()
        except Exception:
            await tr.rollback()
            raise

    return ResponseModel(code=200)


async def read_join(client: PostgresClient, data: ReadJoinRequest) -> ResponseModel:
    query = _prepare_read_join(data)
    if isinstance(query, ResponseModel):
        return query

    async with client.get_client().acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            rows = await conn.fetch(query.sql, *query.params)
            await tr.commit()
        except Exception:
            await tr.rollback()
            raise

    return ResponseModel(code=200, data=[dict(r) for r in rows])
