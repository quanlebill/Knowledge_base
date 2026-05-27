"""
Chạy hàng ngày — xóa memories đã hết hạn hoặc quá 90 ngày.
Dùng: python jobs/memory_cleanup.py
"""
import asyncio
import os
import asyncpg
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())


async def run():
    url = os.environ["DATABASE_URL"]
    conn = await asyncpg.connect(url)
    try:
        # Hard delete: soft-deleted quá 90 ngày
        result = await conn.execute("""
            DELETE FROM agent_memories
            WHERE deleted_at IS NOT NULL
              AND deleted_at < NOW() - INTERVAL '90 days'
        """)
        print(f"hard-deleted (soft-deleted 90d+): {result}")

        # Hard delete: expired
        result = await conn.execute("""
            DELETE FROM agent_memories
            WHERE expires_at IS NOT NULL
              AND expires_at < NOW()
        """)
        print(f"hard-deleted (expired): {result}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
