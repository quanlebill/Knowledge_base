CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS "KB";

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "KB"."Language"        AS ENUM ('english', 'vietnamese');
CREATE TYPE "KB"."SourceType"      AS ENUM ('doc', 'web', 'image', 'video', 'warehouse');
CREATE TYPE "KB"."Tier"            AS ENUM ('bronze', 'silver', 'gold');
CREATE TYPE "KB"."PolicyFormat"    AS ENUM ('Natural Language', 'Exact Match For Word or Phrase');
CREATE TYPE "KB"."PolicyType"      AS ENUM ('Entity', 'Relationship Edge');
CREATE TYPE "KB"."ConflictType"    AS ENUM ('content_contradiction','content_conflict','content_duplicate','content_update','table_schema');
CREATE TYPE "KB"."ConflictSeverity" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "KB"."ConflictStatus"  AS ENUM ('pending', 'awaiting', 'resolved');
CREATE TYPE "KB"."TaskType"        AS ENUM ('embedding', 'Vision Language Model');
CREATE TYPE "KB"."SimilarityMetric" AS ENUM ('cosine', 'euclidean', 'dot');
CREATE TYPE "KB"."HttpMethod"      AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
CREATE TYPE "KB"."APIType"         AS ENUM ('NEO4J', 'QDRANT', 'RETRIEVE');

