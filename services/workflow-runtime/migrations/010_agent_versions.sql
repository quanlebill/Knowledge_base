CREATE TABLE IF NOT EXISTS agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id),
  version integer NOT NULL,
  status varchar NOT NULL DEFAULT 'draft',
  workflow_version_id uuid,  -- nullable until Phase I
  reasoner_model_id uuid REFERENCES llm_providers(id),
  llm_config jsonb DEFAULT '{"temperature":0.2,"max_tokens":1000,"stream":true}',
  system_prompt_id uuid REFERENCES system_prompts(id),
  guardrail_id uuid REFERENCES guardrails(id),
  memory_enabled boolean DEFAULT false,
  retrieval_config jsonb DEFAULT '{"mode":"hybrid","top_k":10,"max_depth":3}',
  changelog varchar,
  created_by uuid REFERENCES members(id),
  published_at timestamp,
  UNIQUE (agent_id, version)
);
-- Add deferred FKs for circular reference with agents
ALTER TABLE agents ADD CONSTRAINT fk_agents_published_version
  FOREIGN KEY (published_version_id) REFERENCES agent_versions(id)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE agents ADD CONSTRAINT fk_agents_draft_version
  FOREIGN KEY (draft_version_id) REFERENCES agent_versions(id)
  DEFERRABLE INITIALLY DEFERRED;
