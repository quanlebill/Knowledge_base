-- ─── Schema separation ───────────────────────────────────────────────
-- Keycloak uses its own schema; platform uses public; Kong uses kong schema
CREATE SCHEMA IF NOT EXISTS keycloak;
CREATE SCHEMA IF NOT EXISTS kong;

-- gen_random_uuid() is built-in since PostgreSQL 13; pgcrypto adds it for older versions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Platform Core ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id            smallserial PRIMARY KEY,
  name          varchar(50) UNIQUE NOT NULL,
  max_users     integer,
  max_envs      smallint,
  max_secrets   integer,
  max_deploy_daily integer,
  max_api_keys  integer,
  features      jsonb DEFAULT '{}'
);

INSERT INTO plans (name, max_users, max_envs, max_secrets, max_deploy_daily, max_api_keys, features)
VALUES
  ('STARTER',      10,  2,  20,  5,  5,  '{"sso":false,"audit":false,"mcp_gateway":false}'),
  ('PROFESSIONAL', 50,  5,  100, 20, 20, '{"sso":true,"audit":true,"mcp_gateway":false}'),
  ('ENTERPRISE',   -1, -1, -1,  -1, -1, '{"sso":true,"audit":true,"mcp_gateway":true}')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           varchar(255) NOT NULL,
  slug           varchar(100) UNIQUE NOT NULL,
  plan_id        smallint REFERENCES plans(id),
  data_residency varchar(20) DEFAULT 'Asia-SE1',
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  deleted_at     timestamptz
);

-- Dev seed tenants — UUID must match tenant_id attribute in realm-export.json users
INSERT INTO tenants (id, name, slug, plan_id, data_residency)
VALUES ('a0000000-0000-0000-0000-000000000001', 'AeroFlow Dev', 'aeroflow-dev', 3, 'Asia-SE1')
ON CONFLICT (slug) DO NOTHING;

-- Tenant 2: Helios Corp (EU) — users: helios-admin, helios-engineer, helios-viewer
INSERT INTO tenants (id, name, slug, plan_id, data_residency)
VALUES ('b0000000-0000-0000-0000-000000000002', 'Helios Corp', 'helios-corp', 2, 'EU-West1')
ON CONFLICT (slug) DO NOTHING;

-- ─── RBAC — Permission Matrix ─────────────────────────────────────────
-- role_id matches the JWT claim injected by Keycloak user attribute mapper.
-- Identity (who you are) lives in Keycloak + JWT.
-- Authorization (what you can do) lives here.

CREATE TABLE IF NOT EXISTS role_permissions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id   varchar(50) NOT NULL,
  resource  varchar(100) NOT NULL,
  action    varchar(50) NOT NULL,
  UNIQUE (role_id, resource, action)
);

INSERT INTO role_permissions (role_id, resource, action) VALUES
  ('platform-admin', 'pipeline',    'create'),
  ('platform-admin', 'pipeline',    'approve'),
  ('platform-admin', 'pipeline',    'rollback'),
  ('platform-admin', 'pipeline',    'read'),
  ('platform-admin', 'tenant',      'create'),
  ('platform-admin', 'tenant',      'delete'),
  ('platform-admin', 'audit_log',   'read_all'),
  ('platform-admin', 'secret',      'manage'),
  ('platform-admin', 'agent',       'create'),
  ('platform-admin', 'agent',       'delete'),
  ('platform-admin', 'drift',       'detect'),
  ('platform-admin', 'drift',       'resolve'),
  ('ai-engineer',    'pipeline',    'create'),
  ('ai-engineer',    'pipeline',    'approve'),
  ('ai-engineer',    'pipeline',    'read'),
  ('ai-engineer',    'agent',       'create'),
  ('ai-engineer',    'agent',       'delete'),
  ('ai-engineer',    'secret',      'manage'),
  ('ai-engineer',    'audit_log',   'read_own'),
  ('ai-engineer',    'drift',       'detect'),
  ('ai-engineer',    'drift',       'resolve'),
  ('executive-viewer', 'dashboard', 'read'),
  ('executive-viewer', 'audit_log', 'read_own'),
  ('executive-viewer', 'pipeline',  'read')
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- ─── Keycloak multi-realm config ──────────────────────────────────────
-- Per-tenant Keycloak realm config for enterprise SSO (client_secret_ref → OpenBao path).

CREATE TABLE IF NOT EXISTS keycloak_realm_configs (
  tenant_id          uuid PRIMARY KEY REFERENCES tenants(id),
  realm_name         varchar(100) UNIQUE NOT NULL,
  keycloak_base_url  text NOT NULL,
  client_id          varchar(100) NOT NULL,
  client_secret_ref  text NOT NULL,  -- OpenBao path, never raw secret
  jwks_url           text NOT NULL,
  token_endpoint     text NOT NULL,
  token_ttl_seconds  integer DEFAULT 900,
  is_active          boolean DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ─── Auth & Security ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ip_allowlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid REFERENCES tenants(id),
  cidr       varchar(50) NOT NULL,
  label      varchar(255),
  is_active  boolean DEFAULT true,
  created_by varchar(255),            -- Keycloak sub (X-User-Id)
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id),
  created_by   varchar(255) NOT NULL, -- Keycloak sub (X-User-Id)
  name         varchar(255) NOT NULL,
  key_hash     varchar(255) UNIQUE NOT NULL, -- bcrypt(key), never raw
  key_prefix   varchar(20) NOT NULL,          -- visible prefix for identification
  scope        varchar(30) DEFAULT 'read_only',
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz DEFAULT now(),
  rotated_from uuid REFERENCES api_keys(id)  -- self-ref for rotation audit chain
);

