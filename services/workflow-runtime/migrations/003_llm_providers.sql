CREATE TABLE IF NOT EXISTS llm_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  model_id varchar NOT NULL,
  endpoint_url varchar,
  type varchar NOT NULL CHECK (type IN ('chat','reranker','embedder')),
  is_default boolean DEFAULT false,
  max_tokens integer,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
-- Only one default per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_providers_default
  ON llm_providers (type) WHERE is_default = true;
