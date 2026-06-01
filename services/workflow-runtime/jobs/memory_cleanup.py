"""
Chạy hàng ngày — xóa memories đã hết hạn hoặc quá RETENTION_DAYS.
Dùng: python jobs/memory_cleanup.py
"""
import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv, find_dotenv
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from models import AgentMemory

load_dotenv(find_dotenv())

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

RETENTION_DAYS = int(os.environ.get("MEMORY_RETENTION_DAYS", "90"))
BATCH_SIZE     = int(os.environ.get("MEMORY_CLEANUP_BATCH_SIZE", "1000"))


async def _delete_in_batches(session_factory, where_clause, label: str) -> int:
    total = 0
    while True:
        async with session_factory() as session:
            subq = (
                select(AgentMemory.id)
                .where(where_clause)
                .limit(BATCH_SIZE)
            )
            result = await session.execute(
                delete(AgentMemory).where(AgentMemory.id.in_(subq))
            )
            deleted = result.rowcount
            await session.commit()
        total += deleted
        logger.info("%s — batch deleted %d rows (total so far: %d)", label, deleted, total)
        if deleted < BATCH_SIZE:
            break
    return total


async def run():
    url = os.environ["DATABASE_URL"]
    if "postgresql+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(url, pool_size=1, max_overflow=2)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        # Log per-tenant counts trước khi xóa để debug nếu cần
        async with session_factory() as session:
            counts = await session.execute(
                select(AgentMemory.tenant_id, func.count().label("cnt"))
                .where(text(
                    f"(deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '{RETENTION_DAYS} days') "
                    "OR (expires_at IS NOT NULL AND expires_at < NOW())"
                ))
                .group_by(AgentMemory.tenant_id)
            )
            for row in counts.fetchall():
                logger.info("tenant=%s — %d records pending cleanup", row.tenant_id, row.cnt)

        soft_deleted = await _delete_in_batches(
            session_factory,
            text(f"deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '{RETENTION_DAYS} days'"),
            "soft-deleted",
        )
        logger.info("cleanup complete — soft-deleted total: %d", soft_deleted)

        expired = await _delete_in_batches(
            session_factory,
            text("expires_at IS NOT NULL AND expires_at < NOW()"),
            "expired",
        )
        logger.info("cleanup complete — expired total: %d", expired)

    except Exception:
        logger.exception("memory_cleanup failed")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
