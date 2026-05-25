# AeroFlow AI OS — API Contracts

This document is the single source of truth between the **frontend (UI)** and the **backend** teams.
Every endpoint listed here is called by the React application. The backend must implement each one
with the exact method, path, request body, and response shape described.

Base URL (Kong gateway in production, mock server on port 4000 in dev):
```
http://localhost:4000   ← dev mock  (node testing/server.js)
http://localhost:8000   ← Kong gateway (production)
```

All responses are `Content-Type: application/json`.
All authenticated requests carry `Authorization: Bearer <JWT>`.
Kong injects `X-User-Id`, `X-User-Roles`, `X-User-Email` headers — the backend reads those, never re-verifies the JWT.

---

## 1. Data Layer — Documents

### 1.1 List all documents
```
GET /api/data/documents
```
**Used by:** `AppStateContext` on startup — populates the global document store.

**Query parameters (optional — backend SHOULD support):**

| Param   | Values              | Description                              |
|---------|---------------------|------------------------------------------|
| `layer` | `BRONZE\|SILVER\|GOLD` | Filter by pipeline layer              |
| `types` | `Doc,Web`           | Comma-separated type prefixes to include |

> The UI **client-side** already filters out `Video/*` and `Image/*` from the inventory view.
> The backend SHOULD support the `?types=Doc,Web` param so unnecessary data is never sent over the wire.

**Response — 200:**
```json
[
  {
    "id": "d1",
    "name": "Standard_Refund_Policy_v2.pdf",
    "layer": "BRONZE",
    "status": "PUBLISHED",
    "version": "v3.1",
    "lastUpdated": "2026-05-22",
    "author": "System",
    "metadata": {
      "tenant": "GlobalCorp",
      "type": "Doc/pdf",
      "language": "English",
      "accessRole": "all"
    }
  }
]
```

**Document `metadata.type` vocabulary:**

| Value        | Pipeline-processable | Notes                              |
|--------------|---------------------|------------------------------------|
| `Doc/pdf`    | YES                 | OCR → chunk → embed                |
| `Doc/docx`   | YES                 | Extract text → chunk → embed       |
| `Doc/md`     | YES                 | Direct text → chunk → embed        |
| `Doc/xlsx`   | YES                 | Table extraction                   |
| `Doc/csv`    | YES                 | Row-level ingestion                |
| `Web`        | YES                 | Crawl → extract → chunk → embed    |
| `Video/mp4`  | NO                  | Stored only, not chunked/embedded  |
| `Image/png`  | NO                  | Stored only, not chunked/embedded  |

**Backend action:** `SELECT * FROM documents WHERE tenant_id = :tenantId ORDER BY last_updated DESC`

---

### 1.2 Update a document
```
PATCH /api/data/documents/:docId
```
**Used by:**
- `AssetInventory` — promote a document to the next pipeline layer (Bronze→Silver, Silver→Gold)
- `AssetDetailWorkspace` — update `metadata.accessRole` on a Bronze document

**Request body** (send only the fields that changed):
```json
{
  "layer": "SILVER",
  "status": "EMBEDDING",
  "metadata": {
    "accessRole": "kb_editor"
  }
}
```

**Layer promotion rules the backend must enforce:**

| From   | To     | Status set automatically |
|--------|--------|--------------------------|
| BRONZE | SILVER | `EMBEDDING`              |
| SILVER | GOLD   | `PUBLISHED`              |

**Response — 200:** Full updated document object (same shape as §1.1 items).

**Response — 404:**
```json
{ "error": "Document not found" }
```

**Backend action:**
```sql
UPDATE documents
SET layer = :layer, status = :status, metadata = metadata || :metadata, last_updated = NOW()
WHERE id = :docId AND tenant_id = :tenantId
RETURNING *;
```

> `accessRole` is locked after Bronze — reject PATCH on `metadata.accessRole` if `layer != 'BRONZE'`.

---

## 2. Data Layer — Agents & Runtime

