CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  agent_version_id uuid NOT NULL REFERENCES agent_versions(id),
  user_ref varchar,
  channel varchar NOT NULL DEFAULT 'web',
  status varchar DEFAULT 'active',
  started_at timestamp DEFAULT now(),
  ended_at timestamp
);
