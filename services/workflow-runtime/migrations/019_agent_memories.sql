CREATE TABLE IF NOT EXISTS agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  agent_id uuid NOT NULL REFERENCES agents(id),
  scope varchar NOT NULL DEFAULT 'global',
  user_ref varchar,
  memory_type varchar NOT NULL,
  content text NOT NULL,
  embedding_ref varchar,
  importance float DEFAULT 0.5,
  expires_at timestamp,
  deleted_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
