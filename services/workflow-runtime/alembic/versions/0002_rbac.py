"""rbac: runtime_writer postgres role

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-29
"""
import os
from alembic import op
from sqlalchemy import DDL

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    password = os.environ.get("RUNTIME_DB_PASSWORD", "runtime_dev_pw")
    safe_pw = password.replace("'", "''")  # escape for SQL string literal

    op.execute(DDL(f"""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'runtime_writer') THEN
            CREATE ROLE runtime_writer LOGIN PASSWORD '{safe_pw}';
          END IF;
        END
        $$
    """))
    op.execute(DDL("GRANT CONNECT ON DATABASE dataagent TO runtime_writer"))
    op.execute(DDL("GRANT USAGE ON SCHEMA public TO runtime_writer"))
    op.execute(DDL("GRANT SELECT ON members, tenants, agents, agent_versions TO runtime_writer"))
    op.execute(DDL("GRANT INSERT, SELECT ON conversations, messages, agent_traces TO runtime_writer"))


def downgrade() -> None:
    op.execute(DDL("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM runtime_writer"))
    op.execute(DDL("REVOKE ALL ON SCHEMA public FROM runtime_writer"))
    op.execute(DDL("REVOKE CONNECT ON DATABASE dataagent FROM runtime_writer"))
    op.execute(DDL("DROP ROLE IF EXISTS runtime_writer"))
