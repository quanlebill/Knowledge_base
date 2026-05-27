CREATE TABLE IF NOT EXISTS agent_mcp (
  version_id uuid NOT NULL REFERENCES agent_versions(id),
  mcp_id uuid NOT NULL REFERENCES mcp(id),
  PRIMARY KEY (version_id, mcp_id)
);
