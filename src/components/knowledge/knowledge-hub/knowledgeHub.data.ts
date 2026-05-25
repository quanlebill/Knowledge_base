import React from 'react';
import { Database, FileText, Video, Globe, ServerCog } from 'lucide-react';

/* ─── Tab types ────────────────────────────────────────────────────── */
export type GraphHubTab = 'DATABASE' | 'QDRANT' | 'NEO4J';
export type DBSubType = 'All' | 'Document' | 'Media' | 'Web' | 'Warehouse';

/* ─── Database document (Gold layer) ─────────────────────────────── */
export interface DBDocument {
  id: string;
  name: string;
  type: string;
  added_date: string;
  language: string;
  author: string;
  version: string;
  subType: DBSubType;
}

export const getSubType = (type: string): DBSubType => {
  if (!type) return 'Document';
  if (type.startsWith('Doc/'))    return 'Document';
  if (type.startsWith('Video/') || type.startsWith('Image/')) return 'Media';
  if (type.toLowerCase() === 'web') return 'Web';
  if (type.startsWith('Warehouse/')) return 'Warehouse';
  return 'Document';
};

export const DB_SUBTYPES: { id: DBSubType; label: string; icon: React.ElementType }[] = [
  { id: 'All',       label: 'All',       icon: Database  },
  { id: 'Document',  label: 'Document',  icon: FileText  },
  { id: 'Media',     label: 'Media',     icon: Video     },
  { id: 'Web',       label: 'Web',       icon: Globe     },
  { id: 'Warehouse', label: 'Warehouse', icon: ServerCog },
];

/* ─── Warehouse types ────────────────────────────────────────────── */
export interface WTableEntry {
  id: string;
  schema: string;
  tableName: string;
  rowCount: number;
  columns: number;
}

export interface WConfig {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  status: 'Active' | 'Draft' | 'Archived';
  syncSchedule: string;
  tables: WTableEntry[];
}

export interface WConnection {
  platform: string;
  host: string;
  database?: string;
  catalog?: string;
  warehouse?: string;
  cluster?: string;
  role?: string;
}

export const getWarehouseConnection = (type: string): WConnection => {
  if (type === 'Warehouse/snowflake') return {
    platform: 'Snowflake',
    host: 'globalcorp-prod.snowflakecomputing.com',
    database: 'ANALYTICS_DB',
    warehouse: 'COMPUTE_WH',
    role: 'ANALYST_ROLE',
  };
  if (type === 'Warehouse/databricks') return {
    platform: 'Databricks',
    host: 'adb-1234567890.azuredatabricks.net',
    catalog: 'ml_catalog',
    cluster: 'ml-feature-cluster',
  };
  return { platform: type.replace('Warehouse/', ''), host: 'unknown' };
};

export const formatRows = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

export const nextVersion = (existing: string[]): string => {
  if (existing.length === 0) return 'v1.0';
  let major = 1, minor = 0;
  for (const v of existing) {
    const m = v.match(/v?(\d+)\.(\d+)/);
    if (!m) continue;
    const majN = parseInt(m[1], 10), minN = parseInt(m[2], 10);
    if (majN > major || (majN === major && minN >= minor)) { major = majN; minor = minN; }
  }
  return `v${major}.${minor + 1}`;
};

/* ─── Chunk / Version types ──────────────────────────────────────── */
export interface ChunkVersion {
  version_number: string;
  create_at: string;
  status: 'Active' | 'Inactive';
  embedding_models: string;
  entities: string[];
  intent: string;
  text: string;
}

export interface Chunk {
  id: string;
  title: string;
  text: string;
  versions: ChunkVersion[];
}

/* ─── Qdrant types ───────────────────────────────────────────────── */
export interface QdrantCollection {
  id: string;
  name: string;
  points: number;
  active: boolean;
  dimensions: number;
  distance: string;
  indexed: number;
  embedding_model?: string;
}

export interface QdrantPoint {
  point_id: string;
  score: number;
  summary: string;
  entities: string[];
  intent: string[];
}

/* ─── Neo4j query builder ────────────────────────────────────────── */
export interface QueryStep { id: string; relationship: string; nodeType: string; }

