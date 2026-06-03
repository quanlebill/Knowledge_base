"""
Postgres connector test seeder.

Loads mock_data/*.json into the test DB via the connector's insert function.
Prerequisite rows (Tenants, RolePermissions) are inserted directly via SQLAlchemy
since they have no insert models in postgres_model.py.

Run standalone:
    python testing/postgres_connector/seed.py

Or called from conftest.py fixtures.
"""

import asyncio
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from basemodel.services_databaseconnector.postgres_orm.base import Base
import basemodel.services_databaseconnector.postgres_orm  # noqa: F401
from basemodel.services_databaseconnector.postgres_orm.auth_release_orm import (
    TenantsORM, RolePermissionsORM,
)
from basemodel.services_databaseconnector.postgres_model import (
    KBDataInsert, KBTextBlockInsert, KBTextBlockVersionInsert,
    KBFilterPolicyInsert, KBConflictBatchInsert, KBConflictInsert,
)
from services.database_connector.postgres_connector import PostgresClient

# ── Constants ─────────────────────────────────────────────────────────────────

TEST_URL   = "postgresql+asyncpg://postgres@localhost:5433/aeroflow_test"
TENANT_ID  = "11111111-1111-1111-1111-111111111111"
ROLE_ID    = "33333333-3333-3333-3333-333333333333"

MOCK_DATA  = Path(__file__).parent / "mock_data"

# ── Helpers ───────────────────────────────────────────────────────────────────

def load(filename: str) -> list[dict]:
    return json.loads((MOCK_DATA / filename).read_text())


def ok(result, label: str):
    if result.code >= 400:
        print(f"  [x] {label} — {result.error}")
        sys.exit(1)
    print(f"  [+] {label}")
    return result.data or {}


# ── Step 1 — Create tables ────────────────────────────────────────────────────

async def create_tables(url: str) -> None:
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("[+] Tables created")


# ── Step 2 — Seed prerequisites (no insert models for auth tables) ────────────

async def seed_prerequisites(url: str) -> None:
    engine = create_async_engine(url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        session.add(TenantsORM(
            id=uuid.UUID(TENANT_ID),
            name="Test Tenant",
            slug="test-tenant",
            inserted_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        ))
        session.add(RolePermissionsORM(
            id=uuid.UUID(ROLE_ID),
            role_id="AI_ENGINEER",
            resource="knowledge_base",
            action="read",
        ))
        await session.commit()

    await engine.dispose()
    print("[+] Prerequisites seeded (Tenants, RolePermissions)")


# ── Step 3 — Seed KB tables via connector ────────────────────────────────────

async def seed_kb(client: PostgresClient) -> dict:
    ids: dict = {}

    # KBData
    print("\n[KBData]")
    data_ids = []
    for row in load("kb_data.json"):
        res = ok(await client.insert(KBDataInsert(**row)), f"KBData: {row['name']}")
        data_ids.append(res["data_id"])
    ids["bronze_doc"] = data_ids[0]
    ids["silver_doc"] = data_ids[1]
    ids["gold_doc"]   = data_ids[2]

    # KBTextBlock (2 blocks under gold doc)
    print("\n[KBTextBlock]")
    block_ids = []
    for row in load("kb_text_block.json"):
        res = ok(await client.insert(KBTextBlockInsert(
            owner_id=ids["gold_doc"],
            **row,
        )), f"KBTextBlock: block_index={row['block_index']}")
        block_ids.append(res["block_id"])
    ids["block_ids"] = block_ids

    # KBTextBlockVersion (2 versions per block, interleaved in JSON)
    print("\n[KBTextBlockVersion]")
    versions = load("kb_text_block_version.json")
    version_ids = []
    for i, row in enumerate(versions):
        block_id = block_ids[i // 2]
        res = ok(await client.insert(KBTextBlockVersionInsert(
            block_id=block_id,
            **row,
        )), f"KBTextBlockVersion: block={i // 2} v{row['version_number']}")
        version_ids.append(res["version_id"])
    ids["version_ids"] = version_ids

    # KBFilterPolicy
    print("\n[KBFilterPolicy]")
    policy_ids = []
    for row in load("kb_filter_policy.json"):
        res = ok(await client.insert(KBFilterPolicyInsert(**row)), f"KBFilterPolicy: {row['policy_name']}")
        policy_ids.append(res["policy_id"])
    ids["policy_ids"] = policy_ids

    # KBConflictBatch + KBConflict
    print("\n[KBConflict]")
    batch_res = ok(await client.insert(KBConflictBatchInsert(
        **load("kb_conflict_batch.json")[0]
    )), "KBConflictBatch")
    batch_id = batch_res["batch_id"]
    ids["batch_id"] = batch_id

    conflict_ids = []
    for row in load("kb_conflict.json"):
        res = ok(await client.insert(KBConflictInsert(batch_id=batch_id, **row)), f"KBConflict: {row['conflict_type']}")
        conflict_ids.append(res["conflict_id"])
    ids["conflict_ids"] = conflict_ids

    return ids


# ── Main ──────────────────────────────────────────────────────────────────────

async def run_seed(url: str = TEST_URL) -> dict:
    print("=" * 55)
    print("Postgres connector — test seed")
    print("=" * 55)

    await create_tables(url)
    await seed_prerequisites(url)

    client = PostgresClient()
    client.set_url(url)
    await client.open()

    ids = await seed_kb(client)

    await client.close()

    print("\n" + "=" * 55)
    print("Seed complete.")
    for k, v in ids.items():
        print(f"  {k}: {v}")
    print("=" * 55)

    return ids


if __name__ == "__main__":
    asyncio.run(run_seed())
