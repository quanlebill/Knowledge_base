CREATE INDEX IF NOT EXISTS idx_agent_memories_expires
  ON agent_memories(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_memories_deleted
  ON agent_memories(deleted_at)
  WHERE deleted_at IS NOT NULL;
