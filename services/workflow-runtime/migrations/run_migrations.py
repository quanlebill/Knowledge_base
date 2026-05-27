import os, sys, asyncio, asyncpg
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

MIGRATIONS_DIR = Path(__file__).parent
DATABASE_URL = os.environ["DATABASE_URL"]


async def run():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
              filename varchar PRIMARY KEY,
              applied_at timestamp DEFAULT now()
            )
        """)
        applied = {r["filename"] for r in await conn.fetch("SELECT filename FROM schema_migrations")}
        sql_files = sorted(f for f in MIGRATIONS_DIR.glob("0*.sql"))
        for f in sql_files:
            if f.name in applied:
                print(f"  skip  {f.name}")
                continue
            print(f"  apply {f.name}")
            sql = f.read_text(encoding="utf-8")
            await conn.execute(sql)
            await conn.execute("INSERT INTO schema_migrations (filename) VALUES ($1)", f.name)
        print("migrations done.")
    finally:
        await conn.close()


async def run_seed():
    seed_file = MIGRATIONS_DIR / "seed.sql"
    if not seed_file.exists():
        print("no seed.sql found, skipping.")
        return
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        sql = seed_file.read_text(encoding="utf-8")
        await conn.execute(sql)
        print("seed done.")
    finally:
        await conn.close()


if __name__ == "__main__":
    seed = "--seed" in sys.argv
    asyncio.run(run())
    if seed:
        asyncio.run(run_seed())