### 2.1 List agents
```
GET /api/data/agents
```
**Used by:** Agent Registry — Overview, detail drawers, health cards.

**Response — 200:**
```json
[
  {
    "id": "agt-001",
    "name": "Customer Support Bot",
    "type": "RAG",
    "tenant": "BlueChip Enterprise",
    "project": "Service Desk",
    "environment": "PROD",
    "status": "ACTIVE",
    "version": "4.2.1",
    "kbConnection": "kb-corporate-v4",
    "tools": ["ticketing", "crm_lookup"],
    "lastRun": "2m ago",
    "errorRate": 0.2,
    "cost": 4.25,
    "owner": "Sarah Connor",
    "latency": "420ms",
    "healthScore": 98,
    "description": "Handles basic customer inquiries using corporate knowledge base.",
    "businessPurpose": "Reduce human agent workload by 40%."
  }
]
```

**Backend action:** `SELECT * FROM agents WHERE tenant_id = :tenantId`

---

### 2.2 List execution traces
```
GET /api/data/traces
```
**Used by:** Agent Registry → Trace Explorer.

**Response — 200:**
```json
[
  {
    "id": "trace-8821",
    "agentId": "agt-001",
    "agentName": "Customer Support Bot",
    "tenant": "BlueChip Enterprise",
    "project": "Service Desk",
    "query": "How do I reset my subscription?",
    "status": "SUCCESS",
    "latency": 1450,
    "tokens": 840,
    "cost": 0.012,
    "toolCalls": 1,
    "retrievalCount": 3,
    "timestamp": "2025-05-16 10:42:15"
  }
]
```

---

### 2.3 List configs
```
GET /api/data/configs
```
**Used by:** Agent Registry → Config Registry.

**Response — 200:**
```json
[
  {
    "id": "cfg-001",
    "name": "Standard RAG Prompt",
    "type": "PROMPT",
    "version": "v2.1",
    "usedBy": ["agt-001", "agt-005"],
    "environment": "PROD",
    "lastModified": "2 days ago",
    "owner": "Sarah Connor",
    "validationStatus": "PASS",
    "content": "template: |\n  You are a helpful assistant...\n"
  }
]
```

---

### 2.4 List active runs
```
GET /api/data/runs
```
**Used by:** Agent Registry → Run Registry (live executions).

**Response — 200:**
```json
[
  {
    "id": "run-990",
    "agentId": "agt-001",
    "agentName": "Customer Support Bot",
    "tenant": "BlueChip Enterprise",
    "project": "Service Desk",
    "environment": "PROD",
    "trigger": "API",
    "status": "ACTIVE",
    "startedAt": "1m ago",
    "duration": "14s",
    "cost": 0.005,
    "toolCalls": 1,
    "retrievalCalls": 2,
    "approvalState": "NONE"
  }
]
```

---

## 3. Data Layer — Deployments & Environments

### 3.1 List deployments
```
GET /api/data/deployments
```
**Used by:** Deployment Center — deployment history table.

**Response — 200:**
```json
[
  {
    "id": "DEP-9912",
    "name": "Support Agent V1.4 Promotion",
    "type": "AGENT",
    "env": "PROD",
    "status": "SUCCESS",
    "version": "v1.4.2",
    "startedAt": "2h ago",
    "duration": "4m 12s",
    "owner": "Sarah Connor",
    "approver": "Platform Admin",
    "affectedAgents": ["agt-001"],
    "affectedKBs": ["kb-corp-v4"],
    "riskScore": 12
  }
]
```

**Deployment `status` values:** `SUCCESS | VALIDATING | WAITING_APPROVAL | FAILED`

---

### 3.2 List environments
```
GET /api/data/environments
```
**Used by:** Deployment Center — Environment Manager (DEV / UAT / PROD health cards).

**Response — 200:**
```json
[
  {
    "name": "DEV",
    "status": "HEALTHY",
    "agentCount": 42,
    "kbCount": 12,
    "lastDeployment": "15m ago",
    "runtimeVersion": "r2025.04.1",
    "healthScore": 99,
    "driftCount": 0
  }
]
```

