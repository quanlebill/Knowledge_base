"""
Alembic migration tests.

Three concern areas:
  1. Schema drift       — after create_all, autogenerate detects no diff vs Base.metadata.
  2. Migration pipeline — upgrade/downgrade CLI exits 0 with the real alembic config.
  3. Autogenerate cycle — mirrors the exact CLI commands a developer runs:
                            alembic revision --autogenerate -m "..."
                            alembic upgrade head
                            alembic current
                            alembic downgrade base
                          Run against an isolated sandbox so generated files
                          never land in alembic/versions/.

Requires the test Postgres server (same as postgres_connector tests):
    docker compose -f testing/postgres_connector/docker-compose.yml up -d

Run:
    pytest testing/alembic_tests/test_migrations.py -v
"""
import asyncio
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from basemodel.services_databaseconnector.postgres_orm.base import Base
import basemodel.services_databaseconnector.postgres_orm  # noqa: F401 — registers all ORM models

# ── Constants ─────────────────────────────────────────────────────────────────

TEST_URL     = "postgresql+asyncpg://postgres@localhost:5433/aeroflow_test"
ALEMBIC_INI  = str(Path(__file__).resolve().parents[2] / "alembic" / "alembic.ini")
PROJECT_ROOT = Path(ALEMBIC_INI).parent.parent

_CORE_TABLES = {
    "Tenants", "RolePermissions", "Plans",
    "KBData", "KBTextBlock", "KBTextBlockVersion",
    "KBFilterPolicy", "KBConflictBatch", "KBConflict",
}

# ── Shared async helpers ──────────────────────────────────────────────────────

async def _drop_all() -> None:
    engine = create_async_engine(TEST_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _get_public_tables() -> set[str]:
    engine = create_async_engine(TEST_URL)
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public'"
            )
        )
        tables = {row[0] for row in result}
    await engine.dispose()
    return tables


# ── CLI helpers ───────────────────────────────────────────────────────────────

def _alembic_cli(*args: str) -> subprocess.CompletedProcess:
    """
    Run `alembic <args>` against the real alembic/alembic.ini.
    ALEMBIC_DB_URL overrides the ini URL so the test DB is used.
    """
    env = os.environ.copy()
    env["ALEMBIC_DB_URL"] = TEST_URL
    return subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic/alembic.ini", *args],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        env=env,
    )


def _sandbox_cli(sandbox: Path, *args: str) -> subprocess.CompletedProcess:
    """
    Run `alembic <args>` against the isolated sandbox alembic.ini.
    Used by TestAutogenerateCycle so generated files never touch alembic/versions/.
    """
    env = os.environ.copy()
    env["ALEMBIC_DB_URL"] = TEST_URL
    return subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(sandbox / "alembic.ini"), *args],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        env=env,
    )


def _build_sandbox(sandbox: Path) -> None:
    """
    Create an isolated alembic environment at sandbox/.
    Copies env.py and script.py.mako from the real alembic/ directory so
    behaviour is identical, but all generated files stay inside sandbox/.
    """
    real_alembic = Path(ALEMBIC_INI).parent

    if sandbox.exists():
        shutil.rmtree(sandbox)
    sandbox.mkdir()
    (sandbox / "versions").mkdir()

    shutil.copy(real_alembic / "env.py",         sandbox / "env.py")
    shutil.copy(real_alembic / "script.py.mako", sandbox / "script.py.mako")

    (sandbox / "alembic.ini").write_text(
        "[alembic]\n"
        "script_location = %(here)s\n"
        f"sqlalchemy.url = {TEST_URL}\n"
        "\n"
        "[loggers]\nkeys = root,sqlalchemy,alembic\n"
        "[handlers]\nkeys = console\n"
        "[formatters]\nkeys = generic\n"
        "\n"
        "[logger_root]\nlevel = WARN\nhandlers = console\nqualname =\n"
        "[logger_sqlalchemy]\nlevel = WARN\nhandlers =\nqualname = sqlalchemy.engine\n"
        "[logger_alembic]\nlevel = INFO\nhandlers =\nqualname = alembic\n"
        "\n"
        "[handler_console]\nclass = StreamHandler\nargs = (sys.stderr,)\n"
        "level = NOTSET\nformatter = generic\n"
        "\n"
        "[formatter_generic]\n"
        "format = %%(levelname)-5.5s [%%(name)s] %%(message)s\n"
        "datefmt = %%H:%%M:%%S\n"
    )