-- ── KB.Model ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."Model" (
    model_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name  VARCHAR(50),
    task_type   "KB"."TaskType" NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_task_type ON "KB"."Model" (task_type);

-- ── KB.ModelVersion ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."ModelVersion" (
    version_id     SERIAL PRIMARY KEY,
    model_id       UUID REFERENCES "KB"."Model"(model_id),
    version_number INT,
    added_on       TIMESTAMPTZ,
    added_by       UUID,
    config         JSONB,
    is_active      BOOL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_modelversion_active ON "KB"."ModelVersion" (model_id, version_id) WHERE is_active = TRUE;

-- ── KB.Data ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."Data" (
    data_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID NOT NULL,
    role_id      UUID NOT NULL,
    name         VARCHAR(50) UNIQUE,
    extension    VARCHAR(10),
    language     "KB"."Language",
    source_type  "KB"."SourceType" NOT NULL,
    current_tier "KB"."Tier" NOT NULL DEFAULT 'bronze',
    added_on     TIMESTAMPTZ,
    added_by     UUID,
    abstract     TEXT,
    metadata     JSONB,
    path         TEXT
);
CREATE INDEX IF NOT EXISTS idx_data_tenant_source   ON "KB"."Data" (tenant_id, source_type);
CREATE INDEX IF NOT EXISTS idx_data_tenant_role     ON "KB"."Data" (tenant_id, role_id);
CREATE INDEX IF NOT EXISTS idx_data_tenant_tier     ON "KB"."Data" (tenant_id, current_tier);

-- ── KB.LifecycleHistory ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."LifecycleHistory" (
    history_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_id         UUID NOT NULL REFERENCES "KB"."Data"(data_id),
    from_tier       "KB"."Tier",
    to_tier         "KB"."Tier" NOT NULL,
    transitioned_at TIMESTAMPTZ NOT NULL,
    approved_by     UUID,
    notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_data_id ON "KB"."LifecycleHistory" (data_id);

-- ── KB.FilterPolicy ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."FilterPolicy" (
    policy_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL,
    policy_name VARCHAR NOT NULL,
    configformat "KB"."PolicyFormat" NOT NULL,
    config      JSONB,
    is_active   BOOL DEFAULT FALSE,
    created_at  TIMESTAMPTZ,
    created_by  UUID,
    language    "KB"."Language"
);
CREATE INDEX IF NOT EXISTS idx_filterpolicy_tenant_lang ON "KB"."FilterPolicy" (tenant_id, language);

-- ── KB.ExtractionPolicy ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."ExtractionPolicy" (
    policy_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    policy_name     VARCHAR NOT NULL,
    policy_type     "KB"."PolicyType" NOT NULL,
    custom_override TEXT,
    created_at      TIMESTAMPTZ,
    created_by      UUID,
    language        "KB"."Language"
);
CREATE INDEX IF NOT EXISTS idx_extractionpolicy_tenant_lang ON "KB"."ExtractionPolicy" (tenant_id, language);

-- ── KB.Conflict ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."Conflict" (
    conflict_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id              UUID,
    conflict_type          "KB"."ConflictType" NOT NULL,
    detected_at            TIMESTAMPTZ,
    severity               "KB"."ConflictSeverity" NOT NULL,
    status                 "KB"."ConflictStatus" NOT NULL DEFAULT 'pending',
    detailed_explanation   TEXT,
    existing_snapshot      JSONB,
    incoming_snapshot      JSONB,
    resolution_instruction TEXT,
    resolved_at            TIMESTAMPTZ,
    resolved_by            UUID
);
CREATE INDEX IF NOT EXISTS idx_conflict_tenant_status_severity ON "KB"."Conflict" (tenant_id, status, severity);

-- ── KB.Warehouse ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."Warehouse" (
    warehouse_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service      VARCHAR(50) NOT NULL,
    description  TEXT
);

-- ── KB.Warehouse_Config ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."Warehouse_Config" (
    config_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id   UUID NOT NULL REFERENCES "KB"."Warehouse"(warehouse_id),
    version_number INT,
    is_active      BOOL,
    config         JSONB,
    created_at     TIMESTAMPTZ,
    created_by     UUID
);
CREATE INDEX IF NOT EXISTS idx_warehouseconfig_version   ON "KB"."Warehouse_Config" (warehouse_id, version_number);
CREATE INDEX IF NOT EXISTS idx_warehouseconfig_active    ON "KB"."Warehouse_Config" (warehouse_id) WHERE is_active = TRUE;

-- ── KB.Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."Table" (
    owner_id    UUID,
    table_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name  VARCHAR(50),
    description TEXT,
    schema      JSONB,
    created_on  TIMESTAMPTZ,
    created_by  UUID
);
CREATE INDEX IF NOT EXISTS idx_table_name     ON "KB"."Table" (table_name);
CREATE INDEX IF NOT EXISTS idx_table_owner_id ON "KB"."Table" (owner_id);

-- ── KB.TextBlock ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."TextBlock" (
    block_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id    UUID REFERENCES "KB"."Data"(data_id),
    block_index INT
);
CREATE INDEX IF NOT EXISTS idx_textblock_owner ON "KB"."TextBlock" (owner_id, block_id);

-- ── KB.TextBlockVersion ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."TextBlockVersion" (
    version_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id           UUID NOT NULL REFERENCES "KB"."TextBlock"(block_id),
    version_number     INT NOT NULL,
    content            TEXT,
    created_at         TIMESTAMPTZ,
    created_by         UUID,
    is_active          BOOL DEFAULT FALSE,
    table_involved     BOOL,
    embedding_model_id UUID REFERENCES "KB"."Model"(model_id),
    payload            JSONB
);
CREATE INDEX IF NOT EXISTS idx_textblockversion_active ON "KB"."TextBlockVersion" (block_id, version_number) WHERE is_active = TRUE;

-- ── KB.TextTable ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."TextTable" (
    version_id  UUID PRIMARY KEY REFERENCES "KB"."TextBlockVersion"(version_id),
    table_name  VARCHAR(50),
    description TEXT,
    data        JSONB
);

-- ── KB.QdrantConnection ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."QdrantConnection" (
    connection_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID,
    is_active        BOOL,
    created_at       TIMESTAMPTZ,
    total_collection INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_qdrantconn_active ON "KB"."QdrantConnection" (tenant_id) WHERE is_active = TRUE;

-- ── KB.QdrantCollection ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."QdrantCollection" (
    collection_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id    UUID NOT NULL REFERENCES "KB"."QdrantConnection"(connection_id),
    collection_name  VARCHAR(50) NOT NULL,
    is_active        BOOL,
    similarity_metric "KB"."SimilarityMetric" DEFAULT 'cosine',
    points_count     INT DEFAULT 0,
    vector_dimension INT,
    embedding_model_id UUID REFERENCES "KB"."Model"(model_id)
);
CREATE INDEX IF NOT EXISTS idx_qdrantcol_connection ON "KB"."QdrantCollection" (connection_id);

-- ── KB.Neo4jConnection ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."Neo4jConnection" (
    connection_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id          UUID,
    is_connected       BOOL,
    total_node         INT DEFAULT 0,
    total_edge         INT DEFAULT 0,
    created_at         TIMESTAMPTZ,
    embedding_model_id UUID REFERENCES "KB"."Model"(model_id)
);
CREATE INDEX IF NOT EXISTS idx_neo4jconn_active ON "KB"."Neo4jConnection" (tenant_id) WHERE is_connected = TRUE;

-- ── KB.Neo4jNode ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."Neo4jNode" (
    connection_id    UUID REFERENCES "KB"."Neo4jConnection"(connection_id),
    node_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_name        VARCHAR(50),
    node_description TEXT,
    inserted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_neo4jnode_connection ON "KB"."Neo4jNode" (connection_id);

-- ── KB.Neo4jRelationship ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."Neo4jRelationship" (
    from_node   UUID REFERENCES "KB"."Neo4jNode"(node_id),
    to_node     UUID REFERENCES "KB"."Neo4jNode"(node_id),
    score       FLOAT,
    description TEXT,
    PRIMARY KEY (from_node, to_node)
);

-- ── KB.EntityLookup ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."EntityLookup" (
    lookup_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alias_name     VARCHAR(50) NOT NULL,
    canonical_name VARCHAR(50) NOT NULL,
    created_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_entitylookup_alias ON "KB"."EntityLookup" USING HASH (alias_name);

-- ── KB.PublishAPI ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "KB"."PublishAPI" (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID,
    name         VARCHAR(50),
    type         "KB"."APIType",
    endpoint_url VARCHAR(100),
    http_method  "KB"."HttpMethod",
    is_published BOOL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_publishapi_active ON "KB"."PublishAPI" (tenant_id) WHERE is_published = TRUE;
