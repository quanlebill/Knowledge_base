import React from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Bot, 
  Activity, 
  ShieldCheck, 
  Settings, 
  Terminal, 
  History as HistoryIcon, 
  Users, 
  Briefcase,
  Layers,
  Search,
  Grid3X3,
  Bell,
  Cpu,
  BarChart3,
  Zap,
  Globe,
  Stethoscope,
  TrainFront,
  Building2,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { Role, Industry, NavItem } from './types';

export const NAV_ITEMS: NavItem[] = [
  // Core Modules
  { id: 'dashboard', label: 'Executive Pulse', icon: LayoutDashboard, roles: ['EXECUTIVE', 'PLATFORM_ADMIN'] },
  { id: 'knowledge-ops', label: 'Knowledge Operations', icon: Database, roles: ['PLATFORM_ADMIN', 'AI_ENGINEER'] },
  { id: 'ai-runtime', label: 'AI Runtime', icon: Bot, roles: ['AI_ENGINEER', 'PLATFORM_ADMIN', 'BUSINESS_OPERATOR'] },
  { id: 'operations-center', label: 'Operations Center', icon: Activity, roles: ['PLATFORM_ADMIN', 'AI_ENGINEER'] },
  { id: 'release-management', label: 'Release Management', icon: Zap, roles: ['AI_ENGINEER', 'PLATFORM_ADMIN'] },
  { id: 'governance', label: 'Governance & Audit', icon: ShieldCheck, roles: ['PLATFORM_ADMIN', 'EXECUTIVE'] },
  
  // Industry Specific
  { id: 'national-ops', label: 'National Ops', icon: Globe, roles: ['EXECUTIVE', 'PLATFORM_ADMIN'], industry: 'GOVERNMENT' },

  // System
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['PLATFORM_ADMIN', 'AI_ENGINEER', 'BUSINESS_OPERATOR', 'EXECUTIVE'] },
];

export const INDUSTRIES = [
  { id: 'GENERAL', label: 'Cross-Industry', icon: Grid3X3 },
  { id: 'GOVERNMENT', label: 'Gov & Public', icon: Building2 },
  { id: 'BANKING', label: 'Financial Services', icon: Lock },
  { id: 'RAILWAY', label: 'Railway & Metro', icon: TrainFront },
  { id: 'HEALTHCARE', label: 'Medical & Health', icon: Stethoscope },
];

export const ROLES = [
  { id: 'PLATFORM_ADMIN', label: 'Platform Admin' },
  { id: 'AI_ENGINEER', label: 'AI Engineer' },
  { id: 'BUSINESS_OPERATOR', label: 'Business Operator' },
  { id: 'EXECUTIVE', label: 'Executive' },
];

export const ENVIRONMENTS: { id: string }[] = [
  { id: 'DEV' },
  { id: 'UAT' },
  { id: 'STAGING' },
  { id: 'PROD' },
];
