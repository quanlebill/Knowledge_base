CREATE TABLE IF NOT EXISTS agent_tools (
  version_id uuid NOT NULL REFERENCES agent_versions(id),
  tool_id uuid NOT NULL REFERENCES tools(id),
  PRIMARY KEY (version_id, tool_id)
);
