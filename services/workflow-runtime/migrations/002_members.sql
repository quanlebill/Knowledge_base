CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id varchar NOT NULL,
  role_id smallint,
  tenant_role varchar NOT NULL DEFAULT 'viewer',
  is_active boolean DEFAULT true,
  joined_at timestamp DEFAULT now(),
  deleted_at timestamp,
  UNIQUE (tenant_id, user_id)
);
