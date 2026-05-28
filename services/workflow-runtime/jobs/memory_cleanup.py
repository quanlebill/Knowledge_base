"""
Chạy hàng ngày — xóa memories đã hết hạn hoặc quá RETENTION_DAYS.
Dùng: python jobs/memory_cleanup.py
"""
import asyncio
import logging
import os

import asyncpg
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

RETENTION_DAYS = int(os.environ.get("MEMORY_RETENTION_DAYS", "90"))
BATCH_SIZE = int(os.environ.get("MEMORY_CLEANUP_BATCH_SIZE", "1000"))


async def _delete_in_batches(conn: asyncpg.Connection, where_clause: str, label: str) -> int:
    total = 0
    while True:
        result = await conn.execute(f"""
            DELETE FROM agent_memories
            WHERE id IN (
                SELECT id FROM agent_memories
                WHERE {where_clause}
                LIMIT {BATCH_SIZE}
            )
        """)
        # asyncpg returns "DELETE N" string
        deleted = int(result.split()[-1])
        total += deleted
        logger.info("%s — batch deleted %d rows (total so far: %d)", label, deleted, total)
        if deleted < BATCH_SIZE:
            break
    return total


async def run():
    url = os.environ["DATABASE_URL"]
    conn = await asyncpg.connect(url)
    try:
        # Log per-tenant counts trước khi xóa để debug nếu cần
        tenant_counts = await conn.fetch("""
            SELECT tenant_id, COUNT(*) AS cnt
            FROM agent_memories
            WHERE (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '{days} days')
               OR (expires_at IS NOT NULL AND expires_at < NOW())
            GROUP BY tenant_id
        """.format(days=RETENTION_DAYS))
        for row in tenant_counts:
            logger.info("tenant=%s — %d records pending cleanup", row["tenant_id"], row["cnt"])

        # Batch delete: soft-deleted quá RETENTION_DAYS ngày
        soft_deleted = await _delete_in_batches(
            conn,
            where_clause=f"deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '{RETENTION_DAYS} days'",
            label="soft-deleted",
        )
        logger.info("cleanup complete — soft-deleted total: %d", soft_deleted)

        # Batch delete: expired
        expired = await _delete_in_batches(
            conn,
            where_clause="expires_at IS NOT NULL AND expires_at < NOW()",
            label="expired",
        )
        logger.info("cleanup complete — expired total: %d", expired)

    except Exception:
        logger.exception("memory_cleanup failed")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
