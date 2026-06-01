import asyncio
from typing import Any

from sqlalchemy import select, update as sa_update, delete as sa_delete, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from services.log_set_up import create_logger
from basemodel.services_databaseconnector.shared_model import RetryConfig, HealthCheckLoopConfig, ResponseModel
from basemodel.services_databaseconnector.postgres_model import (
    REGISTRY, MODEL_TO_TABLE, ReadJoinRequest, TenantModel, DMLPreparation, DQLPreparation
)
import basemodel.services_databaseconnector.postgres_orm  # noqa: F401 — registers ORM classes into REGISTRY

log = create_logger("services.postgres", "service_postgres")





class PostgresClient:
    __slots__ = (
        "_engine", "_session_factory", "_connection_wait",
        "_healthy", "_connected", "_timeout", "_timeout_incremental", "_url",
    )

    def __init__(self):
        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None
        self._timeout: int = 10
        self._timeout_incremental: int = 1
        self._connection_wait: int = 5
        self._healthy: bool = False
        self._connected: bool = False
        self._url: str | None = None

    def set_url(self, url: str) -> None:
        self._url = url
        if self._url.startswith("postgresql://"):
             self._url.replace("postgresql://", "postgresql+asyncpg://", 1)

    async def open(self, retry: RetryConfig | None = RetryConfig()) -> None:
        if self._url is None:
            raise RuntimeError("Postgres URL is not yet set")

        for attempt in range(retry.count):
            try:
                self._engine = create_async_engine(self._url, pool_pre_ping=True)
                self._session_factory = async_sessionmaker(self._engine, expire_on_commit=False)
                async with self._engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
                self._connected = True
                self._healthy = True
                log.info("Postgres connection established")
                return
            except OperationalError as e:
                log.info(f"Attempt #{attempt + 1}/{retry.count}: Postgres connection failed — {e}")
                if attempt < retry.count - 1:
                    await asyncio.sleep(self._connection_wait)
        raise ConnectionError(f"Could not connect to Postgres after {retry.count} attempts")

    async def close(self) -> None:
        if self._engine:
            try:
                await self._engine.dispose()
            except Exception as e:
                log.info(f"Postgres engine dispose error (ignored): {e}")
            finally:
                self._engine = None
                self._session_factory = None
        self._connected = False
        self._healthy = False

    async def health_check_loop(self, config: HealthCheckLoopConfig | None = None) -> None:
        config = config or HealthCheckLoopConfig()
        log.info("Postgres health check loop started")
        while True:
            try:
                if self._engine is None:
                    await self.open()
                async with self._engine.connect() as conn:
                    await asyncio.wait_for(
                        conn.execute(text("SELECT 1")),
                        timeout=config.timeout_for_health_check,
                    )
                self._healthy = True
                log.info("Postgres health check succeeded")
            except asyncio.TimeoutError:
                self._healthy = False
                log.info("Postgres health check failed: timed out")
            except Exception as e:
                self._healthy = False
                self._engine = None
                self._session_factory = None
                log.info(f"Postgres health check failed: {e}")
            await asyncio.sleep(config.interval)

    def session(self) -> AsyncSession:
        if self._session_factory is None:
            raise RuntimeError("PostgresClient is not open — call open() first")
        return self._session_factory()

    def is_healthy(self) -> bool:
        return self._healthy

    def is_connected(self) -> bool:
        return self._connected

# Helpers

def _orm_to_dict(instance) -> dict[str, Any]:
    return {c.name: getattr(instance, c.name) for c in instance.__table__.columns}


def _resolve(data: TenantModel):
    table_name = MODEL_TO_TABLE.get(type(data))
    if table_name is None:
        raise AttributeError(f"Unregistered model: {type(data).__name__}")
    return table_name, REGISTRY[table_name].orm


# Query Compilers

def _prepare_create(data: TenantModel) -> DMLPreparation:
    table_name, orm_cls = _resolve(data)
    return DMLPreparation(
        instance=orm_cls(**data.model_dump(mode="json")),
        orm_cls=orm_cls,
        table_name=table_name,
    )


def _prepare_read(data: TenantModel) -> DQLPreparation:
    _, orm_cls = _resolve(data)
    fields = data.model_dump()
    limit = fields.pop("limit", 10)
    pagination_cursor = fields.pop("pagination_cursor", None)
    tenant_id = fields.pop("tenant_id")

    stmt = select(orm_cls).where(orm_cls.tenant_id == tenant_id, orm_cls.is_deleted == False)
    for k, v in fields.items():
        if v is not None:
            stmt = stmt.where(getattr(orm_cls, k) == v)
    if pagination_cursor is not None:
        stmt = stmt.where(orm_cls.created_at > pagination_cursor)
    return DQLPreparation(compiled_query=stmt.order_by(orm_cls.created_at.asc()).limit(limit))


def _prepare_update(data: TenantModel) -> DMLPreparation:
    _, orm_cls = _resolve(data)
    pks = [col.name for col in orm_cls.__table__.primary_key]
    all_fields = data.model_dump(exclude_none=True, mode="json")
    tenant_id = all_fields.pop("tenant_id")
    pk_values = {k: all_fields.pop(k) for k in pks if k in all_fields}
    if len(pk_values) != len(pks):
        raise AttributeError(f"Missing primary key field(s): {pks}")
    if not all_fields:
        raise AttributeError("No fields to update")

    conditions = [getattr(orm_cls, k) == v for k, v in pk_values.items()]
    conditions.append(orm_cls.tenant_id == tenant_id)
    return DMLPreparation(compiled_query=sa_update(orm_cls).where(*conditions).values(**all_fields))


