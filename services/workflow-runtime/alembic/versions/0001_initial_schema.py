"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-28
"""
from alembic import op
from sqlalchemy import DDL

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS tenants (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name varchar NOT NULL,
          slug varchar UNIQUE NOT NULL,
          plan_id smallint,
          data_residency varchar DEFAULT 'Asia-SE1',
          is_active boolean DEFAULT true,
          created_at timestamp DEFAULT now(),
          deleted_at timestamp
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS members (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id),
          user_id varchar NOT NULL,
          role_id smallint,
          tenant_role varchar NOT NULL DEFAULT 'viewer',
          is_active boolean DEFAULT true,
          joined_at timestamp DEFAULT now(),
          deleted_at timestamp,
          UNIQUE (tenant_id, user_id)
        )
    """))

    op.execute(DDL("""
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
        )
    """))
    op.execute(DDL("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_providers_default
          ON llm_providers (type) WHERE is_default = true
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS kb_connections (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id),
          name varchar NOT NULL,
          endpoint_url varchar NOT NULL,
          api_key_ref varchar,
          status varchar DEFAULT 'disconnected',
          last_synced_at timestamp,
          created_by uuid REFERENCES members(id),
          created_at timestamp DEFAULT now()
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS system_prompts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id),
          name varchar NOT NULL,
          content text NOT NULL,
          version integer DEFAULT 1,
          is_active boolean DEFAULT true,
          created_by uuid REFERENCES members(id),
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS guardrails (
          id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name               varchar NOT NULL,
          type               varchar NOT NULL CHECK (type IN ('input','output','tool_call')),
          conditions         jsonb DEFAULT '{}',
          action             varchar NOT NULL CHECK (action IN ('block','warn','log')),
          priority           integer DEFAULT 0,
          guardrail_model_id uuid REFERENCES llm_providers(id),
          created_by         uuid REFERENCES members(id),
          created_at         timestamp DEFAULT now()
        )
    """))

    # Tools: platform-level only, no tenant_id or scope
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS tools (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name        varchar NOT NULL,
          description text,
          type        varchar NOT NULL,
          status      varchar DEFAULT 'active',
          created_by  uuid REFERENCES members(id),
          created_at  timestamp DEFAULT now()
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS mcp (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id),
          name varchar NOT NULL,
          endpoint_url varchar NOT NULL,
          api_key_ref varchar,
          status varchar DEFAULT 'disconnected',
          capabilities jsonb DEFAULT '[]',
          created_by uuid REFERENCES members(id),
          created_at timestamp DEFAULT now()
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS agents (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id),
          name varchar NOT NULL,
          description varchar,
          language varchar DEFAULT 'vi',
          published_version_id uuid,
          draft_version_id uuid,
          is_active boolean DEFAULT true,
          deleted_at timestamp,
          created_by uuid REFERENCES members(id),
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS agent_versions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id uuid NOT NULL REFERENCES agents(id),
          version integer NOT NULL,
          status varchar NOT NULL DEFAULT 'draft',
          workflow_version_id uuid,
          responder_model_id uuid REFERENCES llm_providers(id),
          llm_config jsonb DEFAULT '{"temperature":0.2,"max_tokens":1000,"stream":true}',
          system_prompt_id uuid REFERENCES system_prompts(id),
          guardrail_id uuid REFERENCES guardrails(id),
          memory_enabled boolean DEFAULT false,
          retrieval_config jsonb DEFAULT '{"mode":"hybrid","top_k":10,"max_depth":3}',
          changelog varchar,
          created_by uuid REFERENCES members(id),
          published_at timestamp,
          created_at timestamp DEFAULT now(),
          UNIQUE (agent_id, version)
        )
    """))
    op.execute(DDL("""
        ALTER TABLE agents ADD CONSTRAINT fk_agents_published_version
          FOREIGN KEY (published_version_id) REFERENCES agent_versions(id)
          DEFERRABLE INITIALLY DEFERRED
    """))
    op.execute(DDL("""
        ALTER TABLE agents ADD CONSTRAINT fk_agents_draft_version
          FOREIGN KEY (draft_version_id) REFERENCES agent_versions(id)
          DEFERRABLE INITIALLY DEFERRED
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS workflows (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id    uuid NOT NULL REFERENCES agents(id),
          name        varchar NOT NULL,
          description varchar,
          is_active   boolean NOT NULL DEFAULT true,
          created_by  uuid REFERENCES members(id),
          created_at  timestamp DEFAULT now(),
          updated_at  timestamp DEFAULT now()
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS workflow_versions (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id uuid NOT NULL REFERENCES workflows(id),
          version     integer NOT NULL,
          status      varchar NOT NULL DEFAULT 'draft',
          changelog   varchar,
          created_by  uuid REFERENCES members(id),
          published_at timestamp,
          created_at  timestamp DEFAULT now(),
          UNIQUE (workflow_id, version)
        )
    """))
    op.execute(DDL("""
        ALTER TABLE agent_versions ADD CONSTRAINT fk_agent_versions_workflow_version
          FOREIGN KEY (workflow_version_id) REFERENCES workflow_versions(id)
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS agent_kb (
          version_id uuid NOT NULL REFERENCES agent_versions(id),
          kb_connection_id uuid NOT NULL REFERENCES kb_connections(id),
          PRIMARY KEY (version_id, kb_connection_id)
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS agent_tools (
          version_id uuid NOT NULL REFERENCES agent_versions(id),
          tool_id uuid NOT NULL REFERENCES tools(id),
          PRIMARY KEY (version_id, tool_id)
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS agent_mcp (
          version_id uuid NOT NULL REFERENCES agent_versions(id),
          mcp_id uuid NOT NULL REFERENCES mcp(id),
          PRIMARY KEY (version_id, mcp_id)
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS conversations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id),
          agent_version_id uuid NOT NULL REFERENCES agent_versions(id),
          user_ref varchar,
          channel varchar NOT NULL DEFAULT 'web',
          status varchar DEFAULT 'active',
          started_at timestamp DEFAULT now(),
          ended_at timestamp
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages (
          id uuid NOT NULL DEFAULT gen_random_uuid(),
          conversation_id uuid NOT NULL REFERENCES conversations(id),
          role varchar NOT NULL CHECK (role IN ('user','assistant','tool')),
          content jsonb NOT NULL,
          metadata jsonb DEFAULT '{}',
          tokens_used integer,
          latency_ms integer,
          created_at timestamp NOT NULL DEFAULT now()
        ) PARTITION BY RANGE (created_at)
    """))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON messages (conversation_id, created_at)"))
    op.execute(DDL("CREATE TABLE IF NOT EXISTS messages_default PARTITION OF messages DEFAULT"))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2025_05 PARTITION OF messages
          FOR VALUES FROM ('2025-05-01') TO ('2025-06-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2025_06 PARTITION OF messages
          FOR VALUES FROM ('2025-06-01') TO ('2025-07-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_01 PARTITION OF messages
          FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_02 PARTITION OF messages
          FOR VALUES FROM ('2026-02-01') TO ('2026-03-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_03 PARTITION OF messages
          FOR VALUES FROM ('2026-03-01') TO ('2026-04-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_04 PARTITION OF messages
          FOR VALUES FROM ('2026-04-01') TO ('2026-05-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_05 PARTITION OF messages
          FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_06 PARTITION OF messages
          FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_07 PARTITION OF messages
          FOR VALUES FROM ('2026-07-01') TO ('2026-08-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_08 PARTITION OF messages
          FOR VALUES FROM ('2026-08-01') TO ('2026-09-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_09 PARTITION OF messages
          FOR VALUES FROM ('2026-09-01') TO ('2026-10-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_10 PARTITION OF messages
          FOR VALUES FROM ('2026-10-01') TO ('2026-11-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_11 PARTITION OF messages
          FOR VALUES FROM ('2026-11-01') TO ('2026-12-01')
    """))
    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS messages_2026_12 PARTITION OF messages
          FOR VALUES FROM ('2026-12-01') TO ('2027-01-01')
    """))

    op.execute(DDL("""
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
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS agent_memories (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id),
          agent_id uuid NOT NULL REFERENCES agents(id),
          scope varchar NOT NULL DEFAULT 'global',
          user_ref varchar,
          memory_type varchar NOT NULL,
          content text NOT NULL,
          embedding_ref varchar,
          importance float DEFAULT 0.5,
          expires_at timestamp,
          deleted_at timestamp,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
    """))

    op.execute(DDL("""
        CREATE TABLE IF NOT EXISTS memory_policy (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id uuid NOT NULL REFERENCES agents(id),
          action_type varchar NOT NULL,
          condition jsonb DEFAULT '{}',
          enabled boolean DEFAULT true,
          created_by uuid REFERENCES members(id),
          created_at timestamp DEFAULT now()
        )
    """))

    # ── Indexes ──────────────────────────────────────────────────────────────
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents (tenant_id) WHERE deleted_at IS NULL"))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_agents_tenant_active ON agents (tenant_id, is_active)"))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON agent_versions (agent_id, status)"))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations (tenant_id)"))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_conversations_agent_version ON conversations (agent_version_id)"))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_agent_traces_message ON agent_traces (message_id)"))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_kb_connections_tenant ON kb_connections (tenant_id)"))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_mcp_tenant ON mcp (tenant_id)"))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_system_prompts_tenant ON system_prompts (tenant_id)"))
    op.execute(DDL("CREATE INDEX IF NOT EXISTS idx_workflows_agent ON workflows (agent_id)"))
    op.execute(DDL("""
        CREATE INDEX IF NOT EXISTS idx_agent_memories_expires
          ON agent_memories(expires_at) WHERE expires_at IS NOT NULL
    """))
    op.execute(DDL("""
        CREATE INDEX IF NOT EXISTS idx_agent_memories_deleted
          ON agent_memories(deleted_at) WHERE deleted_at IS NOT NULL
    """))
    op.execute(DDL("""
        CREATE INDEX IF NOT EXISTS idx_agent_memories_tenant_agent
          ON agent_memories (tenant_id, agent_id) WHERE deleted_at IS NULL
    """))


def downgrade() -> None:
    op.execute(DDL("DROP TABLE IF EXISTS memory_policy CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS agent_memories CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS agent_traces CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS messages CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS conversations CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS agent_mcp CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS agent_tools CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS agent_kb CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS workflow_versions CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS workflows CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS agent_versions CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS agents CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS mcp CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS tools CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS guardrails CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS system_prompts CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS kb_connections CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS llm_providers CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS members CASCADE"))
    op.execute(DDL("DROP TABLE IF EXISTS tenants CASCADE"))