CREATE TABLE IF NOT EXISTS secrets_vault (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id),
  key_name        varchar(255) NOT NULL,
  key_type        varchar(50) NOT NULL, -- ENCRYPTION_KEY / SIGNING_KEY / HMAC_KEY / BEARER_TOKEN / MCP_TOKEN / KB_API_KEY
  algorithm       varchar(50),
  realm           varchar(100),         -- domain grouping (FINANCE-INFRA, AI-RUNTIME, …)
  openbao_path    text NOT NULL,        -- pointer into OpenBao KV v2, never raw value
  version         smallint DEFAULT 1,
  is_active       boolean DEFAULT true,
  rotation_due_at timestamptz,
  last_rotated_at timestamptz,
  created_by      varchar(255),         -- Keycloak sub (X-User-Id)
  created_at      timestamptz DEFAULT now(),
  UNIQUE (tenant_id, key_name, version)
);

CREATE TABLE IF NOT EXISTS key_rotations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id    uuid REFERENCES secrets_vault(id),
  triggered_by varchar(20) DEFAULT 'MANUAL' CHECK (triggered_by IN ('SCHEDULED','MANUAL','PANIC','REVEAL')),
  actor_id     varchar(255),                 -- Keycloak sub (X-User-Id)
  old_version  smallint,
  new_version  smallint,
  status       varchar(10) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','FAILED')),
  error        text,
  access_reason text,
  rotated_at   timestamptz DEFAULT now(),
  CONSTRAINT kr_reveal_needs_reason CHECK (triggered_by <> 'REVEAL' OR access_reason IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id),
  created_by    varchar(255),            -- Keycloak sub (X-User-Id)
  url           text NOT NULL,
  secret_ref    varchar(255),            -- HMAC signing secret OpenBao ref
  events        jsonb DEFAULT '[]',
  is_active     boolean DEFAULT true,
  failure_count smallint DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- ─── Audit & Compliance ───────────────────────────────────────────────
-- Audit log writer: Keycloak Event Listener SPI → Kafka topic audit.auth.events
-- → Consumer (at-least-once delivery) → INSERT here. Never written directly from services.

CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id),
  actor           varchar(255) NOT NULL,  -- free string, NOT FK — preserves log after user deletion
  actor_type      varchar(20) DEFAULT 'USER', -- USER / AGENT / SERVICE_ACCOUNT / SYSTEM
  action          varchar(100) NOT NULL,
  resource_type   varchar(100),
  resource_id     varchar(255),
  status          varchar(10) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','WARNING','FAILED')),
  metadata        jsonb DEFAULT '{}',
  ip_address      varchar(50),
  -- Keycloak event UUID used for at-least-once deduplication in audit-consumer.
  -- Not globally UNIQUE (partitioned tables require partition key in constraint);
  -- dedup is enforced at application layer via point-read before insert.
  source_event_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly partitions — add new partition each month. Records > 12 months → archive to MinIO/S3.
CREATE TABLE IF NOT EXISTS audit_logs_2026_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_07 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- Catch-all for rows that fall outside defined monthly ranges.
CREATE TABLE IF NOT EXISTS audit_logs_default PARTITION OF audit_logs DEFAULT;

-- Immutability enforcement: block UPDATE and DELETE on audit_logs (compliance requirement)
CREATE OR REPLACE FUNCTION fn_audit_logs_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable — UPDATE/DELETE are not allowed (compliance audit trail)';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_immutable();

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_immutable();

CREATE TABLE IF NOT EXISTS pii_access_logs (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id      uuid REFERENCES tenants(id),
  accessor_id    varchar(255),           -- Keycloak sub (X-User-Id)
  accessor_type  varchar(20) DEFAULT 'USER',
  data_subject   varchar(255),
  field_accessed varchar(100),
  access_reason  text,
  scrubbed       boolean DEFAULT false,
  status         varchar(10) DEFAULT 'GRANTED' CHECK (status IN ('GRANTED','DENIED','REDACTED')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS pii_access_logs_2026_05 PARTITION OF pii_access_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS pii_access_logs_2026_06 PARTITION OF pii_access_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS pii_access_logs_default PARTITION OF pii_access_logs DEFAULT;

-- ─── Indexes ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
-- Fast prefix-based lookup (e.g. display "ak_prod_****") without scanning key_hash.
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_tenant_prefix ON api_keys(tenant_id, key_prefix);
CREATE INDEX IF NOT EXISTS idx_secrets_vault_tenant_name ON secrets_vault(tenant_id, key_name, version);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_source_event ON audit_logs(source_event_id) WHERE source_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_allowlists_tenant ON ip_allowlists(tenant_id);