def _prepare_soft_delete(data: TenantModel) -> DMLPreparation:
    _, orm_cls = _resolve(data)
    fields = data.model_dump()
    tenant_id = fields.pop("tenant_id")
    pk_fields = {k: v for k, v in fields.items() if v is not None}

    conditions = [
        orm_cls.tenant_id == tenant_id,
        orm_cls.is_deleted == False,
        *[getattr(orm_cls, k) == v for k, v in pk_fields.items()],
    ]
    return DMLPreparation(compiled_query=sa_update(orm_cls).where(*conditions).values(is_deleted=True))


def _prepare_delete(table_name: str, tenant_id: str) -> DMLPreparation:
    schema = REGISTRY.get(table_name)
    if schema is None:
        raise AttributeError("Unknown table: {table_name}")
    orm_cls = schema.orm
    return DMLPreparation(
        compiled_query=sa_delete(orm_cls).where(orm_cls.is_deleted == True, orm_cls.tenant_id == tenant_id)
    )


def _prepare_read_join(data: ReadJoinRequest) -> DQLPreparation:
    unknown = [t for t in data.joins_table if t not in REGISTRY]
    if unknown:
        raise AttributeError("Unknown table(s): {unknown}")

    orm_map = {t: REGISTRY[t].orm for t in data.joins_table}
    from_cls = orm_map[data.joins_table[0]]

    cols = [
        getattr(orm_map[c.table_name], c.column_name).label(
            c.alias or f"{c.table_name}__{c.column_name}"
        )
        for c in data.selected_columns
    ]

    stmt = select(*cols).select_from(from_cls)
    for i, join_on in enumerate(data.join_on):
        join_cls = orm_map[data.joins_table[i + 1]]
        left_col = getattr(orm_map[join_on.left_table], join_on.left_column)
        right_col = getattr(join_cls, join_on.right_column)
        stmt = stmt.join(join_cls, left_col == right_col, isouter=join_on.join_type != "INNER")

    stmt = stmt.where(from_cls.tenant_id == data.tenant_id)
    for f in data.filters:
        stmt = stmt.where(getattr(orm_map[f.table_name], f.column_name) == f.value)

    if data.order_by:
        stmt = stmt.order_by(text(data.order_by))
    return DQLPreparation(compiled_query=stmt.limit(data.limit).offset(data.offset))


# CRUD method
async def create(client: PostgresClient, data: TenantModel) -> ResponseModel:
    try:
        prep = _prepare_create(data)
    except IntegrityError as e:
        return ResponseModel(code=404, error=f"Violate Data Integrity. Error: {e}")

    async with client.session() as session:
        session.add(prep.instance)
        try:
            await session.commit()
            await session.refresh(prep.instance)
        except IntegrityError:
            await session.rollback()
            return ResponseModel(code=409, error=f"Record already exists in {prep.table_name}")
    pks = [col.name for col in prep.orm_cls.__table__.primary_key]
    return ResponseModel(code=200, data={pk: str(getattr(prep.instance, pk)) for pk in pks if getattr(prep.instance, pk) is not None})


async def read(client: PostgresClient, data: TenantModel) -> ResponseModel:
    try:
        prep = _prepare_read(data)
    except IntegrityError as e:
        return ResponseModel(code=404, error=f"Violate Data Integrity. Error: {e}")

    async with client.session() as session:
        result = await session.execute(prep.compiled_query)
        rows = result.scalars().all()
    return ResponseModel(code=200, data=[_orm_to_dict(r) for r in rows])


async def update(client: PostgresClient, data: TenantModel) -> ResponseModel:
    try:
        prep = _prepare_update(data)
    except IntegrityError as e:
        return ResponseModel(code=404, error=f"Violate Data Integrity. Error: {e}")

    if isinstance(prep, ResponseModel):
        return prep
    async with client.session() as session:
        try:
            result = await session.execute(prep.compiled_query)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
    if result.rowcount == 0:
        return ResponseModel(code=404, error="Record not found")
    return ResponseModel(code=200)


async def soft_delete(client: PostgresClient, data: TenantModel) -> ResponseModel:
    try:
        prep = _prepare_soft_delete(data)
    except IntegrityError as e:
        return ResponseModel(code=404, error=f"Violate Data Integrity. Error: {e}")

    async with client.session() as session:
        try:
            result = await session.execute(prep.compiled_query)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
    if result.rowcount == 0:
        return ResponseModel(code=404, error="Record not found or already deleted")
    return ResponseModel(code=200)


async def delete(client: PostgresClient, table_name: str, tenant_id: str) -> ResponseModel:
    try:
        prep = _prepare_delete(table_name, tenant_id)
    except IntegrityError as e:
        return ResponseModel(code=404, error=f"Violate Data Integrity. Error: {e}")

    if isinstance(prep, ResponseModel):
        return prep
    async with client.session() as session:
        try:
            await session.execute(prep.compiled_query)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
    return ResponseModel(code=200)


async def read_join(client: PostgresClient, data: ReadJoinRequest) -> ResponseModel:
    try:
        prep = _prepare_read_join(data)
    except IntegrityError as e:
        return ResponseModel(code=404, error=f"Violate Data Integrity. Error: {e}")

    if isinstance(prep, ResponseModel):
        return prep
    async with client.session() as session:
        result = await session.execute(prep.compiled_query)
        rows = result.mappings().all()
    return ResponseModel(code=200, data=[dict(r) for r in rows])