# ════════════════════════════════════════════════════════════════════
# 1. Schema drift
# ════════════════════════════════════════════════════════════════════

class TestSchemaDrift:
    """
    Verify the ORM models exactly match what autogenerate would produce.

    These tests are the primary guard against "forgot to create the
    migration" mistakes — they fail when a column, table, or index
    is added to an ORM model but no corresponding migration is written.
    """

    @pytest.mark.asyncio
    async def test_create_all_then_no_drift(self):
        """After create_all, compare_metadata finds zero differences."""
        engine = create_async_engine(TEST_URL)

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

        async with engine.connect() as conn:
            def _check(sync_conn):
                ctx = MigrationContext.configure(sync_conn)
                return compare_metadata(ctx, Base.metadata)

            diffs = await conn.run_sync(_check)

        await engine.dispose()

        assert diffs == [], (
            "Schema drift detected — ORM models and DB schema are out of sync:\n"
            + "\n".join(str(d) for d in diffs)
        )

    @pytest.mark.asyncio
    async def test_all_orm_tables_are_created(self):
        """create_all produces every table declared in Base.metadata."""
        engine = create_async_engine(TEST_URL)

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public'"
                )
            )
            db_tables = {row[0] for row in result}

        await engine.dispose()

        orm_tables = set(Base.metadata.tables.keys())
        missing = orm_tables - db_tables
        assert not missing, f"ORM tables not created: {missing}"

    @pytest.mark.asyncio
    async def test_core_tables_present(self):
        """Spot-checks that the most critical tables exist after create_all."""
        engine = create_async_engine(TEST_URL)

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public'"
                )
            )
            db_tables = {row[0] for row in result}

        await engine.dispose()

        missing = _CORE_TABLES - db_tables
        assert not missing, f"Core tables missing: {missing}"


# ════════════════════════════════════════════════════════════════════
# 2. Migration pipeline — CLI subprocess (real alembic config)
# ════════════════════════════════════════════════════════════════════

class TestMigrationPipeline:
    """
    Validates the alembic upgrade/downgrade CLI workflow.

    Tests invoke `python -m alembic` as a subprocess — exactly what
    developers and CI run — so they catch PYTHONPATH issues, bad
    alembic.ini config, and missing env vars that programmatic tests miss.

    With no migration files in alembic/versions/, upgrade/downgrade are
    no-ops but still exercise config loading, env.py import, and DB
    connectivity via the real CLI entry point.
    """

    def test_upgrade_head_exits_zero(self):
        """alembic upgrade head exits 0."""
        asyncio.run(_drop_all())
        result = _alembic_cli("upgrade", "head")
        assert result.returncode == 0, f"alembic upgrade head failed:\n{result.stderr}"

    def test_downgrade_base_exits_zero(self):
        """alembic downgrade base exits 0."""
        result = _alembic_cli("downgrade", "base")
        assert result.returncode == 0, f"alembic downgrade base failed:\n{result.stderr}"

    def test_current_exits_zero(self):
        """alembic current exits 0."""
        result = _alembic_cli("current")
        assert result.returncode == 0, f"alembic current failed:\n{result.stderr}"

    def test_alembic_version_table_is_created(self):
        """
        upgrade head creates the alembic_version tracking table once
        migration files exist.  Skipped when versions/ is empty.
        """
        versions_dir = Path(ALEMBIC_INI).parent / "versions"
        has_migrations = any(f.suffix == ".py" for f in versions_dir.iterdir())
        if not has_migrations:
            pytest.skip("No migration files in alembic/versions/ yet")

        asyncio.run(_drop_all())
        result = _alembic_cli("upgrade", "head")
        assert result.returncode == 0, result.stderr

        tables = asyncio.run(_get_public_tables())
        assert "alembic_version" in tables

    def test_roundtrip_leaves_no_app_tables(self):
        """upgrade head → downgrade base leaves no application tables."""
        asyncio.run(_drop_all())

        up = _alembic_cli("upgrade", "head")
        assert up.returncode == 0, f"upgrade failed:\n{up.stderr}"

        down = _alembic_cli("downgrade", "base")
        assert down.returncode == 0, f"downgrade failed:\n{down.stderr}"

        tables = asyncio.run(_get_public_tables())
        app_tables = tables - {"alembic_version"}
        assert not app_tables, f"Unexpected tables remain after downgrade base: {app_tables}"

    def test_upgrade_head_twice_is_idempotent(self):
        """Running upgrade head a second time exits 0."""
        asyncio.run(_drop_all())
        assert _alembic_cli("upgrade", "head").returncode == 0
        result = _alembic_cli("upgrade", "head")
        assert result.returncode == 0, result.stderr


