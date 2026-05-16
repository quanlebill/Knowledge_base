export type Role = 'PLATFORM_ADMIN' | 'AI_ENGINEER' | 'BUSINESS_OPERATOR' | 'EXECUTIVE';
export type Industry = 'GENERAL' | 'GOVERNMENT' | 'BANKING' | 'RAILWAY' | 'HEALTHCARE';
export type Environment = 'DEV' | 'UAT' | 'STAGING' | 'PROD';

export type KnowledgeLayer = 'BRONZE' | 'SILVER' | 'GOLD';
export type DocStatus = 
  | 'RAW' 
  | 'OCR_COMPLETE' 
  | 'CLEANED'
  | 'CHUNKING' 
  | 'EMBEDDING' 
  | 'GRAPH_EXTRACTING' 
  | 'PUBLISHED' 
  | 'FAILED'
  | 'DEPRECATED'
  | 'ARCHIVED'
  | 'PENDING_APPROVAL';

export type ConnectorStatus = 'HEALTHY' | 'SYNCING' | 'ERROR' | 'PAUSED';
export type ConnectorType = 'DOCUMENT' | 'ENTERPRISE' | 'COMMUNICATION' | 'DATABASE' | 'WEB' | 'MEDIA';

export interface KBConnector {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  lastSync: string;
  volume: string;
  health: number; // 0-100
  category: string;
}

export interface TenantContext {
  organization: string;
  workspace: string;
  project: string;
  environment: Environment;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  layer: KnowledgeLayer;
  status: DocStatus;
  version: string;
  lastUpdated: string;
  author: string;
  metadata: Record<string, any>;
  score?: number;
  conflicts?: boolean;
}

export interface IngestionJob {
  id: string;
  name: string;
  startTime: string;
  progress: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'QUEUED';
  type: 'EMBEDDING' | 'OCR' | 'GRAPH_SYNC' | 'CONNECTOR_SYNC';
  priority: 'HIGH' | 'NORMAL' | 'LOW';
}

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  roles: Role[];
  industry?: Industry;
}