/* ─── Fallback mock data (used when mock server is not running) ──── */
export const FALLBACK_DOCS: DBDocument[] = [
  { id: 'GOL-001', name: 'Enterprise_Policy_Framework.pdf',  type: 'Doc/pdf',              added_date: '2026-05-20', language: 'English', author: 'platform-admin', version: 'v2.1', subType: 'Document'  },
  { id: 'GOL-002', name: 'Compliance_Standards_2026.docx',   type: 'Doc/docx',             added_date: '2026-05-21', language: 'English', author: 'ai-engineer',    version: 'v1.4', subType: 'Document'  },
  { id: 'GOL-003', name: 'VAT_Tax_Rules_EU_Region.md',       type: 'Doc/md',               added_date: '2026-05-22', language: 'German',  author: 'platform-admin', version: 'v3.0', subType: 'Document'  },
  { id: 'GOL-004', name: 'AgentGraph_NodeRegistry_v4.json',  type: 'Doc/json',             added_date: '2026-05-23', language: 'English', author: 'ai-engineer',    version: 'v4.1', subType: 'Document'  },
  { id: 'wh-001',  name: 'Snowflake Production Analytics DW', type: 'Warehouse/snowflake', added_date: '2026-05-24', language: 'N/A',     author: 'ARivera',        version: 'v1.0', subType: 'Warehouse' },
  { id: 'wh-002',  name: 'Databricks ML Feature Store',       type: 'Warehouse/databricks',added_date: '2026-05-24', language: 'N/A',     author: 'MLTeam',         version: 'v1.0', subType: 'Warehouse' },
];

export const FALLBACK_CHUNKS: Chunk[] = [
  {
    id: 'CHUNK_01',
    title: 'Deployment & Failover Architecture',
    text: 'The retrieval architecture utilizes a multi-cluster failover strategy. In the event of a latency spike exceeding 400ms, the agentic runtime will automatically fallback to the regional cold-storage indices.',
    versions: [
      {
        version_number: 'v1.2', create_at: '2026-05-23 15:30:10 UTC', status: 'Active',
        embedding_models: 'text-embedding-3-small (1536d)',
        entities: ['GlobalCorp', 'Failover Cluster', 'Regional Cold Storage'],
        intent: 'Explain multi-cluster failover latency-target parameters and fallback',
        text: 'The retrieval architecture utilizes a multi-cluster failover strategy. In the event of a latency spike exceeding 400ms, the agentic runtime will automatically fallback to the regional cold-storage indices.',
      },
      {
        version_number: 'v1.1', create_at: '2025-12-10 09:20:45 UTC', status: 'Inactive',
        embedding_models: 'text-embedding-gecko',
        entities: ['GlobalCorp', 'Failover Server', 'Regional Storage'],
        intent: 'Describe failover backup parameters and regional target threshold',
        text: 'The failover backup parameters specify that operations automatically migrate to replica clusters if database server timeouts exceed 500ms.',
      },
      {
        version_number: 'v1.0', create_at: '2025-06-15 14:00:00 UTC', status: 'Inactive',
        embedding_models: 'bge-large-en-v1.5',
        entities: ['GlobalCorp', 'Failover Engine'],
        intent: 'Setup infrastructure document latency fallback constraints',
        text: 'Draft guidelines outlining failover processes for corporate systems.',
      },
    ],
  },
  {
    id: 'CHUNK_02',
    title: 'Data Sovereignty & Chunk Compliance',
    text: 'Sovereignty laws mandate that PII masking is strictly enforced at the chunk level before embedding.',
    versions: [
      {
        version_number: 'v2.1', create_at: '2026-05-24 01:10:00 UTC', status: 'Active',
        embedding_models: 'text-embedding-3-large (3072d)',
        entities: ['Sovereignty Law', 'PII Masking', 'Cross-tenant Contamination'],
        intent: 'PII encryption protocol and tenant isolation thresholds',
        text: 'Sovereignty laws mandate that PII masking is strictly enforced at the chunk level before embedding.',
      },
      {
        version_number: 'v2.0', create_at: '2026-02-14 11:15:22 UTC', status: 'Inactive',
        embedding_models: 'text-embedding-3-small',
        entities: ['PII Masking', 'Cross-tenant Leakage'],
        intent: 'Initial tenant segregation requirements',
        text: 'Standard tenant segregation mandates text filters before streaming to silver vector pools.',
      },
    ],
  },
  {
    id: 'CHUNK_03',
    title: 'Cognitive Parsing & Ingestion Drivers',
    text: 'Ingestion pipelines handle raw source data (HTML crawled pages, image grids, MP4 logs).',
    versions: [
      {
        version_number: 'v1.0', create_at: '2026-05-20 08:32:15 UTC', status: 'Active',
        embedding_models: 'cohere-embed-english-v3.0',
        entities: ['Parser Nodes', 'Markdown Arrays', 'Ingestion Pipeline'],
        intent: 'Outline media metadata extraction and raw file sanitization',
        text: 'Ingestion pipelines handle raw source data (HTML crawled pages, image grids, MP4 logs). Structured parser nodes convert arbitrary binary matrices into standard Markdown arrays.',
      },
    ],
  },
];

