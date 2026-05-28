-- Idempotent seed data for dev environment

INSERT INTO tenants (id, name, slug, plan_id, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dev Tenant', 'dev', 1, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO llm_providers (id, name, model_id, type, is_default, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'Claude Haiku',  'planner',  'chat', false, true),
  ('00000000-0000-0000-0000-000000000011', 'Claude Sonnet', 'responder', 'chat', true,  true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO system_prompts (id, tenant_id, name, content, version)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  'Default',
  'You are a helpful assistant for GTEL platform.',
  1
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO agents (id, tenant_id, name, description)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000001',
  'Default Agent',
  'Default dev agent'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workflows (id, agent_id, name)
VALUES (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000030',
  'Default Workflow'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workflow_versions (id, workflow_id, version, status, published_at)
VALUES (
  '00000000-0000-0000-0000-000000000060',
  '00000000-0000-0000-0000-000000000050',
  1,
  'published',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO agent_versions (id, agent_id, version, status, workflow_version_id, responder_model_id, system_prompt_id)
VALUES (
  '00000000-0000-0000-0000-000000000040',
  '00000000-0000-0000-0000-000000000030',
  1,
  'published',
  '00000000-0000-0000-0000-000000000060',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000020'
)
ON CONFLICT (id) DO NOTHING;

UPDATE agents SET published_version_id = '00000000-0000-0000-0000-000000000040'
WHERE id = '00000000-0000-0000-0000-000000000030';

-- Backfill workflow_version_id nếu row đã tồn tại trước khi seed workflow
UPDATE agent_versions SET workflow_version_id = '00000000-0000-0000-0000-000000000060'
WHERE id = '00000000-0000-0000-0000-000000000040'
  AND workflow_version_id IS NULL;
