-- ─── Schema separation ───────────────────────────────────────────────
-- Keycloak uses its own schema; platform uses public; Kong uses kong schema
CREATE SCHEMA IF NOT EXISTS keycloak;
CREATE SCHEMA IF NOT EXISTS kong;

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

CREATE TABLE IF NOT EXISTS roles (
  id          smallserial PRIMARY KEY,
  name        varchar(50) UNIQUE NOT NULL,
  description text,
  is_system   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

INSERT INTO roles (name, description)
VALUES
  ('PLATFORM_ADMIN',    'Sovereign authority over all tenants and infrastructure'),
  ('AI_ENGINEER',       'Full access to AI runtime, models, and deployment pipelines'),
  ('BUSINESS_OPERATOR', 'Business-facing tools, dashboards, and reports'),
  ('EXECUTIVE',         'Read-only executive dashboards and compliance reports')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants(id),
  user_id     varchar(255) NOT NULL,   -- Keycloak sub claim
  role_id     smallint REFERENCES roles(id),
  tenant_role varchar(20) DEFAULT 'viewer',
  is_active   boolean DEFAULT true,
  joined_at   timestamptz DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (tenant_id, user_id)
);

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

CREATE TABLE IF NOT EXISTS keycloak_role_mappings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         smallint REFERENCES roles(id),
  keycloak_role   varchar(100) NOT NULL,
  keycloak_client varchar(100) NOT NULL,
  description     text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (role_id, keycloak_role)
);

-- ─── Auth & Security ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ip_allowlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid REFERENCES tenants(id),
  cidr       varchar(50) NOT NULL,
  label      varchar(255),
  is_active  boolean DEFAULT true,
  created_by uuid REFERENCES members(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id),
  created_by   uuid REFERENCES members(id),
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
  openbao_path    text NOT NULL,        -- pointer into OpenBao, never raw value
  version         smallint DEFAULT 1,
  is_active       boolean DEFAULT true,
  rotation_due_at timestamptz,
  last_rotated_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (tenant_id, key_name, version)
);

CREATE TABLE IF NOT EXISTS key_rotations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id    uuid REFERENCES secrets_vault(id),
  triggered_by varchar(20) DEFAULT 'MANUAL', -- SCHEDULED / MANUAL / PANIC
  actor_id     uuid REFERENCES members(id),
  old_version  smallint,
  new_version  smallint,
  status       varchar(10) DEFAULT 'SUCCESS', -- SUCCESS / FAILED
  error        text,
  rotated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id),
  created_by    uuid REFERENCES members(id),
  url           text NOT NULL,
  secret_ref    varchar(255),  -- HMAC signing secret OpenBao ref
  events        jsonb DEFAULT '[]',
  is_active     boolean DEFAULT true,
  failure_count smallint DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- ─── Audit & Compliance ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id),
  actor         varchar(255) NOT NULL,   -- free string, NOT FK — preserves log after user deletion
  actor_type    varchar(20) DEFAULT 'USER', -- USER / AGENT / SERVICE_ACCOUNT / SYSTEM
  action        varchar(100) NOT NULL,
  resource_type varchar(100),
  resource_id   varchar(255),
  status        varchar(10) DEFAULT 'SUCCESS', -- SUCCESS / WARNING / FAILED
  metadata      jsonb DEFAULT '{}',
  ip_address    varchar(50),
  created_at    timestamptz DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create initial monthly partitions
CREATE TABLE IF NOT EXISTS audit_logs_2026_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS pii_access_logs (
  id            uuid DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id),
  accessor_id   uuid REFERENCES members(id),
  accessor_type varchar(20) DEFAULT 'USER',
  data_subject  varchar(255),
  field_accessed varchar(100),
  access_reason text,
  scrubbed      boolean DEFAULT false,
  status        varchar(10) DEFAULT 'GRANTED', -- GRANTED / DENIED / REDACTED
  created_at    timestamptz DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS pii_access_logs_2026_05 PARTITION OF pii_access_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS pii_access_logs_2026_06 PARTITION OF pii_access_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- ─── Indexes ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_members_tenant_user ON members(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_secrets_vault_tenant_name ON secrets_vault(tenant_id, key_name, version);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ip_allowlists_tenant ON ip_allowlists(tenant_id);
