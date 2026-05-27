CREATE TABLE IF NOT EXISTS system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar NOT NULL,
  content text NOT NULL,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES members(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