---

## 4. Knowledge Pipeline — Chunks

### 4.1 Get chunks for a document
```
GET /api/knowledge/documents/:docId/chunks
```
**Used by:** `AssetDetailWorkspace` — CHUNKS tab (Silver and Gold layers only).

**When called:** User opens a Silver or Gold document and clicks the "Chunks" tab.

**Response — 200:**
```json
[
  {
    "id": "CHUNK-GOL-001-01",
    "title": "Section 1: Scope of Compliance",
    "text": "This policy applies to all personnel...",
    "versions": [
      {
        "version_number": "v1.2",
        "create_at": "2026-05-22 09:14:00 UTC",
        "status": "Active",
        "embedding_models": "text-embedding-3-large (3072d)",
        "entities": ["HIPAA", "SOC2", "ISO27001"],
        "intent": "compliance policy scope personnel",
        "text": "Revised text with updated scope..."
      },
      {
        "version_number": "v1.1",
        "create_at": "2026-05-10 14:30:00 UTC",
        "status": "Inactive",
        "embedding_models": "text-embedding-3-large (3072d)",
        "entities": ["HIPAA", "SOC2"],
        "intent": "compliance scope",
        "text": "Original text..."
      }
    ]
  }
]
```

**Notes:**
- Silver documents show chunks in read-only mode (raw parsed string only).
- Gold documents show the full version history with an "Activate Version" button.
- Each chunk has at least one version; the first element in `versions[]` is always the currently displayed one.
- `status` on a version is either `"Active"` or `"Inactive"`.

**Backend action:**
```sql
SELECT c.*, cv.* FROM chunks c
JOIN chunk_versions cv ON cv.chunk_id = c.id
WHERE c.document_id = :docId AND c.tenant_id = :tenantId
ORDER BY c.created_at, cv.created_at DESC;
```

---

### 4.2 Add a new chunk version
```
POST /api/knowledge/documents/:docId/chunks/:chunkId/versions
```
**Used by:** (Reserved — chunk editor, future release)

**Request body:**
```json
{
  "version_number": "v1.3",
  "text": "Updated chunk content with corrections.",
  "embedding_models": "text-embedding-3-large (3072d)",
  "entities": ["HIPAA", "SOC2", "ISO27001"],
  "intent": "compliance policy scope updated"
}
```

**Field rules:**
- `version_number` — required, string, e.g. `"v1.3"`
- `text` — required, the raw chunk text
- `embedding_models` — optional, defaults to `"text-embedding-3-large (3072d)"`
- `entities` — optional array of named entities extracted from the text
- `intent` — optional semantic intent description string

**Response — 201:** The created `ChunkVersion` object with `status: "Inactive"`.

**Backend action:**
```sql
INSERT INTO chunk_versions (chunk_id, version_number, text, embedding_models, entities, intent, status, created_at)
VALUES (:chunkId, :version_number, :text, :embedding_models, :entities, :intent, 'Inactive', NOW())
RETURNING *;
-- Then trigger async re-embedding job for this version
```

---

### 4.3 Activate a chunk version (Gold layer)
```
PATCH /api/knowledge/documents/:docId/chunks/:chunkId/activate
```
**Used by:** `AssetDetailWorkspace` — CHUNKS tab, "Activate Version" button (Gold layer only).

**When called:** The user selects a non-active version and clicks "Activate Version".

**Request body:**
```json
{ "version_number": "v1.1" }
```

**What the UI expects:** The backend sets the chosen version to `Active` and all other versions of the same chunk to `Inactive`.

**Response — 200:** The updated `Chunk` object with all versions and their new statuses.

