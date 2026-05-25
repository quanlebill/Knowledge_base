import { 
  Rocket, 
  Activity, 
  ShieldCheck, 
  Clock, 
  GitPullRequest, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Server, 
  Cloud, 
  Layers, 
  FileCode, 
  Lock, 
  Zap, 
  Search, 
  Bot, 
  Database, 
  Wrench, 
  Terminal, 
  History as HistoryIcon, 
  Settings,
  MoreVertical,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';

export type DeploymentStatus = 'QUEUED' | 'BUILDING' | 'VALIDATING' | 'TESTING' | 'WAITING_APPROVAL' | 'PROMOTING' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
export type Environment = 'DEV' | 'SIT' | 'UAT' | 'STAGING' | 'PROD';
export type DeploymentType = 'AGENT' | 'KB' | 'SOLUTION' | 'TOOL' | 'CONFIG' | 'POLICY';

export interface DeploymentRecord {
  id: string;
  name: string;
  type: DeploymentType;
  env: Environment;
  status: DeploymentStatus;
  version: string;
  startedAt: string;
  duration: string;
  owner: string;
  approver?: string;
  affectedAgents: string[];
  affectedKBs: string[];
  riskScore: number;
  drifts?: string[];
}

export interface EnvironmentState {
  name: Environment;
  status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
  agentCount: number;
  kbCount: number;
  lastDeployment: string;
  runtimeVersion: string;
  healthScore: number;
  driftCount: number;
}
