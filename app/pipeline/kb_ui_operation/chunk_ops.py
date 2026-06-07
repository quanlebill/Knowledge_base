"""Business logic for chunk and chunk-version CRUD."""
import logging
from fastapi import HTTPException
from sqlalchemy import update as sa_update

from basemodel.services_databaseconnector.postgres_model import (
    ReadJoinRequest, SelectInLoadRequest, WhereFilter,
    KBTextBlockDelete, KBTextBlockVersionDelete, KBTextBlockVersionInsert,
)
from basemodel.services_databaseconnector.postgres_orm.knowledge_base_orm import KBTextBlockVersionORM
from services.parse_for_ui.mappers import map_chunks, to_string

log = logging.getLogger(__name__)


async def get_chunks(postgres, doc_id: str) -> list:
    resp = await postgres.read_deep(SelectInLoadRequest(
        table="KBTextBlock",
        load_paths=["KBTextBlockVersion"],
        filters=[WhereFilter(table_name="KBTextBlock", column_name="owner_id", value=doc_id)],
        limit=200,
    ))
    if resp.code != 200:
        raise HTTPException(status_code=500, detail=resp.error)

    flat: list[dict] = []
    for block in (resp.data or []):
        for v in (block.get("KBTextBlockVersion") or []):
            flat.append({
                "block_id":           block.get("block_id"),
                "block_index":        block.get("block_index") or 0,
                "version_id":         v.get("version_id"),
                "version_number":     v.get("version_number"),
                "content":            v.get("content"),
                "is_active":          v.get("is_active"),
                "created_at":         v.get("created_at"),
                "payload":            v.get("payload"),
                "embedding_model_id": v.get("embedding_model_id"),
            })
    return [c.model_dump() for c in map_chunks(flat)]


async def delete_chunk(postgres, chunk_id: str) -> None:
    resp = await postgres.soft_delete(KBTextBlockDelete(block_id=chunk_id))
    if resp.code == 404:
        raise HTTPException(status_code=404, detail="Chunk not found")
    if resp.code != 200:
        raise HTTPException(status_code=500, detail=resp.error)


async def activate_chunk_version(postgres, chunk_id: str, version_number) -> dict:
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBTextBlockVersionORM)
            .where(KBTextBlockVersionORM.block_id == chunk_id)
            .values(is_active=False)
        )
        if version_number is not None:
            await session.execute(
                sa_update(KBTextBlockVersionORM)
                .where(KBTextBlockVersionORM.block_id == chunk_id)
                .where(KBTextBlockVersionORM.version_number == int(version_number))
                .values(is_active=True)
            )
        await session.commit()
    return {"status": "ok"}


async def delete_chunk_version(postgres, chunk_id: str, version_number: int) -> None:
    resp = await postgres.read(ReadJoinRequest(
        joins_table=["KBTextBlockVersion"],
        filters=[
            WhereFilter(table_name="KBTextBlockVersion", column_name="block_id", value=chunk_id),
            WhereFilter(table_name="KBTextBlockVersion", column_name="version_number", value=version_number),
        ],
        limit=1,
    ))
    if resp.code != 200 or not resp.data:
        raise HTTPException(status_code=404, detail="Version not found")
    version_id = to_string(resp.data[0].get("version_id"))
    del_resp = await postgres.soft_delete(KBTextBlockVersionDelete(version_id=version_id))
    if del_resp.code != 200:
        raise HTTPException(status_code=500, detail=del_resp.error)


async def create_chunk_version(
    postgres, chunk_id: str,
    text: str, entities: list, intents: list,
    user_id: str,
) -> dict:
    resp = await postgres.read(ReadJoinRequest(
        joins_table=["KBTextBlockVersion"],
        filters=[WhereFilter(table_name="KBTextBlockVersion", column_name="block_id", value=chunk_id)],
        limit=100,
    ))
    existing = resp.data or []
    max_v = max((r.get("version_number") or 0 for r in existing), default=0)

    ins = await postgres.insert(KBTextBlockVersionInsert(
        block_id=chunk_id,
        version_number=max_v + 1,
        content=text,
        created_by=user_id,
        table_involved=False,
        payload={"entities": entities, "intents": intents},
        is_active=False,
    ))
    if ins.code != 200:
        raise HTTPException(status_code=500, detail=ins.error)
    return {"version_id": ins.data.get("version_id"), "version_number": max_v + 1}
