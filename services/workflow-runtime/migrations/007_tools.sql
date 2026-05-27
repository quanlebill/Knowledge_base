CREATE TABLE IF NOT EXISTS tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  scope varchar NOT NULL DEFAULT 'tenant',
  name varchar NOT NULL,
  description text,
  type varchar NOT NULL,
  status varchar DEFAULT 'active',
  created_by uuid REFERENCES members(id),
  created_at timestamp DEFAULT now()
);
