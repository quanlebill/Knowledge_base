CREATE TABLE IF NOT EXISTS messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  role varchar NOT NULL CHECK (role IN ('user','assistant','tool')),
  content jsonb NOT NULL,
  metadata jsonb DEFAULT '{}',
  tokens_used integer,
  latency_ms integer,
  created_at timestamp NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON messages (conversation_id, created_at);

-- Default partition catches all dates without explicit partition
CREATE TABLE IF NOT EXISTS messages_default PARTITION OF messages DEFAULT;

-- Create partition for current month (2025-05) and next (2025-06)
CREATE TABLE IF NOT EXISTS messages_2025_05 PARTITION OF messages
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS messages_2025_06 PARTITION OF messages
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
