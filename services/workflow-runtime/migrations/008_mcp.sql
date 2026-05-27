CREATE TABLE IF NOT EXISTS mcp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar NOT NULL,
  endpoint_url varchar NOT NULL,
  api_key_ref varchar,
  status varchar DEFAULT 'disconnected',
  capabilities jsonb DEFAULT '[]',
  created_by uuid REFERENCES members(id),
  created_at timestamp DEFAULT now()
);
