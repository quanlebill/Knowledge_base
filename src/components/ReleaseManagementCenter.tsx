import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, GitBranch, ShieldCheck, History, Search, Filter, Plus, Ship, Rocket, RefreshCcw, AlertTriangle, Package, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';
import { DeploymentOverview as DeploymentCenter } from './DeploymentCenter/Overview';
import { DetailDrawer } from './shared/DetailDrawer';

import { useAppState } from '../AppStateContext';
import { Placeholder } from './shared/Placeholder';

type ReleaseSubTab = 'OVERVIEW' | 'PIPELINE' | 'PACKAGE' | 'ENV' | 'VALIDATION' | 'ROLLBACK' | 'HISTORY' | 'DRIFT';

const ReleaseManagementCenter = () => {
  const { subTab, setSubTab } = useAppState();
  const activeSubTab = (subTab['release-management'] as ReleaseSubTab) ?? 'PIPELINE';
  const setActiveSubTab = (id: ReleaseSubTab) => setSubTab('release-management', id);

  /* PACKAGE & DRIFT secondary-nav items drive the drawers */
  const showPackageBuilder = activeSubTab === 'PACKAGE';
  const showDriftManager   = activeSubTab === 'DRIFT';
  const setShowPackageBuilder = (v: boolean) => setActiveSubTab(v ? 'PACKAGE' : 'PIPELINE');
  const setShowDriftManager   = (v: boolean) => setActiveSubTab(v ? 'DRIFT' : 'PIPELINE');

  const mainMetrics = [
    { label: 'Active Pipelines', value: '18', trend: 'OPTIMAL', trendType: 'NEUTRAL' as const, icon: Rocket, color: 'brand' as const },
    { label: 'Last Release', value: '14m ago', icon: History, color: 'blue' as const },
    { label: 'Validation Score', value: '98%', trend: '+2%', trendType: 'UP' as const, icon: ShieldCheck, color: 'emerald' as const },
    { label: 'Open Drift Alerts', value: '0', trend: 'SECURE', trendType: 'NEUTRAL' as const, icon: AlertTriangle, color: 'amber' as const },
  ];

  const subTabs = [
    { id: 'OVERVIEW',   label: 'Overview',     icon: GitBranch },
    { id: 'PIPELINE',   label: 'Pipeline',     icon: Rocket },
    { id: 'PACKAGE',    label: 'Package',      icon: Package },
    { id: 'ENV',        label: 'Environments', icon: Settings2 },
    { id: 'VALIDATION', label: 'Validation',   icon: ShieldCheck },
    { id: 'ROLLBACK',   label: 'Rollback',     icon: RefreshCcw },
    { id: 'HISTORY',    label: 'History',      icon: History },
    { id: 'DRIFT',      label: 'Drift',        icon: AlertTriangle },
  ];

  return (
    <div className="space-y-8">
      <DetailDrawer
        isOpen={showPackageBuilder}
        onClose={() => setShowPackageBuilder(false)}
        title="Deployment Package Builder"
        subtitle="Bundle Agent Configs, KB Snapshots & Workflow Logic"
        icon={Package}
        size="lg"
      >
        <div className="p-8 space-y-8">
           <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Select Baseline Artifacts</h4>
              <div className="space-y-3">
                 {['GlobalCorp_Agent_v2.4', 'refund_policy_gold_index', 'onboarding_workflow_final'].map(a => (
                   <div key={a} className="flex justify-between items-center px-4 py-3 bg-white/5 rounded-xl border border-white/5 hover:border-brand-500/30 cursor-pointer transition-all">
                      <span className="text-xs text-white">{a}</span>
                      <Plus className="w-4 h-4 text-slate-600" />
                   </div>
                 ))}
              </div>
           </div>
           <div className="p-6 bg-brand-500/10 border border-brand-500/20 rounded-2xl">
              <h4 className="text-xs font-black uppercase tracking-widest text-brand-400 mb-4">Validation Pipeline</h4>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Automatic Red-Teaming will begin upon package assembly.</p>
           </div>
        </div>
      </DetailDrawer>

      <DetailDrawer
        isOpen={showDriftManager}
        onClose={() => setShowDriftManager(false)}
        title="Environment Alignment"
        subtitle="Reconcile Configuration Discrepancies across Infrastructure"
        icon={Settings2}
        size="lg"
      >
        <div className="p-8">
           <div className="space-y-6">
              {[
                { key: 'MODEL_TEMP', prod: '0.7', uat: '0.8', status: 'MISMATCH' },
                { key: 'EMBED_DIM', prod: '1536', uat: '1536', status: 'MATCH' },
                { key: 'MAX_TOKENS', prod: '4096', uat: '1024', status: 'CRITICAL_DRIFT' },
              ].map(drift => (
                <div key={drift.key} className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                   <div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{drift.key}</div>
                      <div className="flex gap-4 mt-2 text-xs">
                         <span className="text-slate-600">PROD: <span className="text-white">{drift.prod}</span></span>
                         <span className="text-slate-600">UAT: <span className="text-white">{drift.uat}</span></span>
                      </div>
                   </div>
                   <div className={cn(
                     "px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest",
                     drift.status === 'MATCH' ? 'bg-green-500/10 text-green-500' : 
                     drift.status === 'MISMATCH' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                   )}>{drift.status}</div>
                </div>
              ))}
           </div>
        </div>
      </DetailDrawer>

      <OperationalHeader 
        title="Release Management"
        subtitle="Continuous Deployment, Model Versioning & Automated Model Promotion"
        breadcrumbs={[{ label: 'Release' }, { label: 'Management' }]}
        status={<StatusBadge status="STABLE" size="lg" />}
        actions={
          <div className="flex gap-3">
              <button
                onClick={() => setShowPackageBuilder(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                CREATE RELEASE
              </button>
          </div>
        }
      />

      <StandardMetricsGrid metrics={mainMetrics} />

      {/* Sub-Navigation */}
      <div className="sub-tab-bar max-w-full">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn('sub-tab', activeSubTab === tab.id && 'active')}
          >
            <tab.icon className="tab-icon w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {(activeSubTab === 'OVERVIEW' || activeSubTab === 'PIPELINE') && (
          <DeploymentCenter
            onNewDeployment={() => setShowPackageBuilder(true)}
            onOpenApprovals={() => {}}
            onOpenDrift={() => setShowDriftManager(true)}
          />
        )}
        {activeSubTab === 'ENV' && (
          <Placeholder
            title="Environment Management"
            icon={Settings2}
            description="Configure Dev, UAT, Staging, and Production environments. Manage secrets, AI provider keys, autoscaling, and infra-level overrides per environment."
            plannedFeatures={[
              'Per-environment configuration matrix',
              'Environment promotion gates',
              'Resource quota management',
              'Per-environment AI provider rotation',
            ]}
          />
        )}
        {activeSubTab === 'VALIDATION' && (
          <Placeholder
            title="Validation Center"
            icon={ShieldCheck}
            description="Automatic QA, security scans, and red-teaming for every AI release before it reaches production."
            plannedFeatures={[
              'Automated regression suite per release',
              'Red-team prompt-injection battery',
              'Hallucination & grounding score gates',
              'Performance & cost regression checks',
            ]}
          />
        )}
        {activeSubTab === 'ROLLBACK' && (
          <Placeholder
            title="Rollback Center"
            icon={RefreshCcw}
            description="Immutable history of releases and one-click restoration of semantic states across the fleet."
            plannedFeatures={[
              'One-click rollback to any tagged release',
              'Partial rollback per agent / per workflow',
              'Rollback impact preview',
              'Auto-rollback on anomaly detection',
            ]}
          />
        )}
        {activeSubTab === 'HISTORY' && (
          <Placeholder
            title="Release History"
            icon={History}
            description="Audited timeline of every deployment, validation result, and rollback across every environment."
            plannedFeatures={[
              'Filterable release timeline',
              'Side-by-side release diff',
              'Validation report attachments',
              'Compliance-ready audit export',
            ]}
          />
        )}
        {activeSubTab === 'DRIFT' && (
          <Placeholder
            title="Environment Drift Detection"
            icon={AlertTriangle}
            description="Identify configuration discrepancies between Local, Staging, and Production AI environments before they cause incidents."
            plannedFeatures={[
              'Real-time drift scoring across envs',
              'Drift remediation playbooks',
              'Automatic alignment proposals',
              'Drift policy enforcement',
            ]}
          />
        )}
      </motion.div>
    </div>
  );
};

export default ReleaseManagementCenter;
