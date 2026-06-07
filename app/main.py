import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

import basemodel.services_databaseconnector.postgres_orm  # noqa: F401 — registers ORM models
from basemodel.services_databaseconnector.postgres_orm.base import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    pg_url = os.environ.get(
        "POSTGRES_URL",
        "postgresql+asyncpg://aeroflow:aeroflow_secret@postgres/aeroflow_kb",
    )

    # Step 1: create aeroflow_kb database if it doesn't exist.
    # Must connect to the default 'aeroflow' DB to run CREATE DATABASE.
    admin_url = pg_url.rsplit("/", 1)[0] + "/aeroflow"
    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = 'aeroflow_kb'")
        )
        if not exists:
            await conn.execute(text("CREATE DATABASE aeroflow_kb"))
    await admin_engine.dispose()

    # Step 2: create all ORM-registered tables in aeroflow_kb.
    kb_engine = create_async_engine(pg_url)
    async with kb_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await kb_engine.dispose()

    yield


app = FastAPI(title="AeroFlow KB API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.router import router

app.include_router(router)
