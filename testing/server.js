/**
 * AeroFlow Unified Mock Server
 * Single HTTP server replacing the Python WebSocket server.
 * Serves all mock data: documents, agents, deployments, KB, conflicts, policies.
 * Run: node testing/server.js
 * Default port: 4000  (override: MOCK_PORT=5000 node testing/server.js)
 */

import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.MOCK_PORT ?? '4000', 10);
const DATA_DIR = join(__dirname, 'data');

/* ── Load / save helpers ─────────────────────────────────────────── */
const load = (file) => JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
const save = (file, data) => writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2));

/* ── Role-based permission enforcement ──────────────────────────── */
const ROLE_PERMISSIONS = {
  PLATFORM_ADMIN:    ['delete_data', 'edit_conflict', 'process_layer', 'add_data', 'add_warehouse',
                      'add_filtering_policy', 'edit_filtering_policy', 'delete_filtering_policy',
                      'edit_extraction_policy', 'toggle_qdrant', 'add_warehouse_config',
                      'edit_warehouse_config', 'add_chunk_version'],
  AI_ENGINEER:       ['toggle_qdrant', 'edit_extraction_policy'],
  BUSINESS_OPERATOR: ['add_warehouse', 'add_warehouse_config', 'edit_warehouse_config'],
  EXECUTIVE:         ['edit_conflict', 'process_layer', 'add_filtering_policy'],
};

/**
 * Express middleware that enforces role-based access.
 * Reads X-Role header from the request and checks against allowed permissions.
 * Returns 403 with a descriptive message if the role lacks the permission.
 */
const guard = (...permissions) => (req, res, next) => {
  const role = req.headers['x-role'] ?? 'UNKNOWN';
  const allowed = ROLE_PERMISSIONS[role] ?? [];
  const missing = permissions.find(p => !allowed.includes(p));
  if (missing) {
    return res.status(403).json({
      error: `Your role (${role}) does not have permission to perform this action.`,
      required: missing,
      role,
    });
  }
  next();
};

const store = {
  kg:          load('knowledge-graph.json'),  // { documents, chunks, tables, qdrant_collections, neo4j }
  conflicts:   load('conflicts.json'),        // { batches, conflicts }
  policies:    load('policies.json'),         // { filter_policies, extraction }
  documents:   load('documents.json'),        // flat array of KnowledgeDocument (d1-d69)
  agents:      load('agents.json'),           // { agents, traces, configs, runs }
  deployments: load('deployments.json'),      // { deployments, environments }
};

/* ── Express setup ───────────────────────────────────────────────── */
const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Role');
  next();
});
app.options('*', (_req, res) => res.sendStatus(204));

/* ════════════════════════════════════════════════════════════════════
   DATA LAYER — DOCUMENTS / AGENTS / DEPLOYMENTS
   (replaces the Python WebSocket server at ws://localhost:8765)
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/data/documents   — all 69 Bronze/Silver/Gold documents */
app.get('/api/data/documents', (_req, res) => res.json(store.documents));

/* PATCH /api/data/documents/:docId  — update layer/status/metadata (process layer: PLATFORM_ADMIN, EXECUTIVE) */
app.patch('/api/data/documents/:docId', guard('process_layer'), (req, res) => {
  const idx = store.documents.findIndex(d => d.id === req.params.docId);
  if (idx === -1) return res.status(404).json({ error: 'Document not found' });
  Object.assign(store.documents[idx], req.body);
  save('documents.json', store.documents);
  res.json(store.documents[idx]);
});

/* GET /api/data/agents      */
app.get('/api/data/agents',       (_req, res) => res.json(store.agents.agents));
/* GET /api/data/traces      */
app.get('/api/data/traces',       (_req, res) => res.json(store.agents.traces));
/* GET /api/data/configs     */
app.get('/api/data/configs',      (_req, res) => res.json(store.agents.configs));
/* GET /api/data/runs        */
app.get('/api/data/runs',         (_req, res) => res.json(store.agents.runs));
/* GET /api/data/deployments */
app.get('/api/data/deployments',  (_req, res) => res.json(store.deployments.deployments));
/* GET /api/data/environments */
app.get('/api/data/environments', (_req, res) => res.json(store.deployments.environments));

/* ════════════════════════════════════════════════════════════════════
   KNOWLEDGE — DOCUMENTS (graph-layer GOL-xxx docs)
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/knowledge/documents
   Returns all Gold-layer documents (GOL-xxx). */
