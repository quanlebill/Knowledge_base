"""Business logic for warehouse config CRUD."""
import logging
import uuid
from fastapi import HTTPException
from sqlalchemy import update as sa_update

from basemodel.services_databaseconnector.postgres_model import (
    ReadJoinRequest, WhereFilter,
    KBWarehouseConfigInsert, KBWarehouseConfigDelete,
    WarehouseConfigPayload,
)
from basemodel.services_databaseconnector.postgres_orm.knowledge_base_orm import KBWarehouseConfigORM
from services.backend.UI_model.response import to_string

log = logging.getLogger(__name__)


def _to_wconfig(row: dict) -> dict:
    cfg = row.get("config") or {}
    tables_raw = cfg.get("selected_tables") or []
    connection = cfg.get("connection") or {
        "host":     cfg.get("host", ""),
        "port":     str(cfg.get("port", "")),
        "database": cfg.get("database", ""),
    }
    return {
        "id":         to_string(row.get("config_id")),
        "name":       f"Config v{row.get('version_number', 1)}",
        "version":    f"v{row.get('version_number', 1)}",
        "status":     "Active" if row.get("is_active") else "Inactive",
        "created_at": to_string(row.get("created_at", "")),
        "connection": connection,
        "tables": [
            {"name": t, "schema": "", "rowCount": "—", "description": ""}
            if isinstance(t, str) else t
            for t in tables_raw
        ],
    }


async def get_warehouse_configs(postgres, warehouse_id: str) -> list:
    resp = await postgres.read(ReadJoinRequest(
        joins_table=["KBWarehouseConfig"],
        filters=[WhereFilter(
            table_name="KBWarehouseConfig",
            column_name="warehouse_id",
            value=warehouse_id,
        )],
        limit=50,
    ))
    if resp.code != 200:
        raise HTTPException(status_code=500, detail=resp.error)
    return [_to_wconfig(r) for r in (resp.data or [])]


async def create_warehouse_config(
    postgres, warehouse_id: str, body: dict, user_id: str,
) -> dict:
    resp = await postgres.read(ReadJoinRequest(
        joins_table=["KBWarehouseConfig"],
        filters=[WhereFilter(
            table_name="KBWarehouseConfig",
            column_name="warehouse_id",
            value=warehouse_id,
        )],
        limit=100,
    ))
    existing = resp.data or []
    max_v = max((r.get("version_number") or 0 for r in existing), default=0)

    connection = body.get("connection") or {}
    tables = body.get("tables") or body.get("selectedTables") or body.get("selected_tables") or []

    ins = await postgres.insert(KBWarehouseConfigInsert(
        warehouse_id=warehouse_id,
        version_number=max_v + 1,
        is_active=False,
        created_by=user_id,
        config=WarehouseConfigPayload(
            host=connection.get("account") or connection.get("host") or body.get("host"),
            database=connection.get("database") or body.get("database"),
            selected_tables=tables,
            sync_schedule=body.get("syncSchedule") or body.get("sync_schedule"),
            schema_filter=body.get("schemaFilter") or body.get("schema_filter"),
            connection=connection or None,
        ),
    ))
    if ins.code != 200:
        raise HTTPException(status_code=500, detail=ins.error)
    return {"config_id": ins.data.get("config_id"), "version_number": max_v + 1}


async def activate_warehouse_config(
    postgres, warehouse_id: str, config_id: str,
) -> dict:
    warehouse_uuid = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id
    config_uuid = uuid.UUID(config_id) if isinstance(config_id, str) else config_id
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBWarehouseConfigORM)
            .where(KBWarehouseConfigORM.warehouse_id == warehouse_uuid)
            .values(is_active=False)
        )
        await session.execute(
            sa_update(KBWarehouseConfigORM)
            .where(KBWarehouseConfigORM.config_id == config_uuid)
            .values(is_active=True)
        )
        await session.commit()
    return {"status": "ok", "config_id": config_id}


async def delete_warehouse_config(postgres, config_id: str) -> None:
    resp = await postgres.soft_delete(KBWarehouseConfigDelete(config_id=config_id))
    if resp.code == 404:
        raise HTTPException(status_code=404, detail="Config not found")
    if resp.code != 200:
        raise HTTPException(status_code=500, detail=resp.error)


async def delete_config_table(postgres, config_id: str, table_id: str) -> None:
    resp = await postgres.read(ReadJoinRequest(
        joins_table=["KBWarehouseConfig"],
        filters=[WhereFilter(
            table_name="KBWarehouseConfig",
            column_name="config_id",
            value=config_id,
        )],
        limit=1,
    ))
    if resp.code != 200 or not resp.data:
        raise HTTPException(status_code=404, detail="Config not found")

    row = resp.data[0]
    cfg = row.get("config") or {}
    cfg["selected_tables"] = [t for t in (cfg.get("selected_tables") or []) if t != table_id]

    config_uuid = uuid.UUID(config_id) if isinstance(config_id, str) else config_id
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBWarehouseConfigORM)
            .where(KBWarehouseConfigORM.config_id == config_uuid)
            .values(config=cfg)
        )
        await session.commit()
