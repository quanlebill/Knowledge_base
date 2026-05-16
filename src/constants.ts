import React from 'react';
import {
  LayoutDashboard,
  Database,
  Bot,
  Activity,
  ShieldCheck,
  Settings,
  Globe,
  Stethoscope,
  TrainFront,
  Building2,
  Lock,
  Network,
  Layers,
  BarChart3,
  Server,
  Zap,
  History,
  FileText,
  Scale,
  Fingerprint,
  Sparkles,
  Hash,
  ShieldAlert,
  Rocket,
  AlertTriangle,
  RefreshCcw,
  Cpu,
  LayoutGrid,
  Users,
} from 'lucide-react';
import { Role, Industry, NavItem } from './types';

export const NAV_ITEMS: NavItem[] = [
  // Core Modules
  { id: 'dashboard',          label: 'Executive Pulse',      icon: LayoutDashboard, roles: ['EXECUTIVE', 'PLATFORM_ADMIN'] },
  { id: 'knowledge-ops',      label: 'Knowledge Operations', icon: Database,        roles: ['PLATFORM_ADMIN', 'AI_ENGINEER'] },
  { id: 'ai-runtime',         label: 'AI Runtime',           icon: Bot,             roles: ['AI_ENGINEER', 'PLATFORM_ADMIN', 'BUSINESS_OPERATOR'] },
  { id: 'operations-center',  label: 'Operations Center',    icon: Activity,        roles: ['PLATFORM_ADMIN', 'AI_ENGINEER'] },
  { id: 'release-management', label: 'Release Management',   icon: Zap,             roles: ['AI_ENGINEER', 'PLATFORM_ADMIN'] },
  { id: 'governance',         label: 'Governance & Audit',   icon: ShieldCheck,     roles: ['PLATFORM_ADMIN', 'EXECUTIVE'] },

  // Industry Specific
  { id: 'national-ops', label: 'National Ops', icon: Globe, roles: ['EXECUTIVE', 'PLATFORM_ADMIN'], industry: 'GOVERNMENT' },

  // System
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['PLATFORM_ADMIN', 'AI_ENGINEER', 'BUSINESS_OPERATOR', 'EXECUTIVE'] },
];

/* Contextual sub-nav items shown in the secondary panel per module */
export const MODULE_SUB_ITEMS: Record<string, { id: string; label: string; icon: any; badge?: number }[]> = {
  'dashboard': [],

  'knowledge-ops': [
    { id: 'FLEET',      label: 'Fleet Overview',   icon: Database },
    { id: 'CONNECTORS', label: 'Connectors',        icon: Globe },
    { id: 'INVENTORY',  label: 'Data Layers',       icon: Layers },
    { id: 'PIPELINES',  label: 'Pipeline Ops',      icon: Activity },
    { id: 'CONFLICTS',  label: 'Conflicts',         icon: ShieldAlert, badge: 12 },
    { id: 'GRAPH',      label: 'Knowledge Graph',   icon: Network },
    { id: 'PLAYGROUND', label: 'Playground',        icon: Sparkles },
    { id: 'EMBEDDINGS', label: 'Embeddings',        icon: Hash },
    { id: 'GOVERNANCE', label: 'Governance',        icon: ShieldCheck },
  ],

  'ai-runtime': [
    { id: 'AGENTS',    label: 'Agent Registry',    icon: Bot },
    { id: 'WORKFLOWS', label: 'Workflow Engine',   icon: Layers },
    { id: 'TRACES',    label: 'Execution Traces',  icon: History },
  ],

  'operations-center': [
    { id: 'HEALTH',        label: 'Platform Health',  icon: Activity },
    { id: 'OBSERVABILITY', label: 'Metric Explorer',  icon: BarChart3 },
    { id: 'FLEET',         label: 'Worker Fleet',     icon: Server },
    { id: 'JOBS',          label: 'Migration Jobs',   icon: Zap },
  ],

  'release-management': [
    { id: 'PIPELINE',   label: 'Release Pipeline',    icon: Rocket },
    { id: 'VALIDATION', label: 'Validation Center',   icon: ShieldCheck },
    { id: 'ROLLBACK',   label: 'Rollback Ledger',     icon: RefreshCcw },
    { id: 'DRIFT',      label: 'Environment Drift',   icon: AlertTriangle },
  ],

  'governance': [
    { id: 'GOVERNANCE',  label: 'Policy Control',       icon: ShieldCheck },
    { id: 'AUDIT',       label: 'System Audit',         icon: History },
    { id: 'SECURITY',    label: 'Security Intelligence', icon: Fingerprint },
    { id: 'COMPLIANCE',  label: 'Compliance Reports',   icon: FileText },
  ],

  'national-ops': [],

  'settings': [
    { id: 'OVERVIEW',      label: 'Overview',         icon: LayoutGrid },
    { id: 'ORGANIZATION',  label: 'Organization',     icon: Building2 },
    { id: 'AUTH',          label: 'Auth & SSO',       icon: Lock },
    { id: 'IAM',           label: 'Access Control',   icon: Users },
    { id: 'API',           label: 'API Keys',         icon: Cpu },
    { id: 'BILLING',       label: 'Billing & Quotas', icon: Scale },
  ],
};

export const INDUSTRIES = [
  { id: 'GENERAL',    label: 'Cross-Industry',   icon: LayoutGrid },
  { id: 'GOVERNMENT', label: 'Gov & Public',     icon: Building2 },
  { id: 'BANKING',    label: 'Financial Services', icon: Lock },
  { id: 'RAILWAY',    label: 'Railway & Metro',  icon: TrainFront },
  { id: 'HEALTHCARE', label: 'Medical & Health', icon: Stethoscope },
];

export const ROLES = [
  { id: 'PLATFORM_ADMIN',   label: 'Platform Admin' },
  { id: 'AI_ENGINEER',      label: 'AI Engineer' },
  { id: 'BUSINESS_OPERATOR', label: 'Business Operator' },
  { id: 'EXECUTIVE',        label: 'Executive' },
];

export const ENVIRONMENTS: { id: string }[] = [
  { id: 'DEV' },
  { id: 'UAT' },
  { id: 'STAGING' },
  { id: 'PROD' },
];
