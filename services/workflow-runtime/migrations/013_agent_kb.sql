CREATE TABLE IF NOT EXISTS agent_kb (
  version_id uuid NOT NULL REFERENCES agent_versions(id),
  kb_connection_id uuid NOT NULL REFERENCES kb_connections(id),
  PRIMARY KEY (version_id, kb_connection_id)
);
