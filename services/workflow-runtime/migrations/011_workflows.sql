CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id),
  name varchar NOT NULL,
  description varchar,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES members(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