export const ALL_AVAILABLE_TABLES: Record<string, WTableEntry[]> = {
  'wh-001': [
    { id: 'at-001', schema: 'PUBLIC',    tableName: 'CUSTOMER_EVENTS',  rowCount: 2400000,  columns: 24 },
    { id: 'at-002', schema: 'PUBLIC',    tableName: 'PRODUCT_CATALOG',  rowCount: 85420,    columns: 18 },
    { id: 'at-003', schema: 'PUBLIC',    tableName: 'USER_SESSIONS',    rowCount: 12800000, columns: 15 },
    { id: 'at-004', schema: 'PUBLIC',    tableName: 'ORDERS_HISTORY',   rowCount: 5600000,  columns: 32 },
    { id: 'at-005', schema: 'FINANCE',   tableName: 'REVENUE_METRICS',  rowCount: 340000,   columns: 31 },
    { id: 'at-006', schema: 'FINANCE',   tableName: 'COST_CENTER_MAP',  rowCount: 320,      columns: 8  },
    { id: 'at-007', schema: 'ANALYTICS', tableName: 'FUNNEL_STAGES',    rowCount: 4200,     columns: 9  },
    { id: 'at-008', schema: 'ANALYTICS', tableName: 'CONVERSION_RATES', rowCount: 18500,    columns: 12 },
  ],
  'wh-002': [
    { id: 'at-009', schema: 'ml_features', tableName: 'user_embeddings',    rowCount: 950000,   columns: 128 },
    { id: 'at-010', schema: 'ml_features', tableName: 'product_signals',    rowCount: 310000,   columns: 64  },
    { id: 'at-011', schema: 'ml_features', tableName: 'item_vectors',       rowCount: 1200000,  columns: 64  },
    { id: 'at-012', schema: 'raw',         tableName: 'clickstream_raw',    rowCount: 45000000, columns: 22  },
    { id: 'at-013', schema: 'raw',         tableName: 'events_raw',         rowCount: 78000000, columns: 18  },
    { id: 'at-014', schema: 'curated',     tableName: 'model_training_set', rowCount: 2100000,  columns: 89  },
    { id: 'at-015', schema: 'curated',     tableName: 'validation_set',     rowCount: 420000,   columns: 89  },
  ],
};

