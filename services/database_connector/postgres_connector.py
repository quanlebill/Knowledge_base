import asyncio
from typing import Any

from sqlalchemy import select, update as sa_update, delete as sa_delete, text
from sqlalchemy.engine import CursorResult
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import selectinload, attributes as sa_attributes
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from services.log_set_up import create_logger
from basemodel.services_databaseconnector.shared_model import RetryConfig, HealthCheckLoopConfig, ResponseModel
from pydantic import BaseModel
from basemodel.services_databaseconnector.postgres_model import (
    REGISTRY, MODEL_TO_TABLE, ReadJoinRequest, SelectInLoadRequest, DMLPreparation, DQLPreparation
)
import basemodel.services_databaseconnector.postgres_orm  # noqa: F401 — registers ORM classes into REGISTRY

log = create_logger("services.postgres", "service_postgres")

# Helpers

def _orm_to_dict(instance) -> dict[str, Any]:
    return {c.name: getattr(instance, c.name) for c in instance.__table__.columns}


def _orm_to_dict_deep(instance) -> dict[str, Any]:
    result = {c.name: getattr(instance, c.name) for c in instance.__table__.columns}
    state = sa_attributes.instance_state(instance)
    mapper = sa_inspect(type(instance))
    for key, val in state.dict.items():
        if key in result:
            continue
        table_name = (
            mapper.relationships[key].mapper.class_.__tablename__
            if key in mapper.relationships
            else key
        )
        if isinstance(val, list):
            result[table_name] = [_orm_to_dict_deep(v) for v in val]
        elif val is not None and hasattr(val, "__table__"):
            result[table_name] = _orm_to_dict_deep(val)
    return result


def _rel_key_to(orm_cls, target_cls) -> str:
    for rel in sa_inspect(orm_cls).relationships:
        if rel.mapper.class_ is target_cls:
            return rel.key
    raise AttributeError(
        f"No relationship from {orm_cls.__tablename__} to {target_cls.__tablename__}"
    )


def _build_load_option(root_orm_cls, path: str):
    table_names = path.split(".")
    current_cls = root_orm_cls
    option = None
    for table_name in table_names:
        if table_name not in REGISTRY:
            raise AttributeError(f"Unknown table in load path: {table_name}")
        target_cls = REGISTRY[table_name].orm
        rel_key = _rel_key_to(current_cls, target_cls)
        option = (
            selectinload(getattr(current_cls, rel_key))
            if option is None
            else option.selectinload(getattr(current_cls, rel_key))
        )
        current_cls = target_cls
    return option


def _resolve(data: BaseModel):
    table_name = MODEL_TO_TABLE.get(type(data))
    if table_name is None:
        raise AttributeError(f"Unregistered model: {type(data).__name__}")
    return table_name, REGISTRY[table_name].orm


# Query Compilers

def _prepare_insert(data: BaseModel) -> DMLPreparation:
    table_name, orm_cls = _resolve(data)
    return DMLPreparation(
        instance=orm_cls(**data.model_dump(mode="json")),
        orm_cls=orm_cls,
        table_name=table_name,
    )


def _prepare_deep_search(data: SelectInLoadRequest) -> DQLPreparation:
    schema = REGISTRY.get(data.table)
    if schema is None:
        raise AttributeError(f"Unknown table: {data.table}")
    orm_cls = schema.orm

    load_options = [_build_load_option(orm_cls, path) for path in data.load_paths]

    stmt = select(orm_cls).options(*load_options)

    if data.tenant_id is not None:
        stmt = stmt.where(orm_cls.tenant_id == data.tenant_id)
    for f in data.filters:
        stmt = stmt.where(getattr(orm_cls, f.column_name) == f.value)
    if data.cursor is not None:
        stmt = stmt.where(orm_cls.inserted_at > data.cursor)

    stmt = stmt.order_by(orm_cls.inserted_at.asc()).limit(data.limit)
    return DQLPreparation(compiled_query=stmt)