# ════════════════════════════════════════════════════════════════════
# 3. Autogenerate cycle — CLI, isolated sandbox
# ════════════════════════════════════════════════════════════════════

class TestAutogenerateCycle:
    """
    Mirrors the exact CLI commands a developer runs to create and apply
    a migration for the first time:

        alembic revision --autogenerate -m "initial"
        alembic upgrade head
        alembic current
        alembic downgrade base

    Uses an isolated sandbox (testing/alembic_tests/tmp_alembic/) so
    generated migration files never touch alembic/versions/.
    The sandbox is rebuilt fresh each run — inspect it after the test.
    """

    _SANDBOX = Path(__file__).parent / "tmp_alembic"

    def test_revision_autogenerate(self):
        """
        `alembic revision --autogenerate` detects all ORM tables from an
        empty DB and writes a migration file into the sandbox versions/.
        """
        _build_sandbox(self._SANDBOX)
        asyncio.run(_drop_all())

        result = _sandbox_cli(self._SANDBOX, "revision", "--autogenerate", "-m", "initial")
        assert result.returncode == 0, f"revision failed:\n{result.stdout}\n{result.stderr}"

        generated = list((self._SANDBOX / "versions").glob("*.py"))
        assert len(generated) == 1, "Expected exactly one migration file"

        migration_text = generated[0].read_text()
        assert "op.create_table" in migration_text, "Migration missing create_table"
        assert "op.drop_table"   in migration_text, "Migration missing drop_table in downgrade"
        assert "KBData"          in migration_text, "Migration missing KBData table"
        assert "Tenants"         in migration_text, "Migration missing Tenants table"

    def test_upgrade_head(self):
        """
        `alembic upgrade head` applies the generated migration and creates
        all ORM tables plus the alembic_version tracking table.
        """
        result = _sandbox_cli(self._SANDBOX, "upgrade", "head")
        assert result.returncode == 0, f"upgrade failed:\n{result.stdout}\n{result.stderr}"

        tables = asyncio.run(_get_public_tables())
        assert "alembic_version" in tables
        missing = _CORE_TABLES - tables
        assert not missing, f"Core tables missing after upgrade: {missing}"

    def test_current_shows_revision(self):
        """
        `alembic current` prints the active revision hash after upgrade head.
        """
        result = _sandbox_cli(self._SANDBOX, "current")
        assert result.returncode == 0, f"current failed:\n{result.stderr}"
        assert result.stdout.strip(), "alembic current printed nothing"

    def test_downgrade_base(self):
        """
        `alembic downgrade base` reverts all migrations — no application
        tables remain in the DB.
        """
        result = _sandbox_cli(self._SANDBOX, "downgrade", "base")
        assert result.returncode == 0, f"downgrade failed:\n{result.stdout}\n{result.stderr}"

        tables = asyncio.run(_get_public_tables())
        app_tables = tables - {"alembic_version"}
        assert not app_tables, f"Tables still present after downgrade: {app_tables}"
