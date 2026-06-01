-- dataagent (created via POSTGRES_DB env var) — extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- runtime_writer: app user cho workflow-runtime
-- Table/schema grants được Alembic migration 0002_rbac chạy sau
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'runtime_writer') THEN
    CREATE ROLE runtime_writer LOGIN PASSWORD 'runtime_dev_pw';
  END IF;
END
$$;
GRANT CONNECT ON DATABASE dataagent TO runtime_writer;

-- langfuse database
CREATE DATABASE langfuse;
\c langfuse
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- litellm database
CREATE DATABASE litellm;

-- flow_builder database (canvas config, flow_nodes/flow_edges)
CREATE DATABASE flow_builder;
\c flow_builder
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
