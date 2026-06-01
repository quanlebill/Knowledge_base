import asyncio
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine

from basemodel.services_databaseconnector.postgres_orm.base import Base
import basemodel.services_databaseconnector.postgres_orm  # noqa: F401
from services.database_connector.postgres_connector import PostgresClient
from testing.postgres_connector.seed import run_seed, seed_prerequisites, create_tables

TEST_URL = "postgresql+asyncpg://postgres@localhost:5433/aeroflow_test"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def client() -> PostgresClient:
    c = PostgresClient()
    c.set_url(TEST_URL)
    await c.open()
    yield c
    await c.close()


@pytest_asyncio.fixture(scope="session")
async def seeded(client: PostgresClient) -> dict:
    """Creates tables, seeds prerequisites and KB data. Returns inserted IDs."""
    await create_tables(TEST_URL)
    await seed_prerequisites(TEST_URL)

    from testing.postgres_connector.seed import seed_kb
    ids = await seed_kb(client)
    yield ids

    # teardown — drop all tables after the session
    engine = create_async_engine(TEST_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
