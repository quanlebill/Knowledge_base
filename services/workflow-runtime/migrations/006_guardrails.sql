CREATE TABLE IF NOT EXISTS guardrails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  type varchar NOT NULL CHECK (type IN ('input','output','tool_call')),
  conditions jsonb DEFAULT '{}',
  action varchar NOT NULL CHECK (action IN ('block','warn','log')),
  priority integer DEFAULT 0,
  created_by uuid REFERENCES members(id),
  created_at timestamp DEFAULT now()
);
