CREATE TABLE IF NOT EXISTS kb_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar NOT NULL,
  endpoint_url varchar NOT NULL,
  api_key_ref varchar,
  status varchar DEFAULT 'disconnected',
  last_synced_at timestamp,
  created_by uuid REFERENCES members(id),
  created_at timestamp DEFAULT now()
);