**Backend action:**
```sql
-- In a transaction:
UPDATE chunk_versions SET status = 'Inactive'
WHERE chunk_id = :chunkId;

UPDATE chunk_versions SET status = 'Active'
WHERE chunk_id = :chunkId AND version_number = :version_number;

-- Then trigger vector store swap: remove old active embedding, upsert new one
-- UPDATE qdrant collection: delete old vector, insert vector for this version's text
```

**Response — 404:** `{ "error": "Version not found" }` if `version_number` does not exist.

---

## 5. Knowledge Pipeline — Tables

### 5.1 Get tables for a document
```
GET /api/knowledge/documents/:docId/tables
```
**Used by:** `AssetDetailWorkspace` — TABLES tab (Silver and Gold layers only).

**When called:** User opens a Silver or Gold document and clicks the "Tables" tab.

**Response — 200:**
```json
[
  {
    "id": "tbl-001",
    "name": "policy_registry",
    "description": "Central registry of all active compliance policies.",
    "columns": [
      { "name": "policy_id",   "type": "VARCHAR(20)", "nullable": false },
      { "name": "policy_name", "type": "TEXT",        "nullable": false },
      { "name": "owner",       "type": "VARCHAR(100)", "nullable": true  },
      { "name": "effective_date", "type": "DATE",     "nullable": false }
    ],
    "rows": [
      {
        "policy_id": "POL-001",
        "policy_name": "Data Retention Policy",
        "owner": "Compliance Team",
        "effective_date": "2025-01-15"
      }
    ]
  }
]
```

**Notes:**
- A document can have zero or more tables.
- `rows` is an array of key-value objects keyed by column name.
- Null cell values are represented as `null` in JSON.

**Backend action:**
```sql
SELECT t.*, tc.*, tr.* FROM doc_tables t
JOIN table_columns tc ON tc.table_id = t.id
JOIN table_rows tr ON tr.table_id = t.id
WHERE t.document_id = :docId AND t.tenant_id = :tenantId
ORDER BY t.extraction_order;
```

---

### 5.2 Update a table cell
```
PATCH /api/knowledge/documents/:docId/tables/:tableId/rows/:rowIndex
```
**Used by:** `AssetDetailWorkspace` — TABLES tab, inline cell editor (click cell → type → Enter or Save button).

**When called:** The user edits a cell value and presses Enter or clicks the Save icon.

**`:rowIndex`** is a zero-based integer index into the `rows` array.

**Request body:**
```json
{
  "column": "policy_name",
  "value":  "Updated Data Retention Policy v2"
}
```

**Field rules:**
- `column` — required, must match a column name in the table schema
- `value` — the new cell value as a string; send `null` to clear the cell

**Response — 200:** The updated row object (all columns).
```json
{
  "policy_id": "POL-001",
  "policy_name": "Updated Data Retention Policy v2",
  "owner": "Compliance Team",
  "effective_date": "2025-01-15"
}
```

**Response — 404:** `{ "error": "Row index out of bounds" }` or `{ "error": "Table not found" }`.

**Backend action:**
```sql
UPDATE table_rows
SET data = data || jsonb_build_object(:column, :value),
    updated_at = NOW(),
    updated_by = :userId   -- from X-User-Id header
WHERE table_id = :tableId AND row_index = :rowIndex AND tenant_id = :tenantId
RETURNING data;
-- Also write to audit_logs (append-only)
```

---

## 6. Vector Store — Qdrant

### 6.1 List Qdrant collections
```
GET /api/knowledge/qdrant/collections
```
**Used by:** Knowledge Ops → Fleet Overview — vector store health panel.

**Response — 200:**
```json
[
  {
    "name": "corporate_knowledge_v4",
    "vectors_count": 14823,
    "dimension": 3072,
    "distance": "Cosine",
    "status": "green",
    "disk_usage_mb": 312,
    "tenant": "GlobalCorp"
  }
]
```

**Backend action:** Proxy to `GET http://qdrant:6333/collections` and reshape response.

---

## 7. Graph Store — Neo4j

### 7.1 Get graph layout
```
GET /api/knowledge/neo4j/graph
```
**Used by:** Knowledge Ops → Graph tab — renders the knowledge graph.

