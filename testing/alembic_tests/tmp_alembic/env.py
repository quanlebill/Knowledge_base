import asyncio
import os
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

from basemodel.services_databaseconnector.postgres_orm.base import Base
import basemodel.services_databaseconnector.postgres_orm  # noqa: F401 — registers all ORM classes

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ALEMBIC_DB_URL env var overrides the ini-file URL (used by CLI-based tests)
if _env_url := os.environ.get("ALEMBIC_DB_URL"):
    config.set_main_option("sqlalchemy.url", _env_url)

target_metadata = config.attributes.get("target_metadata", Base.metadata)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(config.get_main_option("sqlalchemy.url"))
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: context.configure(
                connection=sync_conn,
                target_metadata=target_metadata,
            )
        )
        await conn.run_sync(lambda _: context.run_migrations())
    await engine.dispose()


def run() -> None:
    if context.is_offline_mode():
        run_migrations_offline()
    else:
        asyncio.run(run_migrations_online())


run()
