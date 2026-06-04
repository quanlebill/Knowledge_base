export type SourceFilter = 'ALL' | 'DOC' | 'MEDIA' | 'WEB' | 'WAREHOUSE';

export const SOURCE_FILTER_LABELS: Record<SourceFilter, string> = {
  ALL: 'All',
  DOC: 'Doc',
  MEDIA: 'Media',
  WEB: 'Web',
  WAREHOUSE: 'Warehouse',
};

export const getSourceCategory = (type: string | undefined): SourceFilter => {
  if (!type) return 'DOC';
  if (type.startsWith('Doc/')) return 'DOC';
  if (type.startsWith('Video/') || type.startsWith('Image/')) return 'MEDIA';
  if (type.toLowerCase() === 'web') return 'WEB';
  if (type.startsWith('Warehouse/')) return 'WAREHOUSE';
  return 'DOC';
};

export interface ChunkVersion {
  version_number: string;
  create_at: string;
  status: string;
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

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface DocTable {
  id: string;
  name: string;
  description: string;
  columns: TableColumn[];
  rows: Record<string, string | null>[];
}

export interface WarehouseConfigTable {
  name: string;
  schema: string;
  rowCount?: string;
  description: string;
}

export interface WarehouseConfigVersion {
  id: string;
  version_number: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  connection: Record<string, string>;
  tables: WarehouseConfigTable[];
}

export const MOCK_DISCOVERY: Record<string, Omit<WarehouseConfigTable, 'description'>[]> = {
  snowflake: [
    { name: 'ORDERS',       schema: 'PUBLIC',  rowCount: '142,000'    },
    { name: 'PRODUCTS',     schema: 'PUBLIC',  rowCount: '8,500'      },
    { name: 'CUSTOMERS',    schema: 'PUBLIC',  rowCount: '45,000'     },
    { name: 'INVENTORY',    schema: 'PUBLIC',  rowCount: '23,100'     },
    { name: 'TRANSACTIONS', schema: 'FINANCE', rowCount: '890,000'    },
  ],
  databricks: [
    { name: 'user_embeddings', schema: 'feature_store', rowCount: '900,000'    },
    { name: 'item_features',   schema: 'feature_store', rowCount: '25,000'     },
    { name: 'training_logs',   schema: 'ml_ops',        rowCount: '45,600'     },
    { name: 'model_registry',  schema: 'ml_ops',        rowCount: '340'        },
    { name: 'raw_events',      schema: 'bronze',        rowCount: '12,400,000' },
  ],
};