**Response — 200:**
```json
{
  "nodes": [
    { "id": "n1", "label": "Organization", "name": "GlobalCorp", "color": "#B88719" }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "label": "OWNS", "weight": 1 }
  ],
  "rel_labels": ["OWNS", "REFERENCES", "CONTRADICTS", "SUPERSEDES"]
}
```

---

### 7.2 Execute a Cypher query
```
POST /api/knowledge/neo4j/query
```
**Used by:** Knowledge Ops → Graph tab — query panel (advanced users).

**Request body:**
```json
{ "cypher": "MATCH (a:Organization)-[:OWNS]->(b:Policy) RETURN a, b LIMIT 20" }
```

**Response — 200:**
```json
{
  "cypher": "MATCH ...",
  "status": "ok",
  "rows": [
    { "a": { "id": "n1", "label": "Organization", "name": "GlobalCorp" }, "b": { ... } }
  ],
  "message": ""
}
```

**Backend action:** Execute against Neo4j bolt connection. Return rows. On error return `status: "error"` with message.

---

## 8. Conflict Resolution

### 8.1 List conflict batches
```
GET /api/knowledge/conflicts/batches
```
**Used by:** ConflictWorkspace — batch selector dropdown.

**Response — 200:**
```json
[
  {
    "batch_id": "BATCH-001",
    "name": "May 2026 Policy Sync",
    "total": 9,
    "resolved": 3,
    "pending": 6,
    "created_at": "2026-05-20"
  }
]
```

---

### 8.2 List conflicts
```
GET /api/knowledge/conflicts
GET /api/knowledge/conflicts?batchId=BATCH-001
```
**Used by:** ConflictWorkspace — conflict list.

**Response — 200:** Array of `Conflict` objects.
```json
[
  {
    "conflict_id": "CF-001",
    "batch_id": "BATCH-001",
    "type": "SEMANTIC_DUPLICATE",
    "severity": "HIGH",
    "status": "PENDING",
    "source_chunk": { "id": "...", "text": "..." },
    "target_chunk": { "id": "...", "text": "..." },
    "similarity_score": 0.94,
    "resolution_instruction": null,
    "selected_resolution_method": null,
    "resolved_at": null,
    "resolved_by": null
  }
]
```

---

### 8.3 Get a single conflict
```
GET /api/knowledge/conflicts/:conflictId
```
**Response — 200:** Single `Conflict` object. **404:** `{ "error": "Conflict not found" }`.

---

### 8.4 Resolve / update a conflict
```
PATCH /api/knowledge/conflicts/:conflictId
```
**Used by:** ConflictWorkspace — resolution submit button.

**Request body** (send only changed fields):
```json
{
  "status": "RESOLVED",
  "resolution_instruction": "Keep source chunk, deprecate target.",
  "selected_resolution_method": "KEEP_SOURCE",
  "resolved_at": "2026-05-24T12:00:00Z",
  "resolved_by": "platform-admin"
}
```

**Response — 200:** Updated `Conflict` object.

**Backend action:**
```sql
UPDATE conflicts
SET status = :status,
    resolution_instruction = :resolution_instruction,
    selected_resolution_method = :selected_resolution_method,
    resolved_at = :resolved_at,
    resolved_by = :resolved_by
WHERE conflict_id = :conflictId AND tenant_id = :tenantId
RETURNING *;
-- Write audit_log entry
```

---

## 9. Knowledge Policies — Filtering

### 9.1 List filtering policies
```
GET /api/knowledge/policies/filtering
```
**Used by:** PolicyCenter — filtering policy table.

**Response — 200:**
```json
[
  {
    "id": "FP-001",
    "name": "Block Internal Salary Data",
    "type": "exact_word",
    "content": "salary, compensation, bonus",
    "added_by": "platform-admin",
    "added_when": "2026-05-10",
    "active": true
  }
]
```

---