def _prepare_soft_delete(data: BaseModel) -> DMLPreparation:
    _, orm_cls = _resolve(data)
    try:
        orm_cls.is_deleted
    except AttributeError:
        raise AttributeError(f"{orm_cls.__tablename__} does not support soft delete — missing is_deleted column")
    fields = data.model_dump()
    pk_fields = {k: v for k, v in fields.items() if v is not None}

    conditions = [
        orm_cls.is_deleted == False,
        *[getattr(orm_cls, k) == v for k, v in pk_fields.items()],
    ]
    return DMLPreparation(compiled_query=sa_update(orm_cls).where(*conditions).values(is_deleted=True))


def _prepare_delete(data: BaseModel) -> DMLPreparation:
    _, orm_cls = _resolve(data)
    fields = data.model_dump()
    conditions = [getattr(orm_cls, k) == v for k, v in fields.items() if v is not None]
    if not conditions:
        raise AttributeError("delete requires at least one field to identify the record")
    return DMLPreparation(compiled_query=sa_delete(orm_cls).where(*conditions))


def _prepare_update(where: BaseModel, values: dict) -> DMLPreparation:
    _, orm_cls = _resolve(where)
    where_fields = where.model_dump()
    conditions = [getattr(orm_cls, k) == v for k, v in where_fields.items() if v is not None]
    if not conditions:
        raise AttributeError("update requires at least one field in where clause")
    if not values:
        raise AttributeError("update requires at least one value to set")
    return DMLPreparation(compiled_query=sa_update(orm_cls).where(*conditions).values(**values))


def _prepare_flush(table_name: str) -> DMLPreparation:
    schema = REGISTRY.get(table_name)
    if schema is None:
        raise AttributeError(f"Unknown table: {table_name}")
    orm_cls = schema.orm
    try:
        orm_cls.is_deleted
    except AttributeError:
        raise AttributeError(f"{orm_cls.__tablename__} does not support flush — missing is_deleted column")
    return DMLPreparation(compiled_query=sa_delete(orm_cls).where(orm_cls.is_deleted == True))


def _prepare_read(data: ReadJoinRequest) -> DQLPreparation:
    unknown = [t for t in data.joins_table if t not in REGISTRY]
    if unknown:
        raise AttributeError(f"Unknown table(s): {unknown}")

    orm_map = {t: REGISTRY[t].orm for t in data.joins_table}
    from_cls = orm_map[data.joins_table[0]]

    if data.selected_columns:
        # use alias if provided, otherwise just the column name (caller adds alias for ambiguous joins)
        cols = [
            getattr(orm_map[c.table_name], c.column_name).label(c.alias or c.column_name)
            for c in data.selected_columns
        ]
        stmt = select(*cols).select_from(from_cls)
    else:
        # enumerate columns explicitly so mappings() returns flat dicts not ORM objects
        cols = [col for orm_cls in orm_map.values() for col in orm_cls.__table__.columns]
        stmt = select(*cols).select_from(from_cls)

    # single table → loop skipped; multi-table → SQLAlchemy resolves ON from FK metadata
    for i in range(1, len(data.joins_table)):
        join_cls = orm_map[data.joins_table[i]]
        stmt = stmt.join(join_cls)

    if data.tenant_id is not None:
        stmt = stmt.where(from_cls.tenant_id == data.tenant_id)
    for f in data.filters:
        stmt = stmt.where(getattr(orm_map[f.table_name], f.column_name) == f.value)
    if data.cursor is not None:
        stmt = stmt.where(from_cls.inserted_at > data.cursor)
    # exclude soft-deleted rows if the root table supports it
    try:
        stmt = stmt.where(from_cls.is_deleted == False)
    except AttributeError:
        pass

    stmt = stmt.order_by(text(data.order_by) if data.order_by else from_cls.inserted_at.asc())
    return DQLPreparation(compiled_query=stmt.limit(data.limit))