export const FALLBACK_WAREHOUSE_CONFIGS: Record<string, WConfig[]> = {
  'wh-001': [
    {
      id: 'cfg-001', name: 'Analytics Core', version: 'v2.1',
      createdAt: '2026-05-20 09:00 UTC', status: 'Active', syncSchedule: 'Every 6 hours',
      tables: [
        { id: 'at-001', schema: 'PUBLIC',  tableName: 'CUSTOMER_EVENTS', rowCount: 2400000,  columns: 24 },
        { id: 'at-002', schema: 'PUBLIC',  tableName: 'PRODUCT_CATALOG', rowCount: 85420,    columns: 18 },
        { id: 'at-003', schema: 'PUBLIC',  tableName: 'USER_SESSIONS',   rowCount: 12800000, columns: 15 },
      ],
    },
    {
      id: 'cfg-002', name: 'Finance Reporting', version: 'v1.2',
      createdAt: '2026-04-15 14:30 UTC', status: 'Draft', syncSchedule: 'Every 12 hours',
      tables: [
        { id: 'at-005', schema: 'FINANCE',   tableName: 'REVENUE_METRICS', rowCount: 340000, columns: 31 },
        { id: 'at-006', schema: 'FINANCE',   tableName: 'COST_CENTER_MAP', rowCount: 320,    columns: 8  },
        { id: 'at-007', schema: 'ANALYTICS', tableName: 'FUNNEL_STAGES',   rowCount: 4200,   columns: 9  },
      ],
    },
  ],
  'wh-002': [
    {
      id: 'cfg-003', name: 'ML Feature Set', version: 'v3.0',
      createdAt: '2026-05-22 11:00 UTC', status: 'Active', syncSchedule: 'Every 4 hours',
      tables: [
        { id: 'at-009', schema: 'ml_features', tableName: 'user_embeddings',    rowCount: 950000,  columns: 128 },
        { id: 'at-010', schema: 'ml_features', tableName: 'product_signals',    rowCount: 310000,  columns: 64  },
        { id: 'at-014', schema: 'curated',     tableName: 'model_training_set', rowCount: 2100000, columns: 89  },
      ],
    },
    {
      id: 'cfg-004', name: 'Raw Ingestion', version: 'v1.1',
      createdAt: '2026-05-10 08:00 UTC', status: 'Draft', syncSchedule: 'Daily',
      tables: [
        { id: 'at-012', schema: 'raw', tableName: 'clickstream_raw', rowCount: 45000000, columns: 22 },
        { id: 'at-013', schema: 'raw', tableName: 'events_raw',      rowCount: 78000000, columns: 18 },
      ],
    },
  ],
};

export const FALLBACK_QDRANT: QdrantCollection[] = [
  { id: 'qd-001', name: 'aeroflow_enterprise_v2',  points: 892541, active: true,  dimensions: 1536, distance: 'Cosine', indexed: 100, embedding_model: 'text-embedding-3-small' },
  { id: 'qd-002', name: 'aeroflow_contracts_v1',   points: 124870, active: true,  dimensions: 1536, distance: 'Cosine', indexed: 98,  embedding_model: 'text-embedding-ada-002' },
  { id: 'qd-003', name: 'aeroflow_regulations_v1', points:  67320, active: true,  dimensions:  768, distance: 'Dot',    indexed: 100, embedding_model: 'all-MiniLM-L6-v2' },
  { id: 'qd-004', name: 'aeroflow_legacy_archive', points:  45230, active: false, dimensions:  768, distance: 'Dot',    indexed: 100, embedding_model: 'all-MiniLM-L6-v2' },
];

export const AVAILABLE_NODES = ['Person','Organization','Location','Policy','Contract','Regulation','Product','Department','Event','Agreement'];
export const AVAILABLE_RELS  = ['WORKS_FOR','GOVERNED_BY','LOCATED_IN','PART_OF','REFERENCES','COMPLIES_WITH','CAUSES','RELATED_TO','SUPERSEDES','AUTHORIZED_BY'];

export const FALLBACK_EDGES = [
  [450,280,200,160],[450,280,700,160],[450,280,450,460],
  [200,160,100,320],[700,160,800,320],[450,460,260,510],[450,460,640,510],
];

export const FALLBACK_REL_LABELS: [number,number,string][] = [
  [320,208,'WORKS_FOR'],[580,208,'GOVERNED_BY'],[445,368,'PART_OF'],
  [142,242,'LOCATED_IN'],[758,242,'COMPLIES_WITH'],
];

export const FALLBACK_NODES = [
  { x:450, y:280, label:'Organization', r:18, core:true  },
  { x:200, y:160, label:'Person',       r:13, core:false },
  { x:700, y:160, label:'Policy',       r:13, core:false },
  { x:450, y:460, label:'Contract',     r:13, core:false },
  { x:100, y:320, label:'Location',     r:9,  core:false },
  { x:800, y:320, label:'Regulation',   r:9,  core:false },
  { x:260, y:510, label:'Department',   r:9,  core:false },
  { x:640, y:510, label:'Agreement',    r:9,  core:false },
];

export const buildCypher = (startNode: string, steps: QueryStep[]): string => {
  let c = `MATCH (a:${startNode})`;
  const r = ['a'];
  steps.forEach((s, i) => {
    const v = String.fromCharCode(98 + i);
    c += `-[:${s.relationship}]->(${v}:${s.nodeType})`;
    r.push(v);
  });
  return c + `\nRETURN ${r.join(', ')}`;
};

export const PAGE_SIZE = 20;