### 9.2 Create a filtering policy
```
POST /api/knowledge/policies/filtering
```
**Used by:** PolicyCenter — "Add Policy" form.

**Request body:**
```json
{
  "name":      "Block Politics Topics",
  "type":      "natural_language",
  "content":   "Exclude any content discussing political parties or elections.",
  "added_by":  "platform-admin"
}
```

**Field rules:**
- `name` — required, unique per tenant
- `type` — required: `"natural_language"` or `"exact_word"`
- `content` — required, the filter rule body
- `added_by` — optional, defaults to the authenticated user from `X-User-Email`

**Response — 201:** Created `FilterPolicy` with generated `id` and `active: true`.

---

### 9.3 Get a single filtering policy
```
GET /api/knowledge/policies/filtering/:policyId
```
**Response — 200:** `FilterPolicy` object. **404:** `{ "error": "Policy not found" }`.

---

### 9.4 Update a filtering policy
```
PUT /api/knowledge/policies/filtering/:policyId
```
**Request body** (all mutable fields, send only changed ones):
```json
{
  "name": "Renamed Policy",
  "type": "exact_word",
  "content": "salary, wages",
  "active": false
}
```
**Response — 200:** Updated `FilterPolicy`.

---

### 9.5 Delete a filtering policy
```
DELETE /api/knowledge/policies/filtering/:policyId
```
**Response — 200:** The deleted `FilterPolicy` object.

---

## 10. Knowledge Policies — Extraction

### 10.1 Get extraction policies
```
GET /api/knowledge/policies/extraction
```
**Used by:** PolicyCenter — extraction policy view.

**Response — 200:**
```json
{
  "base": "Extract named entities (ORG, PERSON, DATE, LOCATION). Summarize sections > 500 words.",
  "custom": "Additionally extract regulatory references (ISO, SOC, HIPAA codes)."
}
```

---

### 10.2 Save custom extraction policy
```
PUT /api/knowledge/policies/extraction/custom
```
**Used by:** PolicyCenter — custom extraction policy editor save button.

**Request body:**
```json
{ "custom": "Additionally extract regulatory references (ISO, SOC, HIPAA codes)." }
```

**Response — 200:** `{ "base": "...", "custom": "..." }`

**Backend action:**
```sql
UPDATE extraction_policies
SET custom_policy = :custom, updated_at = NOW(), updated_by = :userId
WHERE tenant_id = :tenantId;
```

---

## Appendix A — Common Error Shapes

| Status | Body                                  |
|--------|---------------------------------------|
| 400    | `{ "error": "<field> is required" }`  |
| 404    | `{ "error": "<resource> not found" }` |
| 422    | `{ "error": "<business rule violation>" }` |
| 500    | `{ "error": "Internal server error" }` |

---

## Appendix B — Document Pipeline Status Machine

```
Ingest            Process to Silver   Process to Gold
  │                     │                   │
  ▼                     ▼                   ▼
RAW → OCR_COMPLETE → CLEANED → CHUNKING → EMBEDDING → GRAPH_EXTRACTING → PUBLISHED
                                                                       ↘ FAILED
                                                              PUBLISHED → ARCHIVED
                                                              PUBLISHED → DEPRECATED
```

Backend must enforce valid transitions. Illegal transitions (e.g. BRONZE→GOLD, GOLD→SILVER) should return 422.

---

## Appendix C — Multi-Tenant Isolation

Every database query **must** scope by `tenant_id`.  
The tenant is derived from `X-User-Id` → `members` table → `tenants.id`.  
Never trust a tenant identifier sent in the request body.

---

## Appendix D — Audit Logging

Every mutating operation (PATCH, PUT, POST, DELETE) **must** write a row to `audit_logs`:
```sql
INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, payload, created_at)
VALUES (:tenantId, :userId, :action, :resourceType, :resourceId, :payload::jsonb, NOW());
```
`audit_logs` is append-only and monthly-partitioned. Never UPDATE or DELETE from it.