class PostgresClient:
    __slots__ = ("_engine", "_session_factory", "_connection_wait","_healthy", "_connected", "_timeout", "_timeout_incremental", "_url",)

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
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        self._url = url

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

    def get_client(self) -> AsyncSession:
        if self._session_factory is None:
            raise RuntimeError("PostgresClient is not open — call open() first")
        return self._session_factory()

    def is_healthy(self) -> bool:
        return self._healthy

    def is_connected(self) -> bool:
        return self._connected
# Operations
    async def insert(self, data: BaseModel) -> ResponseModel:
        try:
            prep = _prepare_insert(data)
        except AttributeError as e:
            return ResponseModel(code=400, error=str(e))

        async with self.get_client() as session:
            session.add(prep.instance)
            try:
                await session.commit()
                await session.refresh(prep.instance)
            except IntegrityError:
                await session.rollback()
                return ResponseModel(code=409, error=f"Record already exists in {prep.table_name}")
        pks = [col.name for col in prep.orm_cls.__table__.primary_key]
        return ResponseModel(code=200, data={pk: str(getattr(prep.instance, pk)) for pk in pks if getattr(prep.instance, pk) is not None})

    async def update(self, where: BaseModel, values: dict) -> ResponseModel:
        """Update rows matching `where` (Delete model) with `values` dict."""
        try:
            prep = _prepare_update(where, values)
        except AttributeError as e:
            return ResponseModel(code=400, error=str(e))

        async with self.get_client() as session:
            try:
                result: Any | CursorResult = await session.execute(prep.compiled_query)
                await session.commit()
            except Exception:
                await session.rollback()
                raise
        if result.rowcount == 0:
            return ResponseModel(code=404, error="Record not found")
        return ResponseModel(code=200)

    async def soft_delete(self, data: BaseModel) -> ResponseModel:
        try:
            prep = _prepare_soft_delete(data)
        except AttributeError as e:
            return ResponseModel(code=400, error=str(e))

        async with self.get_client() as session:
            try:
                result: Any|CursorResult = await session.execute(prep.compiled_query)
                await session.commit()
            except Exception:
                await session.rollback()
                raise
        if result.rowcount == 0:
            return ResponseModel(code=404, error="Record not found or already deleted")
        return ResponseModel(code=200)


    async def delete(self, data: BaseModel) -> ResponseModel:
        try:
            prep = _prepare_delete(data)
        except AttributeError as e:
            return ResponseModel(code=400, error=str(e))

        async with self.get_client() as session:
            try:
                await session.execute(prep.compiled_query)
                await session.commit()
            except Exception:
                await session.rollback()
                raise
        return ResponseModel(code=200)

    async def read_deep(self, data: SelectInLoadRequest) -> ResponseModel:
        try:
            prep = _prepare_deep_search(data)
        except AttributeError as e:
            return ResponseModel(code=400, error=str(e))

        async with self.get_client() as session:
            result = await session.execute(prep.compiled_query)
            rows = result.scalars().all()
        return ResponseModel(code=200, data=[_orm_to_dict_deep(r) for r in rows])


    async def flush(self, table_name: str) -> ResponseModel:
        try:
            prep = _prepare_flush(table_name)
        except AttributeError as e:
            return ResponseModel(code=400, error=str(e))

        async with self.get_client() as session:
            try:
                await session.execute(prep.compiled_query)
                await session.commit()
            except Exception:
                await session.rollback()
                raise
        return ResponseModel(code=200)


    async def read(self, data: ReadJoinRequest) -> ResponseModel:
        try:
            prep = _prepare_read(data)
        except AttributeError as e:
            return ResponseModel(code=400, error=str(e))

        async with self.get_client() as session:
            result = await session.execute(prep.compiled_query)
            rows = result.mappings().all()
        return ResponseModel(code=200, data=[dict(r) for r in rows])

client = PostgresClient()