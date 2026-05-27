CREATE TABLE IF NOT EXISTS workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id),
  version integer NOT NULL,
  status varchar NOT NULL DEFAULT 'draft',
  changelog varchar,
  created_by uuid REFERENCES members(id),
  published_at timestamp,
  created_at timestamp DEFAULT now(),
  UNIQUE (workflow_id, version)
);
-- Now that workflow_versions exists, add FK from agent_versions
ALTER TABLE agent_versions ADD CONSTRAINT fk_agent_versions_workflow_version
  FOREIGN KEY (workflow_version_id) REFERENCES workflow_versions(id);
