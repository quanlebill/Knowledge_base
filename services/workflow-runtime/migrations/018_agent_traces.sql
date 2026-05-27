CREATE TABLE IF NOT EXISTS agent_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  trace_index smallint NOT NULL,
  tool_name varchar NOT NULL,
  input jsonb DEFAULT '{}',
  output jsonb DEFAULT '{}',
  status varchar DEFAULT 'success',
  latency_ms integer,
  created_at timestamp DEFAULT now(),
  UNIQUE (message_id, trace_index)
);
