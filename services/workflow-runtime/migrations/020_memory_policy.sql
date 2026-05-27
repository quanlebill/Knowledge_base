CREATE TABLE IF NOT EXISTS memory_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id),
  action_type varchar NOT NULL,
  condition jsonb DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_by uuid REFERENCES members(id),
  created_at timestamp DEFAULT now()
);
