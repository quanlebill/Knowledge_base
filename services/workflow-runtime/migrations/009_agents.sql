CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar NOT NULL,
  description varchar,
  language varchar DEFAULT 'vi',
  published_version_id uuid,
  draft_version_id uuid,
  is_active boolean DEFAULT true,
  deleted_at timestamp,
  created_by uuid REFERENCES members(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