app.get('/api/knowledge/documents', (_req, res) => {
  res.json(store.kg.documents);
});

/* GET /api/knowledge/documents/:docId
   Returns a single document by id. */
app.get('/api/knowledge/documents/:docId', (req, res) => {
  const doc = store.kg.documents.find(d => d.id === req.params.docId);
  doc ? res.json(doc) : res.status(404).json({ error: 'Document not found' });
});

/* GET /api/knowledge/documents/:docId/chunks
   Returns all chunks belonging to a document.
   Falls back to GOL-001 demo data for d-xxx IDs not in the store. */
app.get('/api/knowledge/documents/:docId/chunks', (req, res) => {
  const chunks = store.kg.chunks[req.params.docId];
  if (chunks && chunks.length > 0) return res.json(chunks);
  res.json(store.kg.chunks?.['GOL-001'] ?? []);
});

/* POST /api/knowledge/documents/:docId/chunks/:chunkId/versions
   Prepends a new version (Inactive) to an existing chunk.

   Request body:
   {
     "version_number": "v1.3",          // required
     "text": "Updated chunk content.",   // required
     "embedding_models": "...",          // optional, defaults to text-embedding-3-large
     "entities": [],                     // optional
     "intent": ""                        // optional
   }

   Response 201: the created ChunkVersion object. */
app.post('/api/knowledge/documents/:docId/chunks/:chunkId/versions', guard('add_chunk_version'), (req, res) => {
  const { docId, chunkId } = req.params;
  const docChunks = store.kg.chunks[docId];
  if (!docChunks) return res.status(404).json({ error: 'Document not found' });

  const chunk = docChunks.find(c => c.id === chunkId);
  if (!chunk) return res.status(404).json({ error: 'Chunk not found' });

  const { version_number, text, embedding_models, entities, intent } = req.body ?? {};
  if (!version_number || !text) {
    return res.status(400).json({ error: 'version_number and text are required' });
  }

  const newVersion = {
    version_number,
    create_at: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    status: 'Inactive',
    embedding_models: embedding_models ?? 'text-embedding-3-large (3072d)',
    entities: entities ?? [],
    intent: intent ?? '',
    text,
  };

  chunk.versions.unshift(newVersion);
  save('knowledge-graph.json', store.kg);
  res.status(201).json(newVersion);
});

/* PATCH /api/knowledge/documents/:docId/chunks/:chunkId/activate
   Sets one version as Active, all others in the same chunk as Inactive.

   Request body:
   { "version_number": "v1.1" }

   Response 200: updated Chunk object with all versions. */
app.patch('/api/knowledge/documents/:docId/chunks/:chunkId/activate', guard('add_chunk_version'), (req, res) => {
  const { docId, chunkId } = req.params;
  const docChunks = store.kg.chunks[docId];
  if (!docChunks) return res.status(404).json({ error: 'Document not found' });

  const chunk = docChunks.find(c => c.id === chunkId);
  if (!chunk) return res.status(404).json({ error: 'Chunk not found' });

  const { version_number } = req.body ?? {};
  if (!version_number) return res.status(400).json({ error: 'version_number is required' });

  const target = chunk.versions.find(v => v.version_number === version_number);
  if (!target) return res.status(404).json({ error: 'Version not found' });

  chunk.versions.forEach(v => {
    v.status = v.version_number === version_number ? 'Active' : 'Inactive';
  });

  save('knowledge-graph.json', store.kg);
  res.json(chunk);
});

/* GET /api/knowledge/documents/:docId/tables
   Returns all tables extracted from a document. */
app.get('/api/knowledge/documents/:docId/tables', (req, res) => {
  const tables = store.kg.tables?.[req.params.docId];
  if (tables && tables.length > 0) return res.json(tables);
  // Fallback: return GOL-001 tables as demo when docId not in store
  res.json(store.kg.tables?.['GOL-001'] ?? []);
});

/* PATCH /api/knowledge/documents/:docId/tables/:tableId/rows/:rowIndex
   Updates a single cell value in a table row.

   Request body:
   { "column": "column_name", "value": "new_value" }

   Response 200: the updated row object. */
