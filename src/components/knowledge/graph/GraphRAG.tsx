import React, { useState, useEffect, useMemo } from 'react';
import {
  Network, Database, Zap, Plus, Layers, Info, Code, Play,
  ArrowDown, Circle, CheckCircle2, Eye, ArrowLeft,
  Layers3, Clock, Tag, GitBranch, Trash2, FileText, Video, Globe, ServerCog,
  Table2, RefreshCw, AlertCircle, Server, Link, Search, ChevronLeft, ChevronRight,
  Cpu, SendHorizonal, Loader2, Hash, List, MessageSquare,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';
import { DetailDrawer } from '../../shared/DetailDrawer';
import { mockGet, mockMutate } from '../../../lib/mockApi';
import { useAppState } from '../../../AppStateContext';

type GraphHubTab = 'DATABASE' | 'QDRANT' | 'NEO4J';
type DBSubType = 'All' | 'Document' | 'Media' | 'Web' | 'Warehouse';

/* ─── Database document (Gold layer) ─────────────────────────────── */
interface DBDocument {
  id: string;
  name: string;
  type: string;
  added_date: string;
  language: string;
  author: string;
  version: string;
  subType: DBSubType;
}

const getSubType = (type: string): DBSubType => {
  if (!type) return 'Document';
  if (type.startsWith('Doc/'))    return 'Document';
  if (type.startsWith('Video/') || type.startsWith('Image/')) return 'Media';
  if (type.toLowerCase() === 'web') return 'Web';
  if (type.startsWith('Warehouse/')) return 'Warehouse';
  return 'Document';
};

const DB_SUBTYPES: { id: DBSubType; label: string; icon: React.ElementType }[] = [
  { id: 'All',       label: 'All',       icon: Database   },
  { id: 'Document',  label: 'Document',  icon: FileText   },
  { id: 'Media',     label: 'Media',     icon: Video      },
  { id: 'Web',       label: 'Web',       icon: Globe      },
  { id: 'Warehouse', label: 'Warehouse', icon: ServerCog  },
];

/* ─── Warehouse types ────────────────────────────────────────────── */
interface WTableEntry {
  id: string;
  schema: string;
  tableName: string;
  rowCount: number;
  columns: number;
}

interface WConfig {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  status: 'Active' | 'Draft' | 'Archived';
  syncSchedule: string;
  tables: WTableEntry[];
}

interface WConnection {
  platform: string;
  host: string;
  database?: string;
  catalog?: string;
  warehouse?: string;
  cluster?: string;
  role?: string;
}

const getWarehouseConnection = (type: string): WConnection => {
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

const formatRows = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

const nextVersion = (existing: string[]): string => {
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
interface ChunkVersion {
  version_number: string;
  create_at: string;
  status: 'Active' | 'Inactive';
  embedding_models: string;
  entities: string[];
  intent: string;
  text: string;
}

interface Chunk {
  id: string;
  title: string;
  text: string;
  versions: ChunkVersion[];
}

/* ─── Qdrant types ───────────────────────────────────────────────── */
interface QdrantCollection {
  id: string; name: string; points: number; active: boolean;
  dimensions: number; distance: string; indexed: number;
  embedding_model?: string;
}

interface QdrantPoint {
  point_id: string;
  score: number;
  summary: string;
  entities: string[];
  intent: string[];
}

/* ─── Neo4j query builder ────────────────────────────────────────── */
interface QueryStep { id: string; relationship: string; nodeType: string; }

/* ═══════════════════ FALLBACK MOCK DATA ════════════════════════════
   Used when the mock server (testing/server.js) is not running.
   ════════════════════════════════════════════════════════════════════ */

const FALLBACK_DOCS: DBDocument[] = [
  { id: 'GOL-001', name: 'Enterprise_Policy_Framework.pdf', type: 'Doc/pdf',        added_date: '2026-05-20', language: 'English', author: 'platform-admin', version: 'v2.1', subType: 'Document'  },
  { id: 'GOL-002', name: 'Compliance_Standards_2026.docx',  type: 'Doc/docx',       added_date: '2026-05-21', language: 'English', author: 'ai-engineer',    version: 'v1.4', subType: 'Document'  },
  { id: 'GOL-003', name: 'VAT_Tax_Rules_EU_Region.md',      type: 'Doc/md',         added_date: '2026-05-22', language: 'German',  author: 'platform-admin', version: 'v3.0', subType: 'Document'  },
  { id: 'GOL-004', name: 'AgentGraph_NodeRegistry_v4.json', type: 'Doc/json',       added_date: '2026-05-23', language: 'English', author: 'ai-engineer',    version: 'v4.1', subType: 'Document'  },
  { id: 'wh-001',  name: 'Snowflake Production Analytics DW', type: 'Warehouse/snowflake', added_date: '2026-05-24', language: 'N/A', author: 'ARivera', version: 'v1.0', subType: 'Warehouse' },
  { id: 'wh-002',  name: 'Databricks ML Feature Store',      type: 'Warehouse/databricks', added_date: '2026-05-24', language: 'N/A', author: 'MLTeam', version: 'v1.0', subType: 'Warehouse' },
];

const FALLBACK_CHUNKS: Chunk[] = [
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

/* Pool of all available tables per warehouse (for the "add config" picker) */
const ALL_AVAILABLE_TABLES: Record<string, WTableEntry[]> = {
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

const FALLBACK_WAREHOUSE_CONFIGS: Record<string, WConfig[]> = {
  'wh-001': [
    {
      id: 'cfg-001', name: 'Analytics Core', version: 'v2.1',
      createdAt: '2026-05-20 09:00 UTC', status: 'Active', syncSchedule: 'Every 6 hours',
      tables: [
        { id: 'at-001', schema: 'PUBLIC',    tableName: 'CUSTOMER_EVENTS', rowCount: 2400000,  columns: 24 },
        { id: 'at-002', schema: 'PUBLIC',    tableName: 'PRODUCT_CATALOG', rowCount: 85420,    columns: 18 },
        { id: 'at-003', schema: 'PUBLIC',    tableName: 'USER_SESSIONS',   rowCount: 12800000, columns: 15 },
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

const FALLBACK_QDRANT: QdrantCollection[] = [
  { id: 'qd-001', name: 'aeroflow_enterprise_v2',  points: 892541, active: true,  dimensions: 1536, distance: 'Cosine', indexed: 100, embedding_model: 'text-embedding-3-small' },
  { id: 'qd-002', name: 'aeroflow_contracts_v1',   points: 124870, active: true,  dimensions: 1536, distance: 'Cosine', indexed: 98,  embedding_model: 'text-embedding-ada-002' },
  { id: 'qd-003', name: 'aeroflow_regulations_v1', points:  67320, active: true,  dimensions:  768, distance: 'Dot',    indexed: 100, embedding_model: 'all-MiniLM-L6-v2' },
  { id: 'qd-004', name: 'aeroflow_legacy_archive', points:  45230, active: false, dimensions:  768, distance: 'Dot',    indexed: 100, embedding_model: 'all-MiniLM-L6-v2' },
];

const AVAILABLE_NODES = ['Person','Organization','Location','Policy','Contract','Regulation','Product','Department','Event','Agreement'];
const AVAILABLE_RELS  = ['WORKS_FOR','GOVERNED_BY','LOCATED_IN','PART_OF','REFERENCES','COMPLIES_WITH','CAUSES','RELATED_TO','SUPERSEDES','AUTHORIZED_BY'];
const FALLBACK_EDGES = [[450,280,200,160],[450,280,700,160],[450,280,450,460],[200,160,100,320],[700,160,800,320],[450,460,260,510],[450,460,640,510]];
const FALLBACK_REL_LABELS: [number,number,string][] = [[320,208,'WORKS_FOR'],[580,208,'GOVERNED_BY'],[445,368,'PART_OF'],[142,242,'LOCATED_IN'],[758,242,'COMPLIES_WITH']];
const FALLBACK_NODES = [
  {x:450,y:280,label:'Organization',r:18,core:true},{x:200,y:160,label:'Person',r:13,core:false},
  {x:700,y:160,label:'Policy',r:13,core:false},{x:450,y:460,label:'Contract',r:13,core:false},
  {x:100,y:320,label:'Location',r:9,core:false},{x:800,y:320,label:'Regulation',r:9,core:false},
  {x:260,y:510,label:'Department',r:9,core:false},{x:640,y:510,label:'Agreement',r:9,core:false},
];

const buildCypher = (startNode: string, steps: QueryStep[]): string => {
  let c = `MATCH (a:${startNode})`;
  const r = ['a'];
  steps.forEach((s, i) => { const v = String.fromCharCode(98+i); c += `-[:${s.relationship}]->(${v}:${s.nodeType})`; r.push(v); });
  return c + `\nRETURN ${r.join(', ')}`;
};

/* ═══════════════════ COMPONENT ════════════════════════════════════ */

export const GraphRAGView = () => {
  const { documents, docsLoading } = useAppState();
  const [activeTab, setActiveTab] = useState<GraphHubTab>('DATABASE');

  /* ── Database: derive GOLD docs from shared context (same source as Data Layers) ── */
  const docs = useMemo<DBDocument[]>(
    () => documents
      .filter(d => d.layer === 'GOLD')
      .map(d => ({
        id: d.id,
        name: d.name,
        type: d.metadata?.type ?? 'Unknown',
        added_date: d.lastUpdated,
        language: d.metadata?.language ?? 'N/A',
        author: d.author,
        version: d.version,
        subType: getSubType(d.metadata?.type ?? ''),
      })),
    [documents],
  );

  const [dbSubType, setDbSubType]           = useState<DBSubType>('All');
  const [dbSearch, setDbSearch]             = useState('');
  const [dbPage, setDbPage]                 = useState(1);
  const [selectedDoc, setSelectedDoc]       = useState<DBDocument | null>(null);
  const [chunks, setChunks]                 = useState<Chunk[]>([]);
  const [chunksLoading, setChunksLoading]   = useState(false);
  const [selectedChunk, setSelectedChunk]   = useState<Chunk | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ChunkVersion | null>(null);

  /* ── Warehouse config state ── */
  const [warehouseConfigs, setWarehouseConfigs]           = useState<WConfig[]>([]);
  const [warehouseConfigsLoading, setWarehouseConfigsLoading] = useState(false);
  const [selectedConfig, setSelectedConfig]               = useState<WConfig | null>(null);
  const [newCfgDrawerOpen, setNewCfgDrawerOpen]           = useState(false);
  const [newCfgName, setNewCfgName]                       = useState('');
  const [newCfgSchedule, setNewCfgSchedule]               = useState('Every 6 hours');
  const [newCfgSelectedIds, setNewCfgSelectedIds]         = useState<Set<string>>(new Set());
  const [newCfgSchemaFilter, setNewCfgSchemaFilter]       = useState<string>('All');

  /* ── Qdrant state ── */
  const [qdrantCollections, setQdrantCollections]       = useState<QdrantCollection[]>([]);
  const [selectedCollection, setSelectedCollection]     = useState<QdrantCollection | null>(null);
  const [qdrantQuery, setQdrantQuery]                   = useState('');
  const [qdrantPoints, setQdrantPoints]                 = useState<QdrantPoint[]>([]);
  const [qdrantSearching, setQdrantSearching]           = useState(false);

  /* New-version form */
  const [newVerDrawerOpen, setNewVerDrawerOpen] = useState(false);
  const [newVerContent, setNewVerContent]       = useState('');

  /* ── Auto-computed next version tags ── */
  const autoNextChunkVer = useMemo(
    () => nextVersion(selectedChunk?.versions.map(v => v.version_number) ?? []),
    [selectedChunk],
  );
  const autoNextCfgVer = useMemo(
    () => nextVersion(warehouseConfigs.map(c => c.version)),
    [warehouseConfigs],
  );

  /* ── Query builder state ── */
  const [startNode, setStartNode] = useState(AVAILABLE_NODES[0]);
  const [steps, setSteps]         = useState<QueryStep[]>([]);
  const [cypher, setCypher]       = useState('');
  const [queryRan, setQueryRan]   = useState(false);

  /* ── Fetch: Qdrant on mount ── */
  useEffect(() => {
    mockGet<QdrantCollection[]>('/api/knowledge/qdrant/collections')
      .then(setQdrantCollections)
      .catch(() => setQdrantCollections(FALLBACK_QDRANT));
  }, []);

  /* ── Delete confirmation state ── */
  const [pendingDeleteDoc,     setPendingDeleteDoc]     = useState<string | null>(null);
  const [pendingDeleteChunk,   setPendingDeleteChunk]   = useState<string | null>(null);
  const [pendingDeleteVersion, setPendingDeleteVersion] = useState<string | null>(null);
  const [pendingDeleteConfig,  setPendingDeleteConfig]  = useState<string | null>(null);
  const [pendingDeleteTable,   setPendingDeleteTable]   = useState<string | null>(null);

  const { deleteDocument } = useAppState();

  const handleDeleteDoc = async (docId: string) => {
    try {
      await mockMutate('DELETE', `/api/data/documents/${docId}`);
      deleteDocument(docId);
      if (selectedDoc?.id === docId) setSelectedDoc(null);
    } catch { /* ForbiddenToast handles 403 */ } finally { setPendingDeleteDoc(null); }
  };

  const handleDeleteChunk = async (chunkId: string) => {
    if (!selectedDoc) return;
    try {
      await mockMutate('DELETE', `/api/knowledge/documents/${selectedDoc.id}/chunks/${chunkId}`);
      setChunks(prev => prev.filter(c => c.id !== chunkId));
      if (selectedChunk?.id === chunkId) { setSelectedChunk(null); setSelectedVersion(null); }
    } catch { /* ForbiddenToast handles 403 */ } finally { setPendingDeleteChunk(null); }
  };

  const handleDeleteVersion = async (versionNumber: string) => {
    if (!selectedDoc || !selectedChunk) return;
    try {
      await mockMutate('DELETE', `/api/knowledge/documents/${selectedDoc.id}/chunks/${selectedChunk.id}/versions/${versionNumber}`);
      const updated = { ...selectedChunk, versions: selectedChunk.versions.filter(v => v.version_number !== versionNumber) };
      setChunks(prev => prev.map(c => c.id === selectedChunk.id ? updated : c));
      setSelectedChunk(updated);
      if (selectedVersion?.version_number === versionNumber) setSelectedVersion(updated.versions[0] ?? null);
    } catch { /* ForbiddenToast handles 403 */ } finally { setPendingDeleteVersion(null); }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!selectedDoc) return;
    try {
      await mockMutate('DELETE', `/api/knowledge/warehouses/${selectedDoc.id}/configs/${configId}`);
      const updated = warehouseConfigs.filter(c => c.id !== configId);
      setWarehouseConfigs(updated);
      if (selectedConfig?.id === configId) setSelectedConfig(updated[0] ?? null);
    } catch { /* ForbiddenToast handles 403 */ } finally { setPendingDeleteConfig(null); }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!selectedDoc || !selectedConfig) return;
    try {
      await mockMutate('DELETE', `/api/knowledge/warehouses/${selectedDoc.id}/configs/${selectedConfig.id}/tables/${tableId}`);
      const updated = { ...selectedConfig, tables: selectedConfig.tables.filter(t => t.id !== tableId) };
      setWarehouseConfigs(prev => prev.map(c => c.id === selectedConfig.id ? updated : c));
      setSelectedConfig(updated);
    } catch { /* ForbiddenToast handles 403 */ } finally { setPendingDeleteTable(null); }
  };

  /* ── Qdrant toggle active ── */
  const [qdrantToggling, setQdrantToggling] = useState(false);
  const handleToggleActive = async () => {
    if (!selectedCollection) return;
    setQdrantToggling(true);
    try {
      const updated = await mockMutate<QdrantCollection>(
        'PATCH',
        `/api/knowledge/qdrant/collections/${selectedCollection.id}`,
        { active: !selectedCollection.active },
      );
      if (updated) {
        setQdrantCollections(prev => prev.map(c => c.id === updated.id ? updated : c));
        setSelectedCollection(updated);
      }
    } finally {
      setQdrantToggling(false);
    }
  };

  /* ── Qdrant semantic search ── */
  const handleQdrantSearch = async () => {
    if (!selectedCollection || !qdrantQuery.trim()) return;
    setQdrantSearching(true);
    try {
      const points = await mockMutate<QdrantPoint[]>(
        'POST',
        `/api/knowledge/qdrant/collections/${selectedCollection.id}/search`,
        { query: qdrantQuery.trim() },
      );
      setQdrantPoints(points ?? []);
    } catch {
      setQdrantPoints([]);
    } finally {
      setQdrantSearching(false);
    }
  };

  /* ── Fetch: chunks or warehouse configs when a doc is selected ── */
  useEffect(() => {
    if (!selectedDoc) {
      setChunks([]); setSelectedChunk(null); setSelectedVersion(null);
      setWarehouseConfigs([]); setSelectedConfig(null);
      return;
    }
    if (selectedDoc.subType === 'Warehouse') {
      setWarehouseConfigsLoading(true);
      mockGet<WConfig[]>(`/api/knowledge/warehouses/${selectedDoc.id}/configs`)
        .then(data => {
          const list = data?.length ? data : (FALLBACK_WAREHOUSE_CONFIGS[selectedDoc.id] ?? []);
          setWarehouseConfigs(list);
          setSelectedConfig(list[0] ?? null);
        })
        .catch(() => {
          const list = FALLBACK_WAREHOUSE_CONFIGS[selectedDoc.id] ?? [];
          setWarehouseConfigs(list);
          setSelectedConfig(list[0] ?? null);
        })
        .finally(() => setWarehouseConfigsLoading(false));
    } else {
      setChunksLoading(true);
      mockGet<Chunk[]>(`/api/knowledge/documents/${selectedDoc.id}/chunks`)
        .then(data => {
          const list = data.length ? data : FALLBACK_CHUNKS;
          setChunks(list);
          setSelectedChunk(list[0]);
          setSelectedVersion(list[0].versions[0]);
        })
        .catch(() => {
          setChunks(FALLBACK_CHUNKS);
          setSelectedChunk(FALLBACK_CHUNKS[0]);
          setSelectedVersion(FALLBACK_CHUNKS[0].versions[0]);
        })
        .finally(() => setChunksLoading(false));
    }
  }, [selectedDoc]);

  /* ── Chunk helpers ── */
  const handleChunkChange = (chunk: Chunk) => {
    setSelectedChunk(chunk);
    setSelectedVersion(chunk.versions[0]);
  };

  /* ── Activate a version (set as Active, demote others) ── */
  const activateVersion = (ver: ChunkVersion) => {
    if (!selectedChunk || !selectedDoc) return;
    const updatedVersions = selectedChunk.versions.map(v => ({
      ...v,
      status: (v.version_number === ver.version_number ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
    }));
    const updatedChunk = { ...selectedChunk, versions: updatedVersions };
    setChunks(prev => prev.map(c => c.id === selectedChunk.id ? updatedChunk : c));
    setSelectedChunk(updatedChunk);
    setSelectedVersion({ ...ver, status: 'Active' });
    mockMutate('PATCH', `/api/knowledge/documents/${selectedDoc.id}/chunks/${selectedChunk.id}/activate`, {
      version_number: ver.version_number,
    }).catch(() => {});
  };

  /* ── Create new chunk version (auto-versioned, persisted to server) ── */
  const handleCreateVersion = () => {
    if (!newVerContent.trim() || !selectedChunk || !selectedDoc) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const newVer: ChunkVersion = {
      version_number: autoNextChunkVer,
      create_at: now,
      status: 'Inactive',
      embedding_models: 'text-embedding-3-large (3072d)',
      entities: [],
      intent: '',
      text: newVerContent.trim(),
    };
    const updatedChunk = { ...selectedChunk, versions: [newVer, ...selectedChunk.versions] };
    setChunks(prev => prev.map(c => c.id === selectedChunk.id ? updatedChunk : c));
    setSelectedChunk(updatedChunk);
    setSelectedVersion(newVer);
    setNewVerContent('');
    setNewVerDrawerOpen(false);
    mockMutate('POST', `/api/knowledge/documents/${selectedDoc.id}/chunks/${selectedChunk.id}/versions`, {
      version_number: newVer.version_number,
      text: newVer.text,
    }).catch(() => {});
  };

  /* ── Warehouse config helpers ── */
  const activateConfig = (cfg: WConfig) => {
    if (!selectedDoc) return;
    const updated = warehouseConfigs.map(c => ({
      ...c,
      status: (c.id === cfg.id ? 'Active' : c.status === 'Active' ? 'Draft' : c.status) as WConfig['status'],
    }));
    setWarehouseConfigs(updated);
    setSelectedConfig(updated.find(c => c.id === cfg.id) ?? null);
    mockMutate('PATCH', `/api/knowledge/warehouses/${selectedDoc.id}/configs/${cfg.id}/activate`, {}).catch(() => {});
  };

  const handleCreateConfig = () => {
    if (!newCfgName.trim() || newCfgSelectedIds.size === 0 || !selectedDoc) return;
    const allTables = ALL_AVAILABLE_TABLES[selectedDoc.id] ?? [];
    const pickedTables = allTables.filter(t => newCfgSelectedIds.has(t.id));
    const newCfg: WConfig = {
      id: `cfg-${Date.now()}`,
      name: newCfgName.trim(),
      version: autoNextCfgVer,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      status: 'Draft',
      syncSchedule: newCfgSchedule,
      tables: pickedTables,
    };
    setWarehouseConfigs(prev => [newCfg, ...prev]);
    setSelectedConfig(newCfg);
    setNewCfgName(''); setNewCfgSelectedIds(new Set()); setNewCfgSchemaFilter('All');
    setNewCfgDrawerOpen(false);
    mockMutate('POST', `/api/knowledge/warehouses/${selectedDoc.id}/configs`, {
      name: newCfg.name,
      version: newCfg.version,
      syncSchedule: newCfg.syncSchedule,
      tables: newCfg.tables,
      status: 'Draft',
    }).catch(() => {});
  };

  const PAGE_SIZE = 20;

  const searchedDocs = useMemo(() => {
    const byType = dbSubType === 'All' ? docs : docs.filter(d => d.subType === dbSubType);
    if (!dbSearch.trim()) return byType;
    const q = dbSearch.toLowerCase();
    return byType.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q) ||
      d.author.toLowerCase().includes(q) ||
      d.language.toLowerCase().includes(q),
    );
  }, [docs, dbSubType, dbSearch]);

  const totalPages = Math.max(1, Math.ceil(searchedDocs.length / PAGE_SIZE));
  const safePage   = Math.min(dbPage, totalPages);
  const pagedDocs  = searchedDocs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* reset to page 1 when filter or search changes */
  useEffect(() => { setDbPage(1); }, [dbSubType, dbSearch]);

  /* ── Query builder helpers ── */
  const addStep = () => { setSteps(p => [...p, { id: `s-${Date.now()}`, relationship: AVAILABLE_RELS[0], nodeType: AVAILABLE_NODES[1] }]); setQueryRan(false); };
  const deleteStep = (id: string) => { setSteps(p => p.filter(s => s.id !== id)); setQueryRan(false); };
  const updateStep = (id: string, f: 'relationship'|'nodeType', v: string) => { setSteps(p => p.map(s => s.id===id ? {...s,[f]:v} : s)); setQueryRan(false); };

  const tabs: { id: GraphHubTab; label: string; icon: React.ElementType }[] = [
    { id: 'DATABASE', label: 'Database', icon: Database },
    { id: 'QDRANT',   label: 'Qdrant',   icon: Layers   },
    { id: 'NEO4J',    label: 'Neo4j',    icon: Network  },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-[#111111]">

      {/* PAGE HEADER */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-[#8A5A00] font-mono mb-1">
          <Network className="w-3.5 h-3.5" />
          Knowledge Graph
        </div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Knowledge Hub</h1>
        <p className="text-slate-500 text-sm mt-1 max-w-2xl">
          Manage Gold-layer databases, inspect Qdrant vector collections, and explore Neo4j entity graphs.
        </p>
      </div>

      {/* INNER TABS */}
      <div className="flex gap-0 border-b border-[#BFA66A]/20">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedDoc(null); }}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-[#B88719] text-[#B88719]'
                : 'border-transparent text-slate-500 hover:text-[#8A5A00] hover:border-[#BFA66A]/40'
            )}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════ DATABASE TAB ════════════════ */}
      {activeTab === 'DATABASE' && (
        <>
          {/* New-version drawer */}
          <DetailDrawer
            isOpen={newVerDrawerOpen}
            onClose={() => setNewVerDrawerOpen(false)}
            title={`New Version · ${selectedChunk?.id ?? ''}`}
            subtitle={selectedChunk?.title ?? ''}
            icon={GitBranch}
            size="standard"
            footer={
              <div className="flex justify-end gap-2.5 w-full">
                <button onClick={() => setNewVerDrawerOpen(false)}
                  className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleCreateVersion}
                  disabled={!newVerContent.trim()}
                  className={cn(
                    'px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all',
                    newVerContent.trim()
                      ? 'bg-[#B88719] text-white hover:bg-[#8A5A00]'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  )}>
                  <Plus className="w-3.5 h-3.5" />
                  Create Version
                </button>
              </div>
            }>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3 px-4 py-2.5 bg-[#FFFDF8] border border-[#BFA66A]/30 rounded-xl">
                <GitBranch className="w-3.5 h-3.5 text-[#B88719] shrink-0" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#8A5A00] font-mono">Next Version (auto-assigned)</p>
                  <p className="text-sm font-mono font-black text-[#111111] mt-0.5">{autoNextChunkVer}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[#8A5A00] font-mono block">Chunk Text Content *</label>
                <textarea value={newVerContent} onChange={e => setNewVerContent(e.target.value)}
                  placeholder="Enter the updated chunk text for this version..."
                  rows={6}
                  className="w-full bg-white border border-[#BFA66A]/35 rounded-xl px-4 py-3 text-xs text-[#111111] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#B88719] transition-all font-mono leading-relaxed resize-none" />
              </div>
              <div className="p-3.5 bg-[#FFF9E8] border border-[#BFA66A]/30 rounded-xl flex gap-3">
                <Info className="w-4 h-4 text-[#8A5A00] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#5A4209] leading-relaxed">
                  The new version will be created as <strong>Inactive</strong>. Use the <strong>Set Active</strong> button to promote it as the live retriever.
                </p>
              </div>
            </div>
          </DetailDrawer>

          {docsLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading database…</div>
          ) : !selectedDoc ? (
            /* ── GOLD-STYLE DOCUMENT TABLE ── */
            <div className="space-y-4">

              {/* Search + filter row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search input */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    value={dbSearch}
                    onChange={e => setDbSearch(e.target.value)}
                    placeholder="Search by name, type, author, language…"
                    className="w-full pl-9 pr-4 py-2 bg-white border border-[#BFA66A]/25 rounded-xl text-xs text-[#111111] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#B88719] focus:border-[#B88719]/40 transition-all"
                  />
                </div>

                {/* Sub-type filter pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DB_SUBTYPES.map(st => {
                    const count = st.id === 'All' ? docs.length : docs.filter(d => d.subType === st.id).length;
                    return (
                      <button
                        key={st.id}
                        onClick={() => setDbSubType(st.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                          dbSubType === st.id
                            ? 'bg-[#111111] border-[#B88719]/60 text-[#D9B86C]'
                            : 'bg-white border-[#BFA66A]/25 text-[#5A4209]/70 hover:border-[#BFA66A]/50 hover:bg-[#FFFDF8]'
                        )}
                      >
                        <st.icon className="w-3 h-3" />
                        {st.label}
                        <span className={cn(
                          'ml-0.5 text-[9px] font-mono',
                          dbSubType === st.id ? 'text-[#D9B86C]/70' : 'text-slate-400'
                        )}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-[#BFA66A]/20 rounded-3xl overflow-hidden bg-white shadow-[0_4px_24px_rgba(184,135,25,0.02)]">
                {/* Table header */}
                <div className="px-6 py-4 bg-[#FFFDF8] border-b border-[#BFA66A]/15 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black text-[#5A4209]/80 uppercase tracking-widest">
                    Gold Layer · {dbSubType === 'All' ? 'All Types' : dbSubType}
                    {dbSearch.trim() && (
                      <span className="ml-2 text-[#B88719]">· "{dbSearch.trim()}"</span>
                    )}
                  </span>
                  <span className="text-[9px] font-mono font-bold py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                    {searchedDocs.length} result{searchedDocs.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FFFDF8] text-[10px] font-black text-[#5A4209]/80 uppercase tracking-widest border-b border-[#BFA66A]/20">
                      <th className="px-6 py-5">Document Name</th>
                      <th className="px-6 py-5">Source Type</th>
                      <th className="px-6 py-5">Added Date</th>
                      <th className="px-6 py-5">Language</th>
                      <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#BFA66A]/10 text-[#111111]">
                    {pagedDocs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400 font-mono">
                          {dbSearch.trim()
                            ? `No results for "${dbSearch.trim()}"`
                            : `No ${dbSubType === 'All' ? '' : dbSubType + ' '}documents in the Gold layer.`}
                        </td>
                      </tr>
                    ) : pagedDocs.map(doc => (
                      <tr key={doc.id}
                        onClick={() => setSelectedDoc(doc)}
                        className="group bg-[#FEFDF8]/40 hover:bg-[#FEF9E4]/50 transition-colors cursor-pointer">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-[#FFFDF8] border-[#BFA66A]/30 text-[#B88719] shrink-0">
                              <Zap className="w-4 h-4 animate-pulse" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#111111] group-hover:text-[#B88719] transition-colors uppercase tracking-tight truncate">
                                {doc.name}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{doc.version} · Added by {doc.author}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 font-mono text-xs text-slate-600">{doc.type}</td>
                        <td className="px-6 py-5 font-mono text-xs text-slate-500">{doc.added_date}</td>
                        <td className="px-6 py-5 font-mono text-xs text-slate-600">{doc.language}</td>
                        <td className="px-8 py-5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => setSelectedDoc(doc)}
                              className="px-2.5 py-1.5 bg-[#FFF9E8] hover:bg-[#B88719] hover:text-white border border-[#BFA66A]/45 hover:border-[#B88719]/40 rounded-lg text-[#8A5A00] font-bold text-[10px] uppercase tracking-wider transition-all inline-flex items-center gap-1 cursor-pointer">
                              <Eye className="w-3.5 h-3.5" />
                              Inspect
                            </button>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-mono font-black uppercase tracking-wider">Active</span>
                            </div>
                            {pendingDeleteDoc === doc.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDeleteDoc(doc.id)} className="px-2 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wide cursor-pointer">Confirm</button>
                                <button onClick={() => setPendingDeleteDoc(null)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wide cursor-pointer">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setPendingDeleteDoc(doc.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-[#BFA66A]/15 bg-[#FFFDF8] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500">
                      {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, searchedDocs.length)} of {searchedDocs.length}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setDbPage(p => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        className={cn(
                          'p-1.5 rounded-lg border transition-all cursor-pointer',
                          safePage === 1
                            ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                            : 'border-[#BFA66A]/30 text-[#8A5A00] hover:bg-[#FFF9E8] hover:border-[#BFA66A]/50'
                        )}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                        .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === '…' ? (
                            <span key={`ellipsis-${i}`} className="px-1 text-[10px] text-slate-400 font-mono">…</span>
                          ) : (
                            <button key={p} onClick={() => setDbPage(p as number)}
                              className={cn(
                                'min-w-[28px] h-7 px-2 rounded-lg border text-[10px] font-black transition-all cursor-pointer',
                                p === safePage
                                  ? 'bg-[#111111] border-[#B88719]/50 text-[#D9B86C]'
                                  : 'bg-white border-[#BFA66A]/25 text-[#5A4209]/70 hover:border-[#BFA66A]/50 hover:bg-[#FFFDF8]'
                              )}>
                              {p}
                            </button>
                          )
                        )}

                      <button
                        onClick={() => setDbPage(p => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        className={cn(
                          'p-1.5 rounded-lg border transition-all cursor-pointer',
                          safePage === totalPages
                            ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                            : 'border-[#BFA66A]/30 text-[#8A5A00] hover:bg-[#FFF9E8] hover:border-[#BFA66A]/50'
                        )}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          ) : selectedDoc.subType === 'Warehouse' ? (
            /* ── WAREHOUSE CONFIGS VIEW (chunk-style split panel) ── */
            <div className="space-y-4">
              {/* New-config drawer */}
              <DetailDrawer
                isOpen={newCfgDrawerOpen}
                onClose={() => { setNewCfgDrawerOpen(false); setNewCfgSelectedIds(new Set()); setNewCfgSchemaFilter('All'); }}
                title="New Config"
                subtitle={`Define a table set for ${selectedDoc.name}`}
                icon={Table2}
                size="standard"
                footer={
                  <div className="flex justify-end gap-2.5 w-full">
                    <button onClick={() => setNewCfgDrawerOpen(false)}
                      className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer">
                      Cancel
                    </button>
                    <button onClick={handleCreateConfig}
                      disabled={!newCfgName.trim() || newCfgSelectedIds.size === 0}
                      className={cn(
                        'px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all',
                        newCfgName.trim() && newCfgSelectedIds.size > 0
                          ? 'bg-[#B88719] text-white hover:bg-[#8A5A00]'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      )}>
                      <Plus className="w-3.5 h-3.5" />
                      Create Config
                    </button>
                  </div>
                }>
                {(() => {
                  const available = ALL_AVAILABLE_TABLES[selectedDoc.id] ?? [];
                  const schemas = ['All', ...Array.from(new Set(available.map(t => t.schema)))];
                  const visible = newCfgSchemaFilter === 'All' ? available : available.filter(t => t.schema === newCfgSchemaFilter);
                  return (
                    <div className="p-6 space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#8A5A00] font-mono block">Config Name *</label>
                          <input value={newCfgName} onChange={e => setNewCfgName(e.target.value)} placeholder="e.g. Analytics Core"
                            className="w-full bg-white border border-[#BFA66A]/35 rounded-xl px-4 py-2.5 text-xs text-[#111111] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#B88719] transition-all" />
                        </div>
                        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#FFFDF8] border border-[#BFA66A]/30 rounded-xl">
                          <GitBranch className="w-3.5 h-3.5 text-[#B88719] shrink-0" />
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-[#8A5A00] font-mono">Version (auto)</p>
                            <p className="text-sm font-mono font-black text-[#111111]">{autoNextCfgVer}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#8A5A00] font-mono block">Sync Schedule</label>
                        <select value={newCfgSchedule} onChange={e => setNewCfgSchedule(e.target.value)}
                          className="w-full bg-white border border-[#BFA66A]/35 rounded-xl px-4 py-2.5 text-xs text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#B88719] cursor-pointer">
                          {['Every 4 hours','Every 6 hours','Every 12 hours','Daily','Weekly','Manual'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#8A5A00] font-mono">Select Tables *</label>
                          <span className="text-[10px] font-mono text-slate-500">{newCfgSelectedIds.size} selected</span>
                        </div>
                        {/* Schema filter */}
                        <div className="flex gap-1.5 flex-wrap">
                          {schemas.map(s => (
                            <button key={s} onClick={() => setNewCfgSchemaFilter(s)}
                              className={cn(
                                'px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer',
                                newCfgSchemaFilter === s
                                  ? 'bg-[#111111] border-[#B88719]/50 text-[#D9B86C]'
                                  : 'bg-white border-[#BFA66A]/25 text-[#5A4209]/70 hover:border-[#BFA66A]/50'
                              )}>{s}</button>
                          ))}
                        </div>
                        {/* Table list */}
                        <div className="border border-[#BFA66A]/20 rounded-2xl overflow-hidden">
                          {visible.map((tbl, idx) => {
                            const checked = newCfgSelectedIds.has(tbl.id);
                            return (
                              <label key={tbl.id}
                                className={cn(
                                  'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                                  idx > 0 && 'border-t border-[#BFA66A]/10',
                                  checked ? 'bg-[#FFF9E8]' : 'bg-white hover:bg-[#FFFDF8]'
                                )}>
                                <input type="checkbox" checked={checked}
                                  onChange={() => {
                                    setNewCfgSelectedIds(prev => {
                                      const next = new Set(prev);
                                      next.has(tbl.id) ? next.delete(tbl.id) : next.add(tbl.id);
                                      return next;
                                    });
                                  }}
                                  className="w-3.5 h-3.5 accent-[#B88719] cursor-pointer shrink-0" />
                                <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono font-bold text-slate-500 shrink-0">{tbl.schema}</span>
                                <span className="text-xs font-mono font-bold text-[#111111] flex-1 truncate">{tbl.tableName}</span>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">{formatRows(tbl.rowCount)} rows</span>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">{tbl.columns} cols</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="p-3.5 bg-[#FFF9E8] border border-[#BFA66A]/30 rounded-xl flex gap-3">
                        <Info className="w-4 h-4 text-[#8A5A00] shrink-0 mt-0.5" />
                        <p className="text-[11px] text-[#5A4209] leading-relaxed">
                          The new config will be created as <strong>Draft</strong>. Use <strong>Set Active</strong> to promote it as the live sync config.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </DetailDrawer>

              {/* Back header */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#BFA66A]/35 hover:bg-[#FFF9E8] rounded-xl text-xs font-bold text-[#8A5A00] transition-all cursor-pointer shadow-2xs">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Database
                </button>
                <span className="text-[10px] font-mono text-slate-400">·</span>
                <span className="text-xs font-bold text-[#111111] uppercase truncate max-w-xs">{selectedDoc.name}</span>
                <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg text-green-700 text-[10px] font-bold">
                  <Link className="w-3.5 h-3.5" />
                  Connected · {selectedDoc.type}
                </span>
              </div>

              {warehouseConfigsLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading configs…</div>
              ) : (
                <div className="flex gap-6 overflow-hidden" style={{ height: 'calc(100vh - 340px)', minHeight: 520 }}>

                  {/* LEFT: config list */}
                  <div className="w-72 border border-[#BFA66A]/30 rounded-3xl flex flex-col bg-white overflow-hidden shrink-0 shadow-xs">
                    <div className="p-5 border-b border-[#BFA66A]/20 flex justify-between items-center bg-[#FFFDF8] shrink-0">
                      <h4 className="text-[10px] font-black text-[#5A4209] uppercase tracking-widest flex items-center gap-1.5">
                        <Layers3 className="w-4 h-4 text-[#B88719]" />
                        Configs
                      </h4>
                      <button onClick={() => setNewCfgDrawerOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#FFF9E8] border border-[#BFA66A]/40 hover:bg-[#B88719] hover:text-white text-[#8A5A00] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer">
                        <Plus className="w-3 h-3" />
                        New
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                      {warehouseConfigs.map(cfg => (
                        <div key={cfg.id}
                          className={cn(
                            'p-4 border rounded-xl transition-all relative group',
                            cfg.id === selectedConfig?.id
                              ? 'border-[#B88719] bg-[#FFF9E8] shadow-xs'
                              : 'border-[#BFA66A]/20 bg-white hover:border-[#BFA66A]/40 hover:bg-[#FFFDF8]'
                          )}>
                          <div className="cursor-pointer" onClick={() => setSelectedConfig(cfg)}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={cn(
                                'text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide',
                                cfg.status === 'Active'   ? 'text-green-800 bg-green-500/10'  :
                                cfg.status === 'Draft'    ? 'text-amber-800 bg-amber-500/10'  :
                                'text-slate-500 bg-slate-100'
                              )}>{cfg.status}</span>
                              <span className="text-[9px] font-mono text-slate-400">{cfg.tables.length} tables</span>
                            </div>
                            <div className="text-xs text-[#111111] font-bold truncate uppercase tracking-tight">{cfg.name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{cfg.version} · {cfg.syncSchedule}</div>
                          </div>
                          {cfg.status !== 'Active' && (
                            pendingDeleteConfig === cfg.id ? (
                              <div className="flex gap-1 mt-2">
                                <button onClick={() => handleDeleteConfig(cfg.id)} className="flex-1 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase cursor-pointer">Confirm Delete</button>
                                <button onClick={() => setPendingDeleteConfig(null)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black cursor-pointer">✕</button>
                              </div>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); setPendingDeleteConfig(cfg.id); }}
                                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RIGHT: config detail */}
                  {selectedConfig ? (
                    <div className="flex-1 border border-[#BFA66A]/30 rounded-3xl bg-white flex flex-col overflow-hidden shadow-xs">

                      {/* Config header */}
                      <div className="px-6 pt-5 pb-4 border-b border-[#BFA66A]/20 shrink-0 bg-[#FFFDF8]">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono text-[#8A5A00] font-black">{selectedConfig.id} · Table Config</span>
                            <h3 className="text-base font-bold text-[#111111] font-display">{selectedConfig.name}</h3>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] font-black uppercase text-[#B88719] bg-[#FFF9E9] border border-[#BFA66A]/30 px-2.5 py-1 rounded-lg font-mono">
                              {selectedConfig.version}
                            </span>
                            {selectedConfig.status === 'Draft' && (
                              <button onClick={() => activateConfig(selectedConfig)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#FFF9E8] border border-[#B88719]/40 hover:bg-[#B88719] hover:text-white text-[#8A5A00] rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer">
                                <Zap className="w-3 h-3" />
                                Set Active
                              </button>
                            )}
                            {selectedConfig.status === 'Active' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg text-green-700 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Connection mini-row */}
                        {(() => {
                          const conn = getWarehouseConnection(selectedDoc.type);
                          const fields = [
                            conn.platform,
                            conn.host,
                            conn.database ?? conn.catalog ?? '',
                            conn.warehouse ?? conn.cluster ?? '',
                            conn.role ?? '',
                            `Sync: ${selectedConfig.syncSchedule}`,
                          ].filter(Boolean);
                          return (
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                              {fields.map((f, i) => (
                                <span key={i} className="text-[10px] font-mono text-slate-500">{f}</span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Table list body */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-[#FEFEFE] shrink-0">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#5A4209]/70 font-mono flex items-center gap-1.5">
                            <Table2 className="w-3.5 h-3.5 text-[#B88719]" />
                            Table Set · {selectedConfig.tables.length} tables
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">{selectedConfig.createdAt}</span>
                        </div>
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#FFFDF8] text-[9px] font-black text-[#5A4209]/70 uppercase tracking-widest border-b border-[#BFA66A]/15">
                              <th className="px-6 py-3">Schema</th>
                              <th className="px-6 py-3">Table Name</th>
                              <th className="px-6 py-3 text-right">Rows</th>
                              <th className="px-6 py-3 text-right">Columns</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#BFA66A]/8">
                            {selectedConfig.tables.map(tbl => (
                              <tr key={tbl.id} className="group hover:bg-[#FFFDF8]/60 transition-colors">
                                <td className="px-6 py-4">
                                  <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-600">{tbl.schema}</span>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs font-bold text-[#111111]">{tbl.tableName}</td>
                                <td className="px-6 py-4 text-right font-mono text-xs font-bold text-[#2A2A2A]">{formatRows(tbl.rowCount)}</td>
                                <td className="px-6 py-4 text-right font-mono text-xs text-slate-500">{tbl.columns}</td>
                                <td className="px-4 py-4 text-right" onClick={e => e.stopPropagation()}>
                                  {pendingDeleteTable === tbl.id ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <button onClick={() => handleDeleteTable(tbl.id)} className="px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-black cursor-pointer">Confirm</button>
                                      <button onClick={() => setPendingDeleteTable(null)} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black cursor-pointer">✕</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setPendingDeleteTable(tbl.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

          ) : (
            /* ── CHUNKS VIEW ── */
            <div className="space-y-4">
              {/* Back header */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#BFA66A]/35 hover:bg-[#FFF9E8] rounded-xl text-xs font-bold text-[#8A5A00] transition-all cursor-pointer shadow-2xs">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Database
                </button>
                <span className="text-[10px] font-mono text-slate-400">·</span>
                <span className="text-xs font-bold text-[#111111] uppercase truncate max-w-xs">{selectedDoc.name}</span>
                <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg text-green-700 text-[10px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Gold Layer · Active
                </span>
              </div>

              {chunksLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading chunks…</div>
              ) : (
                /* Split panel */
                <div className="flex gap-6 overflow-hidden" style={{ height: 'calc(100vh - 340px)', minHeight: 520 }}>

                  {/* LEFT: chunk list */}
                  <div className="w-80 border border-[#BFA66A]/30 rounded-3xl flex flex-col bg-white overflow-hidden shrink-0 shadow-xs">
                    <div className="p-5 border-b border-[#BFA66A]/20 flex justify-between items-center bg-[#FFFDF8]">
                      <h4 className="text-[10px] font-black text-[#5A4209] uppercase tracking-widest flex items-center gap-1.5">
                        <Layers3 className="w-4 h-4 text-[#B88719]" />
                        Active Chunks
                      </h4>
                      <span className="text-[10px] font-mono text-[#8A5A00] font-black bg-[#FFF9E8] border border-[#BFA66A]/30 px-2 py-0.5 rounded">
                        {chunks.length} Chunks
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-[#FCFBF7]/30">
                      {chunks.map(chunk => (
                        <div key={chunk.id}
                          className={cn(
                            'p-4 border rounded-xl transition-all group text-left relative',
                            chunk.id === selectedChunk?.id
                              ? 'border-[#B88719] bg-[#FFF9E8] shadow-xs'
                              : 'border-[#BFA66A]/20 bg-white hover:border-[#BFA66A]/40 hover:bg-[#FFFDF8]'
                          )}>
                          <div className="cursor-pointer" onClick={() => handleChunkChange(chunk)}>
                            <div className="flex justify-between items-center mb-1 text-[10px] font-mono">
                              <span className={chunk.id === selectedChunk?.id ? 'text-[#8A5A00] font-black animate-pulse' : 'text-slate-500'}>
                                {chunk.id}
                              </span>
                              <span className="text-[9px] text-slate-400">{chunk.versions.length}v</span>
                            </div>
                            <div className="text-xs text-[#111111] font-bold truncate group-hover:text-[#B88719] transition-colors uppercase tracking-tight">
                              {chunk.title}
                            </div>
                            <p className="text-[10px] text-slate-600 truncate mt-1">{chunk.text}</p>
                          </div>
                          {pendingDeleteChunk === chunk.id ? (
                            <div className="flex items-center gap-1 mt-2">
                              <button onClick={() => handleDeleteChunk(chunk.id)} className="flex-1 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wide cursor-pointer">Confirm Delete</button>
                              <button onClick={() => setPendingDeleteChunk(null)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black cursor-pointer">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setPendingDeleteChunk(chunk.id); }}
                              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RIGHT: chunk detail */}
                  {selectedChunk && selectedVersion ? (
                    <div className="flex-1 border border-[#BFA66A]/30 rounded-3xl bg-white flex flex-col overflow-hidden shadow-xs">

                      {/* Chunk header */}
                      <div className="px-6 pt-5 pb-4 border-b border-[#BFA66A]/20 shrink-0 flex justify-between items-center bg-[#FFFDF8]">
                        <div>
                          <span className="text-[10px] font-mono text-[#8A5A00] font-black">{selectedChunk.id} · Semantic Node</span>
                          <h3 className="text-base font-bold text-[#111111] font-display">{selectedChunk.title}</h3>
                        </div>
                        <span className="text-[9px] font-black uppercase text-[#B88719] bg-[#FFF9E9] border border-[#BFA66A]/30 px-2.5 py-1 rounded-lg">
                          Multi-Version Gold Layer
                        </span>
                      </div>

                      {/* Version tabs row */}
                      <div className="px-5 py-4 border-b border-slate-100 bg-[#FFFDF8]/40 shrink-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-black text-[#5A4209]/60 uppercase tracking-widest flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-[#B88719]" />
                            Select Revision Node
                          </span>
                          <button
                            onClick={() => setNewVerDrawerOpen(true)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#FFF9E8] border border-[#BFA66A]/40 hover:bg-[#B88719] hover:text-white text-[#8A5A00] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer">
                            <Plus className="w-3 h-3" />
                            New Version
                          </button>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-1.5 custom-scrollbar flex-nowrap">
                          {selectedChunk.versions.map(ver => (
                            <div key={ver.version_number}
                              className={cn(
                                'flex items-center gap-1 rounded-xl border transition-all shrink-0 shadow-2xs',
                                ver.version_number === selectedVersion.version_number
                                  ? 'border-[#B88719] bg-[#FFF9E8]'
                                  : 'border-[#BFA66A]/25 bg-white hover:border-[#BFA66A]/50 hover:bg-[#FCFBF7]'
                              )}>
                            <button onClick={() => setSelectedVersion(ver)}
                              className={cn(
                                'px-4 py-2.5 transition-all cursor-pointer text-left flex items-center gap-3 min-w-[130px]',
                                ver.version_number === selectedVersion.version_number ? 'text-[#111111]' : 'text-slate-700'
                              )}>
                              <div className={cn(
                                'w-6 h-6 rounded-lg flex items-center justify-center border',
                                ver.version_number === selectedVersion.version_number
                                  ? 'bg-[#B88719]/10 border-[#B88719]/20 text-[#8A5A00]'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                              )}>
                                <Clock className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div className="text-xs font-mono font-black">{ver.version_number}</div>
                                <span className={cn(
                                  'text-[8px] font-black uppercase px-1 rounded-sm tracking-wide mt-0.5 inline-block',
                                  ver.status === 'Active' ? 'text-green-800 bg-green-500/10' : 'text-slate-500 bg-slate-100'
                                )}>
                                  {ver.status}
                                </span>
                              </div>
                            </button>
                            {ver.status !== 'Active' && (
                              pendingDeleteVersion === ver.version_number ? (
                                <div className="flex gap-1 pr-2">
                                  <button onClick={() => handleDeleteVersion(ver.version_number)} className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[8px] font-black cursor-pointer">OK</button>
                                  <button onClick={() => setPendingDeleteVersion(null)} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[8px] font-black cursor-pointer">✕</button>
                                </div>
                              ) : (
                                <button onClick={() => setPendingDeleteVersion(ver.version_number)} className="pr-2 text-slate-300 hover:text-red-500 transition-colors cursor-pointer">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )
                            )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Version detail body */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                        {/* Revision parameters */}
                        <div className="bg-[#FFFDF8]/70 border border-[#BFA66A]/30 p-5 rounded-2xl shadow-2xs">
                          <h4 className="text-[9px] font-black text-[#5A4209]/80 uppercase tracking-widest flex items-center gap-1.5 border-b border-[#BFA66A]/20 pb-2.5 mb-4">
                            <Tag className="w-3.5 h-3.5 text-[#B88719]" />
                            Revision Parameters Matrix
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Version Name</span>
                              <span className="text-xs text-[#111111] font-mono font-black">{selectedVersion.version_number}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Time Registered</span>
                              <span className="text-xs text-slate-600 font-mono italic">{selectedVersion.create_at}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Retriever Status</span>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', selectedVersion.status === 'Active' ? 'bg-green-600' : 'bg-slate-400')} />
                                <span className={cn('text-xs font-mono font-black', selectedVersion.status === 'Active' ? 'text-green-700' : 'text-slate-500')}>
                                  {selectedVersion.status === 'Active' ? 'ACTIVE RETRIEVER' : 'STAGED RECORD'}
                                </span>
                                {selectedVersion.status === 'Inactive' && (
                                  <button
                                    onClick={() => activateVersion(selectedVersion)}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-[#FFF9E8] border border-[#B88719]/40 hover:bg-[#B88719] hover:text-white text-[#8A5A00] rounded-lg text-[9px] font-black uppercase tracking-wide transition-all cursor-pointer">
                                    <Zap className="w-2.5 h-2.5" />
                                    Set Active
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Embedding Model</span>
                              <span className="text-xs text-slate-600 font-mono truncate">{selectedVersion.embedding_models}</span>
                            </div>
                            {selectedVersion.entities.length > 0 && (
                              <div className="flex flex-col md:col-span-2 lg:col-span-3">
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">Identified Entities Map</span>
                                <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
                                  {selectedVersion.entities.map((ent, i) => (
                                    <span key={i} className="bg-white border border-[#BFA66A]/25 text-[#5A4209] text-[11px] font-mono px-3 py-1.5 rounded-xl shadow-2xs shrink-0">
                                      {ent}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {selectedVersion.intent && (
                              <div className="flex flex-col md:col-span-2 lg:col-span-3">
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">Retrieval Intent Word Map</span>
                                <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
                                  {selectedVersion.intent.split(/\s+/).map((w, i) => {
                                    const clean = w.replace(/[.,/#!$%^&*;:{}=\-_`~()"'?]/g, '').trim();
                                    return clean ? (
                                      <span key={i} className="bg-white border border-[#BFA66A]/25 text-[#8A5A00] text-[11px] font-mono px-3 py-1.5 rounded-xl shadow-2xs shrink-0">
                                        {clean}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Version text */}
                        <div className="p-6 bg-white border border-[#BFA66A]/30 rounded-2xl shadow-xs">
                          <span className="text-[9px] font-black text-[#5A4209]/70 uppercase tracking-widest block mb-3 border-b border-dashed border-[#BFA66A]/20 pb-1.5">
                            Version Text Data
                          </span>
                          <p className="text-[#2A2A2A] text-xs leading-relaxed font-mono whitespace-pre-wrap">{selectedVersion.text}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ════════════════ QDRANT TAB ════════════════ */}
      {activeTab === 'QDRANT' && (
        <>
          {/* ── Collection detail drawer ── */}
          <DetailDrawer
            isOpen={!!selectedCollection}
            onClose={() => { setSelectedCollection(null); setQdrantQuery(''); setQdrantPoints([]); }}
            title={selectedCollection?.name ?? ''}
            subtitle={`${selectedCollection?.id ?? ''} · ${selectedCollection?.embedding_model ?? ''}`}
            icon={Layers}
            size="xwide"
            persistKey="qdrant-collection-detail"
            fixedHeight
          >
            {selectedCollection && (
              <div className="flex h-full gap-0 divide-x divide-[#BFA66A]/15">

                {/* ── LEFT: Collection metadata ── */}
                <div className="w-[280px] shrink-0 p-5 space-y-5 overflow-y-auto">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#6B6B6B]">Collection Info</p>

                  {[
                    { label: 'Collection ID',    value: selectedCollection.id },
                    { label: 'Embedding Model',  value: selectedCollection.embedding_model ?? '—' },
                    { label: 'Dimensions',       value: String(selectedCollection.dimensions) },
                    { label: 'Distance Metric',  value: selectedCollection.distance },
                    { label: 'Vector Points',    value: selectedCollection.points.toLocaleString() },
                  ].map(row => (
                    <div key={row.label}>
                      <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{row.label}</span>
                      <span className="text-xs font-bold font-mono text-[#2A2A2A] break-all">{row.value}</span>
                    </div>
                  ))}

                  <div>
                    <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider block mb-1">Indexed</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', selectedCollection.indexed === 100 ? 'bg-green-500' : 'bg-[#B88719]')} style={{ width: `${selectedCollection.indexed}%` }} />
                      </div>
                      <span className="text-[10px] font-bold font-mono text-slate-600 shrink-0">{selectedCollection.indexed}%</span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2.5">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border',
                      selectedCollection.active
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-slate-100 border-slate-200 text-slate-500',
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', selectedCollection.active ? 'bg-green-500 animate-pulse' : 'bg-slate-400')} />
                      {selectedCollection.active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={handleToggleActive}
                      disabled={qdrantToggling}
                      className={cn(
                        'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                        selectedCollection.active
                          ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                          : 'bg-white border-green-300 text-green-700 hover:bg-green-50',
                      )}
                    >
                      {qdrantToggling
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <span className={cn('w-1.5 h-1.5 rounded-full', selectedCollection.active ? 'bg-red-500' : 'bg-green-500')} />}
                      {selectedCollection.active ? 'Set Inactive' : 'Set Active'}
                    </button>
                  </div>
                </div>

                {/* ── RIGHT: Natural-language search ── */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Query bar */}
                  <div className={cn('px-5 py-4 border-b border-[#BFA66A]/15 shrink-0', selectedCollection.active ? 'bg-[#FFFDF8]' : 'bg-slate-50')}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#6B6B6B] mb-2">Semantic Search · Top 5 Points</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={qdrantQuery}
                        onChange={e => selectedCollection.active && setQdrantQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && selectedCollection.active && handleQdrantSearch()}
                        placeholder={selectedCollection.active ? 'Ask a natural-language question…' : 'Collection is inactive — activate to query'}
                        disabled={!selectedCollection.active}
                        className={cn(
                          'flex-1 border rounded-xl px-4 py-2 text-xs font-mono placeholder-slate-400 focus:outline-none transition-all',
                          selectedCollection.active
                            ? 'bg-white border-[#BFA66A]/30 text-[#2A2A2A] focus:border-[#B88719]'
                            : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed',
                        )}
                      />
                      <button
                        onClick={handleQdrantSearch}
                        disabled={!selectedCollection.active || qdrantSearching || !qdrantQuery.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#B88719] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#8A5A00] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {qdrantSearching
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <SendHorizonal className="w-3.5 h-3.5" />}
                        Search
                      </button>
                    </div>
                  </div>

                  {/* Results */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {!selectedCollection.active && (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-slate-400">
                        <AlertCircle className="w-10 h-10 opacity-30" />
                        <p className="text-xs font-medium">This collection is inactive.<br />Set it to Active to enable querying.</p>
                      </div>
                    )}
                    {selectedCollection.active && qdrantPoints.length === 0 && !qdrantSearching && (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-slate-400">
                        <MessageSquare className="w-10 h-10 opacity-30" />
                        <p className="text-xs font-medium">Enter a query above to retrieve the top 5 matching points from this collection.</p>
                      </div>
                    )}
                    {selectedCollection.active && qdrantSearching && (
                      <div className="flex items-center justify-center h-full gap-2 text-[#B88719]">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-xs font-medium">Searching…</span>
                      </div>
                    )}
                    {selectedCollection.active && !qdrantSearching && qdrantPoints.map((pt, idx) => (
                      <div key={pt.point_id} className="border border-[#BFA66A]/20 rounded-2xl overflow-hidden bg-white">
                        {/* Point header */}
                        <div className="px-4 py-2.5 bg-[#FFFDF8] border-b border-[#BFA66A]/15 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#BFA66A]/15 text-[#B88719] text-[9px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-[#2A2A2A]">{pt.point_id}</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold text-slate-400">
                            score <span className="text-[#B88719]">{pt.score.toFixed(2)}</span>
                          </span>
                        </div>
                        {/* Point body */}
                        <div className="p-4 space-y-3">
                          {/* Summary */}
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <Hash className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Summary</span>
                            </div>
                            <p className="text-xs text-[#2A2A2A] leading-relaxed font-mono">{pt.summary}</p>
                          </div>
                          {/* Entities */}
                          <div>
                            <div className="flex items-center gap-1 mb-1.5">
                              <Cpu className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Entities</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {pt.entities.map(e => (
                                <span key={e} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-[10px] font-bold">{e}</span>
                              ))}
                            </div>
                          </div>
                          {/* Intent */}
                          <div>
                            <div className="flex items-center gap-1 mb-1.5">
                              <List className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Intent</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {pt.intent.map(i => (
                                <span key={i} className="px-2 py-0.5 bg-[#FFF9E8] border border-[#BFA66A]/40 text-[#8A5A00] rounded-full text-[10px] font-bold">{i}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </DetailDrawer>

          {/* ── Collection grid ── */}
          <div className="space-y-4">
            <p className="text-sm text-slate-500 font-medium">
              {qdrantCollections.filter(c => c.active).length} active · {qdrantCollections.length} total collections — click a card to inspect
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {qdrantCollections.map(col => (
                <button
                  key={col.id}
                  onClick={() => { setSelectedCollection(col); setQdrantQuery(''); setQdrantPoints([]); }}
                  className={cn(
                    'border rounded-3xl overflow-hidden transition-all text-left cursor-pointer group',
                    col.active
                      ? 'border-[#BFA66A]/30 bg-white shadow-[0_4px_24px_rgba(184,135,25,0.04)] hover:shadow-[0_6px_30px_rgba(184,135,25,0.10)] hover:border-[#BFA66A]/60'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300',
                  )}
                >
                  <div className={cn('px-5 py-4 border-b flex items-center justify-between', col.active ? 'bg-[#FFFDF8] border-[#BFA66A]/15' : 'bg-slate-50 border-slate-200')}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn('p-1.5 rounded-lg border shrink-0', col.active ? 'bg-[#FFF9E8] border-[#BFA66A]/40' : 'bg-white border-slate-200')}>
                        <Layers className={cn('w-4 h-4', col.active ? 'text-[#B88719]' : 'text-slate-400')} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold font-mono text-[#111111] truncate group-hover:text-[#B88719] transition-colors">{col.name}</h3>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{col.id}</p>
                      </div>
                    </div>
                    <span className={cn('shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border',
                      col.active ? 'bg-green-50 border-green-300 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-500')}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', col.active ? 'bg-green-500 animate-pulse' : 'bg-slate-400')} />
                      {col.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-5">
                    <div>
                      <span className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Vector Points</span>
                      <span className="text-2xl font-bold font-mono text-[#111111]">{col.points.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Dimensions</span>
                      <span className="text-2xl font-bold font-mono text-[#111111]">{col.dimensions}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Embedding Model</span>
                      <span className="text-[10px] font-bold font-mono text-slate-600">{col.embedding_model ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider block mb-1">Indexed</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', col.indexed === 100 ? 'bg-green-500' : 'bg-[#B88719]')} style={{ width: `${col.indexed}%` }} />
                        </div>
                        <span className="text-[10px] font-bold font-mono text-slate-600 shrink-0">{col.indexed}%</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ════════════════ NEO4J TAB ════════════════ */}
      {activeTab === 'NEO4J' && (
        <div className="flex gap-5" style={{ height: 580 }}>

          {/* ── LEFT: Query Builder ── */}
          <div className="w-[340px] shrink-0 border border-[#BFA66A]/25 rounded-3xl overflow-hidden bg-white shadow-sm flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 bg-[#FFFDF8] border-b border-[#BFA66A]/15 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#FFF9E8] border border-[#BFA66A]/40 rounded-lg">
                  <Code className="w-4 h-4 text-[#B88719]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-[#2A2A2A]">Query Builder</h3>
                  <p className="text-[10px] text-slate-500">Generates Cypher path</p>
                </div>
              </div>
              <button onClick={() => { setCypher(buildCypher(startNode, steps)); setQueryRan(true); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#B88719] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#8A5A00] transition-all cursor-pointer">
                <Play className="w-3.5 h-3.5" />
                Run
              </button>
            </div>

            {/* Builder steps */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {/* Start node — always present */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#FFF9E8] border-2 border-[#B88719] rounded-xl">
                <Circle className="w-3.5 h-3.5 text-[#B88719] shrink-0" />
                <select value={startNode} onChange={e => { setStartNode(e.target.value); setQueryRan(false); }}
                  className="bg-transparent text-xs font-bold text-[#8A5A00] focus:outline-none cursor-pointer flex-1">
                  {AVAILABLE_NODES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-[9px] font-mono text-[#8A5A00]/50 uppercase tracking-wider shrink-0">start</span>
              </div>

              {/* Step rows — vertical */}
              {steps.map(step => (
                <div key={step.id} className="ml-3 border-l-2 border-[#BFA66A]/30 pl-3 space-y-1.5">
                  {/* Relationship */}
                  <div className="flex items-center gap-1.5">
                    <ArrowDown className="w-3 h-3 text-slate-300 shrink-0" />
                    <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex-1 min-w-0">
                      <span className="text-[9px] font-mono text-slate-400 shrink-0">[</span>
                      <select value={step.relationship} onChange={e => updateStep(step.id, 'relationship', e.target.value)}
                        className="bg-transparent text-[11px] font-bold text-slate-700 font-mono focus:outline-none cursor-pointer flex-1 min-w-0">
                        {AVAILABLE_RELS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className="text-[9px] font-mono text-slate-400 shrink-0">]</span>
                    </div>
                  </div>
                  {/* Target node + delete */}
                  <div className="flex items-center gap-1.5 ml-4">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F0E8] border border-[#BFA66A]/40 rounded-xl flex-1 min-w-0">
                      <Circle className="w-2.5 h-2.5 text-[#B88719] shrink-0" />
                      <select value={step.nodeType} onChange={e => updateStep(step.id, 'nodeType', e.target.value)}
                        className="bg-transparent text-[11px] font-bold text-[#8A5A00] focus:outline-none cursor-pointer flex-1 min-w-0">
                        {AVAILABLE_NODES.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <button onClick={() => deleteStep(step.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-100 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Step */}
              <button onClick={addStep}
                className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-[#BFA66A]/50 hover:border-[#B88719] hover:bg-[#FFF9E8] text-slate-400 hover:text-[#8A5A00] rounded-xl text-[11px] font-bold transition-all cursor-pointer mt-1">
                <Plus className="w-3 h-3" />
                Add Step
              </button>

              {/* Generated Cypher */}
              {queryRan && cypher && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#8A5A00] font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    Generated Cypher
                  </span>
                  <pre className="bg-[#0D0D0B] text-green-400 text-[10px] font-mono p-3 rounded-xl overflow-x-auto leading-relaxed border border-[#BFA66A]/20 whitespace-pre-wrap break-all">{cypher}</pre>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Graph Canvas ── */}
          <div className="flex-1 rounded-3xl relative overflow-hidden bg-[#0A0909] border border-white/6">
            <div className="absolute top-5 left-5 flex flex-col gap-1.5 z-10">
              {['+','–','⊡'].map((s,i) => (
                <button key={i} className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-slate-400 text-sm flex items-center justify-center font-mono">{s}</button>
              ))}
            </div>
            <div className="absolute top-5 right-5 z-10">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B88719]/10 border border-[#B88719]/20 text-[#B88719] rounded-full text-[9px] font-black uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-[#B88719] rounded-full animate-pulse" />
                Force Layout Active
              </span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg viewBox="0 0 900 560" className="w-full h-full px-10 py-6">
                <defs>
                  <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#B88719" stopOpacity="0.55" /><stop offset="100%" stopColor="#B88719" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="subGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#8A5A00" stopOpacity="0.35" /><stop offset="100%" stopColor="#8A5A00" stopOpacity="0" />
                  </radialGradient>
                  <marker id="arrow" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                    <polygon points="0 0, 7 2.5, 0 5" fill="rgba(184,135,25,0.35)" />
                  </marker>
                </defs>
                {FALLBACK_EDGES.map((e,i) => (
                  <motion.line key={`e-${i}`} x1={e[0]} y1={e[1]} x2={e[2]} y2={e[3]} stroke="rgba(184,135,25,0.22)" strokeWidth="1.5" markerEnd="url(#arrow)"
                    initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.12,duration:0.5}} />
                ))}
                {FALLBACK_REL_LABELS.map(([x,y,label],i) => (
                  <motion.text key={`rl-${i}`} x={x} y={y} textAnchor="middle" fill="rgba(184,135,25,0.5)" fontSize="8" fontFamily="monospace" fontWeight="bold"
                    initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.2+i*0.08}}>{label}</motion.text>
                ))}
                {FALLBACK_NODES.map((node,i) => (
                  <motion.g key={node.label} initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{delay:i*0.1,type:'spring',stiffness:200,damping:18}}>
                    <circle cx={node.x} cy={node.y} r={node.r*3.8} fill={node.core ? 'url(#coreGlow)' : 'url(#subGlow)'} />
                    <circle cx={node.x} cy={node.y} r={node.r} fill={node.core ? '#B88719' : '#6B4400'} stroke={node.core ? 'rgba(255,220,120,0.4)' : 'rgba(184,135,25,0.25)'} strokeWidth="1.5" />
                    <text x={node.x} y={node.y+node.r+13} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="monospace" fontWeight="bold">{node.label}</text>
                  </motion.g>
                ))}
              </svg>
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl flex gap-2 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <input className="flex-1 bg-transparent px-4 py-2 text-xs text-white/70 focus:outline-none placeholder:text-white/20"
                  placeholder="Ask the Graph: 'How does Organization relate to Policy...'" />
                <button className="bg-[#B88719] p-2 rounded-xl text-white hover:bg-[#8A5A00] transition-all">
                  <Zap className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