app.patch('/api/knowledge/documents/:docId/tables/:tableId/rows/:rowIndex', (req, res) => {
  const { docId, tableId, rowIndex } = req.params;
  const tables = store.kg.tables?.[docId] ?? store.kg.tables?.['GOL-001'] ?? [];
  const table = tables.find(t => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const idx = parseInt(rowIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= table.rows.length) {
    return res.status(404).json({ error: 'Row index out of bounds' });
  }

  const { column, value } = req.body ?? {};
  if (!column) return res.status(400).json({ error: 'column is required' });

  table.rows[idx][column] = value ?? null;
  res.json(table.rows[idx]);
});

/* ════════════════════════════════════════════════════════════════════
   KNOWLEDGE — WAREHOUSE CONFIGS
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/knowledge/documents/:docId/configs
   Returns all JSON config versions for a warehouse connection. */
app.get('/api/knowledge/documents/:docId/configs', (req, res) => {
  const configs = store.kg.warehouse_configs?.[req.params.docId] ?? [];
  res.json(configs);
});

/* POST /api/knowledge/documents/:docId/configs
   Creates a new config version (status: Inactive).

   Request body:
   { "version_number": "v2.0", "connection": { ...fields }, "tables": [ { name, schema, rowCount, description } ] }

   Response 201: the created config version. */
app.post('/api/knowledge/documents/:docId/configs', (req, res) => {
  const { docId } = req.params;
  if (!store.kg.warehouse_configs) store.kg.warehouse_configs = {};
  if (!store.kg.warehouse_configs[docId]) store.kg.warehouse_configs[docId] = [];

  const { version_number, connection, tables } = req.body ?? {};
  if (!version_number || !tables) {
    return res.status(400).json({ error: 'version_number and tables are required' });
  }

  const newConfig = {
    id: `${docId}-cfg-${Date.now()}`,
    version_number,
    status: 'Inactive',
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    connection: connection ?? {},
    tables,
  };

  store.kg.warehouse_configs[docId].unshift(newConfig);
  res.status(201).json(newConfig);
});

/* PATCH /api/knowledge/documents/:docId/configs/:configId/activate
   Sets one config version as Active, all others as Inactive.

   Response 200: the activated config version. */
app.patch('/api/knowledge/documents/:docId/configs/:configId/activate', (req, res) => {
  const { docId, configId } = req.params;
  const configs = store.kg.warehouse_configs?.[docId];
  if (!configs) return res.status(404).json({ error: 'No configs for this document' });

  const target = configs.find(c => c.id === configId);
  if (!target) return res.status(404).json({ error: 'Config not found' });

  configs.forEach(c => { c.status = c.id === configId ? 'Active' : 'Inactive'; });
  res.json(target);
});

/* ════════════════════════════════════════════════════════════════════
   KNOWLEDGE — WAREHOUSE CONFIGS  (GraphRAG Knowledge Hub endpoints)
   WConfig shape: { id, name, version, createdAt, status, syncSchedule, tables }
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/knowledge/warehouses/:warehouseId/configs */
app.get('/api/knowledge/warehouses/:warehouseId/configs', (req, res) => {
  const configs = store.kg.warehouse_configs?.[req.params.warehouseId] ?? [];
  res.json(configs);
});

/* POST /api/knowledge/warehouses/:warehouseId/configs
   Body: { name, version, syncSchedule, tables, status }
   Response 201: the created WConfig */
app.post('/api/knowledge/warehouses/:warehouseId/configs', guard('add_warehouse_config'), (req, res) => {
  const { warehouseId } = req.params;
  if (!store.kg.warehouse_configs) store.kg.warehouse_configs = {};
  if (!store.kg.warehouse_configs[warehouseId]) store.kg.warehouse_configs[warehouseId] = [];

  const { name, version, syncSchedule, tables, status } = req.body ?? {};
  if (!name || !version || !tables) {
    return res.status(400).json({ error: 'name, version, and tables are required' });
  }

  const newConfig = {
    id: `cfg-${Date.now()}`,
    name,
    version,
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    status: status ?? 'Draft',
    syncSchedule: syncSchedule ?? 'Manual',
    tables,
  };

  store.kg.warehouse_configs[warehouseId].unshift(newConfig);
  save('knowledge-graph.json', store.kg);
  res.status(201).json(newConfig);
});

/* PATCH /api/knowledge/warehouses/:warehouseId/configs/:configId/activate
   Sets one config to Active, demotes the previous Active to Draft.
   Response 200: the activated WConfig */
app.patch('/api/knowledge/warehouses/:warehouseId/configs/:configId/activate', guard('edit_warehouse_config'), (req, res) => {
  const { warehouseId, configId } = req.params;
  const configs = store.kg.warehouse_configs?.[warehouseId];
  if (!configs) return res.status(404).json({ error: 'No configs for this warehouse' });

  const target = configs.find(c => c.id === configId);
  if (!target) return res.status(404).json({ error: 'Config not found' });

  configs.forEach(c => {
    if (c.id === configId) c.status = 'Active';
    else if (c.status === 'Active') c.status = 'Draft';
  });

  save('knowledge-graph.json', store.kg);
  res.json(target);
});

/* ════════════════════════════════════════════════════════════════════
   KNOWLEDGE — QDRANT
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/knowledge/qdrant/collections
   Returns all Qdrant vector collections. */
app.get('/api/knowledge/qdrant/collections', (_req, res) => {
  res.json(store.kg.qdrant_collections);
});

/* PATCH /api/knowledge/qdrant/collections/:id
   Updates mutable fields on a collection (currently: active).
   Request body: { "active": true | false }
   Response 200: the updated collection. */
app.patch('/api/knowledge/qdrant/collections/:id', guard('toggle_qdrant'), (req, res) => {
  const col = (store.kg.qdrant_collections ?? []).find(c => c.id === req.params.id);
  if (!col) return res.status(404).json({ error: 'Collection not found' });
  if (typeof req.body.active === 'boolean') col.active = req.body.active;
  save('knowledge-graph.json', store.kg);
  res.json(col);
});

/* POST /api/knowledge/qdrant/collections/:id/search
   Simulates semantic search against a collection.

   Request body: { "query": "natural language query" }

   Response 200: top-5 scored points
   [{ point_id, score, summary, entities, intent }] */
app.post('/api/knowledge/qdrant/collections/:id/search', guard('toggle_qdrant'), (req, res) => {
  const collection = (store.kg.qdrant_collections ?? []).find(c => c.id === req.params.id);
  if (!collection) return res.status(404).json({ error: 'Collection not found' });

  const { query } = req.body ?? {};
  if (!query) return res.status(400).json({ error: 'query is required' });

  const q = String(query).slice(0, 40);

  const seeds = {
    'qd-001': [
      { summary: `Enterprise policy clause defining the scope of "${q}" across all business units and regulatory jurisdictions.`, entities: ['AeroFlow HQ', 'Compliance Team', 'Legal Department'], intent: ['Define regulatory scope', 'Establish compliance boundaries'] },
      { summary: `Procedural guidelines for handling "${q}" in enterprise environments, including escalation paths.`, entities: ['Platform Admin', 'Enterprise Security', 'Audit Committee'], intent: ['Outline operational procedures', 'Ensure audit compliance'] },
      { summary: `Exception handling rules and override conditions applicable to "${q}" workflows.`, entities: ['Risk Management', 'CISO Office', 'Incident Response Team'], intent: ['Define exception criteria', 'Specify override protocols'] },
      { summary: `Historical versioning notes for knowledge artifacts governing "${q}" — tracks changes since v1.0.`, entities: ['Document Repository', 'Change Board', 'Version Control'], intent: ['Preserve policy history', 'Track regulatory changes'] },
      { summary: `Taxonomy labels and metadata annotations applied to chunks related to "${q}" for retrieval optimization.`, entities: ['Metadata Store', 'Taxonomy Engine', 'Classification Service'], intent: ['Annotate knowledge chunks', 'Optimize retrieval accuracy'] },
    ],
    'qd-002': [
      { summary: `Contract clause governing SLA obligations related to "${q}" between enterprise clients and AeroFlow.`, entities: ['Legal Department', 'Client Success', 'SLA Board'], intent: ['Enforce SLA commitments', 'Define penalty clauses'] },
      { summary: `Addendum to master services agreement addressing "${q}" in multi-jurisdiction deployments.`, entities: ['AeroFlow Legal', 'Enterprise Clients', 'Procurement Office'], intent: ['Extend contract scope', 'Cover multi-jurisdiction use'] },
      { summary: `IP ownership and data residency provisions for assets related to "${q}".`, entities: ['IP Counsel', 'Data Governance', 'Compliance Officer'], intent: ['Protect intellectual property', 'Ensure data residency compliance'] },
      { summary: `Amendment records and signing history for contracts mentioning "${q}".`, entities: ['Contract Repository', 'DocuSign Audit', 'Legal Ops'], intent: ['Track contract amendments', 'Maintain signing audit trail'] },
      { summary: `Force majeure and dispute resolution language as applied to "${q}" obligations.`, entities: ['Dispute Resolution Board', 'External Counsel', 'Contract Manager'], intent: ['Handle force majeure events', 'Define dispute resolution process'] },
    ],
    'qd-003': [
      { summary: `Regulatory mandate from GDPR Article 17 relevant to data processing for "${q}".`, entities: ['GDPR Authority', 'DPO Office', 'Data Subjects'], intent: ['Enforce right to erasure', 'Comply with GDPR Article 17'] },
      { summary: `ISO 27001 control requirements intersecting with "${q}" data handling practices.`, entities: ['ISO Certification Body', 'ISMS Committee', 'Audit Team'], intent: ['Map ISO controls', 'Demonstrate certification compliance'] },
      { summary: `SOC 2 Type II evidence collection requirements for systems processing "${q}".`, entities: ['SOC Auditor', 'Trust Services Criteria', 'Security Engineering'], intent: ['Collect audit evidence', 'Satisfy trust service criteria'] },
      { summary: `CCPA consumer rights obligations when processing data related to "${q}".`, entities: ['Privacy Team', 'Consumer Rights Board', 'Legal Compliance'], intent: ['Fulfill CCPA rights requests', 'Document opt-out mechanisms'] },
      { summary: `Industry-specific financial regulation (MiFID II) rules applicable to "${q}" in trading contexts.`, entities: ['MiFID II Authority', 'Trading Desk', 'Compliance Officers'], intent: ['Apply MiFID II rules', 'Ensure trading compliance'] },
    ],
  };

  const defaultSeeds = [
    { summary: `Archived knowledge fragment indexed from legacy sources related to "${q}".`, entities: ['Archive System', 'Legacy Importer'], intent: ['Preserve legacy data', 'Enable historical lookup'] },
    { summary: `Deprecated policy entry superseded by newer regulations addressing "${q}".`, entities: ['Policy Archive', 'Change Management'], intent: ['Mark deprecated policies', 'Maintain historical context'] },
    { summary: `Cross-reference link between "${q}" and related knowledge artifacts in the graph.`, entities: ['Graph Engine', 'Cross-Reference Service'], intent: ['Enable knowledge linking', 'Improve retrieval coverage'] },
    { summary: `Summary chunk generated during Bronze → Gold processing pipeline for "${q}".`, entities: ['ETL Pipeline', 'NLP Engine', 'Summarisation Model'], intent: ['Condense source material', 'Generate retrievable summary'] },
    { summary: `Entity extraction result connecting "${q}" to known organizational hierarchies.`, entities: ['NER Model', 'Entity Registry', 'Knowledge Graph'], intent: ['Extract named entities', 'Link to org hierarchy'] },
  ];

  const collectionSeeds = seeds[req.params.id] ?? defaultSeeds;
  const points = collectionSeeds.map((s, i) => ({
    point_id: `${req.params.id}-pt-${String(i + 1).padStart(3, '0')}`,
    score: parseFloat((0.98 - i * 0.04).toFixed(2)),
    summary: s.summary,
    entities: s.entities,
    intent: s.intent,
  }));

  res.json(points);
});

/* ════════════════════════════════════════════════════════════════════
   KNOWLEDGE — NEO4J
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/knowledge/neo4j/graph
   Returns static graph layout: { nodes, edges, rel_labels }. */
app.get('/api/knowledge/neo4j/graph', (_req, res) => {
  res.json(store.kg.neo4j);
});

/* POST /api/knowledge/neo4j/query
   Simulates Cypher query execution against the knowledge graph.

   Request body:
   { "cypher": "MATCH (a:Organization)-[:WORKS_FOR]->(b:Person) RETURN a, b" }

   Response 200:
   {
     "cypher": "...",
     "status": "simulated",
     "rows": [],
     "message": "Query received. Connect a live Neo4j instance for real results."
   } */
app.post('/api/knowledge/neo4j/query', (req, res) => {
  const { cypher } = req.body ?? {};
  if (!cypher) return res.status(400).json({ error: 'cypher is required' });
  res.json({
    cypher,
    status: 'simulated',
    rows: [],
    message: 'Query received. Connect a live Neo4j instance for real results.',
  });
});

/* ════════════════════════════════════════════════════════════════════
   KNOWLEDGE — CONFLICTS
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/knowledge/conflicts/batches
   Returns all conflict batches. */
app.get('/api/knowledge/conflicts/batches', (_req, res) => {
  res.json(store.conflicts.batches);
});

/* GET /api/knowledge/conflicts[?batchId=BATCH-001]
   Returns all conflicts, optionally filtered by batchId. */
app.get('/api/knowledge/conflicts', (req, res) => {
  let list = store.conflicts.conflicts;
  const batchId = req.query.batchId;
  if (batchId) list = list.filter(c => c.batch_id === batchId);
  res.json(list);
});

/* GET /api/knowledge/conflicts/:conflictId
   Returns a single conflict by id. */
app.get('/api/knowledge/conflicts/:conflictId', (req, res) => {
  const c = store.conflicts.conflicts.find(x => x.conflict_id === req.params.conflictId);
  c ? res.json(c) : res.status(404).json({ error: 'Conflict not found' });
});

/* PATCH /api/knowledge/conflicts/:conflictId
   Partially updates a conflict (e.g., submitting a resolution).

   Accepted fields: status, resolution_instruction, selected_resolution_method,
                    resolved_at, resolved_by

   Response 200: the updated Conflict object. */
app.patch('/api/knowledge/conflicts/:conflictId', guard('edit_conflict'), (req, res) => {
  const idx = store.conflicts.conflicts.findIndex(c => c.conflict_id === req.params.conflictId);
  if (idx === -1) return res.status(404).json({ error: 'Conflict not found' });
  Object.assign(store.conflicts.conflicts[idx], req.body);
  res.json(store.conflicts.conflicts[idx]);
});

/* ════════════════════════════════════════════════════════════════════
   KNOWLEDGE — POLICIES / FILTERING
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/knowledge/policies/filtering
   Returns all filtering policies. */
app.get('/api/knowledge/policies/filtering', (_req, res) => {
  res.json(store.policies.filter_policies);
});

/* POST /api/knowledge/policies/filtering
   Creates a new filtering policy.

   Request body:
   {
     "name": "My Policy",                          // required
     "type": "natural_language" | "exact_word",    // required
     "content": "...",                             // required
     "added_by": "platform-admin"                  // optional
   }

   Response 201: the created FilterPolicy. */
app.post('/api/knowledge/policies/filtering', guard('add_filtering_policy'), (req, res) => {
  const { name, type, content, added_by } = req.body ?? {};
  if (!name || !type || content === undefined) {
    return res.status(400).json({ error: 'name, type, and content are required' });
  }
  const pad = (n) => String(n).padStart(3, '0');
  const newId = 'FP-' + pad(store.policies.filter_policies.length + 1);
  const policy = {
    id: newId,
    name,
    type,
    content,
    added_by: added_by ?? 'user',
    added_when: new Date().toISOString().slice(0, 10),
    active: true,
  };
  store.policies.filter_policies.push(policy);
  res.status(201).json(policy);
});

/* GET /api/knowledge/policies/filtering/:policyId
   Returns a single filtering policy. */
app.get('/api/knowledge/policies/filtering/:policyId', (req, res) => {
  const p = store.policies.filter_policies.find(x => x.id === req.params.policyId);
  p ? res.json(p) : res.status(404).json({ error: 'Policy not found' });
});

/* PUT /api/knowledge/policies/filtering/:policyId
   Replaces all mutable fields of a filtering policy.

   Accepted fields: name, type, content, active

   Response 200: the updated FilterPolicy. */
app.put('/api/knowledge/policies/filtering/:policyId', guard('edit_filtering_policy'), (req, res) => {
  const idx = store.policies.filter_policies.findIndex(p => p.id === req.params.policyId);
  if (idx === -1) return res.status(404).json({ error: 'Policy not found' });
  const { name, type, content, active } = req.body ?? {};
  if (name !== undefined) store.policies.filter_policies[idx].name = name;
  if (type !== undefined) store.policies.filter_policies[idx].type = type;
  if (content !== undefined) store.policies.filter_policies[idx].content = content;
  if (active !== undefined) store.policies.filter_policies[idx].active = active;
  res.json(store.policies.filter_policies[idx]);
});

/* DELETE /api/knowledge/policies/filtering/:policyId
   Removes a filtering policy.

   Response 200: the deleted FilterPolicy. */
app.delete('/api/knowledge/policies/filtering/:policyId', guard('delete_filtering_policy'), (req, res) => {
  const idx = store.policies.filter_policies.findIndex(p => p.id === req.params.policyId);
  if (idx === -1) return res.status(404).json({ error: 'Policy not found' });
  const [deleted] = store.policies.filter_policies.splice(idx, 1);
  res.json(deleted);
});

/* ════════════════════════════════════════════════════════════════════
   KNOWLEDGE — POLICIES / EXTRACTION
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/knowledge/policies/extraction
   Returns both extraction policies: { base, custom }. */
app.get('/api/knowledge/policies/extraction', (_req, res) => {
  res.json(store.policies.extraction);
});

/* PUT /api/knowledge/policies/extraction/custom
   Saves the custom extraction policy text.

   Request body:
   { "custom": "My custom extraction rules..." }

   Response 200: { base, custom } */
app.put('/api/knowledge/policies/extraction/custom', guard('edit_extraction_policy'), (req, res) => {
  const { custom } = req.body ?? {};
  if (custom === undefined) return res.status(400).json({ error: 'custom field is required' });
  store.policies.extraction.custom = custom;
  res.json(store.policies.extraction);
});

/* ════════════════════════════════════════════════════════════════════
   DELETE — DATA REMOVAL  (PLATFORM_ADMIN only)
   ════════════════════════════════════════════════════════════════════ */

/* DELETE /api/data/documents/:docId */
app.delete('/api/data/documents/:docId', guard('delete_data'), (req, res) => {
  const idx = store.documents.findIndex(d => d.id === req.params.docId);
  if (idx === -1) return res.status(404).json({ error: 'Document not found' });
  const [deleted] = store.documents.splice(idx, 1);
  save('documents.json', store.documents);
  res.json(deleted);
});

/* DELETE /api/knowledge/documents/:docId/chunks/:chunkId */
app.delete('/api/knowledge/documents/:docId/chunks/:chunkId', guard('delete_data'), (req, res) => {
  const { docId, chunkId } = req.params;
  const docChunks = store.kg.chunks[docId];
  if (!docChunks) return res.status(404).json({ error: 'Document not found in chunk store' });
  const idx = docChunks.findIndex(c => c.id === chunkId);
  if (idx === -1) return res.status(404).json({ error: 'Chunk not found' });
  const [deleted] = docChunks.splice(idx, 1);
  save('knowledge-graph.json', store.kg);
  res.json(deleted);
});

/* DELETE /api/knowledge/documents/:docId/chunks/:chunkId/versions/:versionNumber */
app.delete('/api/knowledge/documents/:docId/chunks/:chunkId/versions/:versionNumber', guard('delete_data'), (req, res) => {
  const { docId, chunkId, versionNumber } = req.params;
  const docChunks = store.kg.chunks[docId];
  if (!docChunks) return res.status(404).json({ error: 'Document not found in chunk store' });
  const chunk = docChunks.find(c => c.id === chunkId);
  if (!chunk) return res.status(404).json({ error: 'Chunk not found' });
  const idx = chunk.versions.findIndex(v => v.version_number === versionNumber);
  if (idx === -1) return res.status(404).json({ error: 'Version not found' });
  if (chunk.versions[idx].status === 'Active') {
    return res.status(400).json({ error: 'Cannot delete the active version. Activate another version first.' });
  }
  const [deleted] = chunk.versions.splice(idx, 1);
  save('knowledge-graph.json', store.kg);
  res.json(deleted);
});

/* DELETE /api/knowledge/documents/:docId/tables/:tableId */
app.delete('/api/knowledge/documents/:docId/tables/:tableId', guard('delete_data'), (req, res) => {
  const { docId, tableId } = req.params;
  const tables = store.kg.tables?.[docId];
  if (!tables) return res.status(404).json({ error: 'No tables found for this document' });
  const idx = tables.findIndex(t => t.id === tableId);
  if (idx === -1) return res.status(404).json({ error: 'Table not found' });
  const [deleted] = tables.splice(idx, 1);
  save('knowledge-graph.json', store.kg);
  res.json(deleted);
});

/* DELETE /api/knowledge/warehouses/:warehouseId/configs/:configId */
app.delete('/api/knowledge/warehouses/:warehouseId/configs/:configId', guard('delete_data'), (req, res) => {
  const { warehouseId, configId } = req.params;
  const configs = store.kg.warehouse_configs?.[warehouseId];
  if (!configs) return res.status(404).json({ error: 'No configs for this warehouse' });
  const idx = configs.findIndex(c => c.id === configId);
  if (idx === -1) return res.status(404).json({ error: 'Config not found' });
  if (configs[idx].status === 'Active') {
    return res.status(400).json({ error: 'Cannot delete the active config. Activate another config first.' });
  }
  const [deleted] = configs.splice(idx, 1);
  save('knowledge-graph.json', store.kg);
  res.json(deleted);
});

/* DELETE /api/knowledge/warehouses/:warehouseId/configs/:configId/tables/:tableId */
app.delete('/api/knowledge/warehouses/:warehouseId/configs/:configId/tables/:tableId', guard('delete_data'), (req, res) => {
  const { warehouseId, configId, tableId } = req.params;
  const configs = store.kg.warehouse_configs?.[warehouseId];
  if (!configs) return res.status(404).json({ error: 'No configs for this warehouse' });
  const config = configs.find(c => c.id === configId);
  if (!config) return res.status(404).json({ error: 'Config not found' });
  const idx = config.tables.findIndex(t => t.id === tableId);
  if (idx === -1) return res.status(404).json({ error: 'Table not found in config' });
  const [deleted] = config.tables.splice(idx, 1);
  save('knowledge-graph.json', store.kg);
  res.json(deleted);
});

/* ════════════════════════════════════════════════════════════════════
   FLEET — OVERVIEW STATS
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/fleet/stats
   Returns aggregated counts for the Fleet Overview dashboard.

   Response 200:
   {
     "content": { "documents": 20, "web": 2, "media": 0, "warehouses": 2 },
     "qdrant_collections": 4,
     "neo4j_nodes": 8,
     "neo4j_relationships": 7,
     "unresolved_conflict_batches": 3
   } */
app.get('/api/fleet/stats', (_req, res) => {
  const getSubType = (type) => {
    if (!type) return 'Document';
    if (type.startsWith('Warehouse/')) return 'Warehouse';
    if (type.toLowerCase() === 'web') return 'Web';
    if (type.startsWith('Media/')) return 'Media';
    return 'Document';
  };

  const goldDocs = store.documents.filter(d => d.layer === 'GOLD');
  const content = { documents: 0, web: 0, media: 0, warehouses: 0 };
  for (const d of goldDocs) {
    const sub = getSubType(d.metadata?.type);
    if (sub === 'Document')  content.documents++;
    else if (sub === 'Web')       content.web++;
    else if (sub === 'Media')     content.media++;
    else if (sub === 'Warehouse') content.warehouses++;
  }

  const pendingBatchIds = new Set(
    store.conflicts.conflicts
      .filter(c => c.status !== 'resolved')
      .map(c => c.batch_id),
  );
  const batchIds = new Set(store.conflicts.batches.map(b => b.id));
  const unresolvedBatches = [...pendingBatchIds].filter(id => batchIds.has(id)).length;

  res.json({
    content,
    qdrant_collections: store.kg.qdrant_collections?.length ?? 0,
    neo4j_nodes: store.kg.neo4j?.nodes?.length ?? 0,
    neo4j_relationships: store.kg.neo4j?.edges?.length ?? 0,
    unresolved_conflict_batches: unresolvedBatches,
  });
});

/* ════════════════════════════════════════════════════════════════════
   START
   ════════════════════════════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log('\n  AeroFlow KB Mock Server');
  console.log(`  http://localhost:${PORT}\n`);
  console.log('  Knowledge Database:');
  console.log(`    GET    /api/knowledge/documents`);
  console.log(`    GET    /api/knowledge/documents/:docId/chunks`);
  console.log(`    POST   /api/knowledge/documents/:docId/chunks/:chunkId/versions`);
  console.log(`    PATCH  /api/knowledge/documents/:docId/chunks/:chunkId/activate`);
  console.log(`    GET    /api/knowledge/documents/:docId/tables`);
  console.log(`    PATCH  /api/knowledge/documents/:docId/tables/:tableId/rows/:rowIndex`);
  console.log('  Qdrant:');
  console.log(`    GET    /api/knowledge/qdrant/collections`);
  console.log(`    POST   /api/knowledge/qdrant/collections/:id/search`);
  console.log('  Neo4j:');
  console.log(`    GET    /api/knowledge/neo4j/graph`);
  console.log(`    POST   /api/knowledge/neo4j/query`);
  console.log('  Conflicts:');
  console.log(`    GET    /api/knowledge/conflicts/batches`);
  console.log(`    GET    /api/knowledge/conflicts[?batchId=BATCH-001]`);
  console.log(`    PATCH  /api/knowledge/conflicts/:conflictId`);
  console.log('  Policies:');
  console.log(`    GET/POST /api/knowledge/policies/filtering`);
  console.log(`    GET/PUT/DELETE /api/knowledge/policies/filtering/:id`);
  console.log(`    GET    /api/knowledge/policies/extraction`);
  console.log(`    PUT    /api/knowledge/policies/extraction/custom`);
  console.log('  Fleet:');
  console.log(`    GET    /api/fleet/stats\n`);
});
