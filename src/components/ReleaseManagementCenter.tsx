import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, GitBranch, ShieldCheck, History, Search, Filter, Plus, Ship, Rocket, RefreshCcw, AlertTriangle, Package, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';
import { DeploymentOverview as DeploymentCenter } from './DeploymentCenter/Overview';
import { DetailDrawer } from './shared/DetailDrawer';

const ReleaseManagementCenter = () => {
  const [activeSubTab, setActiveSubTab] = useState<'PIPELINE' | 'VALIDATION' | 'ROLLBACK' | 'DRIFT'>('PIPELINE');
  const [showPackageBuilder, setShowPackageBuilder] = useState(false);
  const [showDriftManager, setShowDriftManager] = useState(false);

  const mainMetrics = [
    { label: 'Active Pipelines', value: '18', trend: 'OPTIMAL', trendType: 'NEUTRAL' as const, icon: Rocket, color: 'brand' as const },
    { label: 'Last Release', value: '14m ago', icon: History, color: 'blue' as const },
    { label: 'Validation Score', value: '98%', trend: '+2%', trendType: 'UP' as const, icon: ShieldCheck, color: 'emerald' as const },
    { label: 'Open Drift Alerts', value: '0', trend: 'SECURE', trendType: 'NEUTRAL' as const, icon: AlertTriangle, color: 'amber' as const },
  ];

  const subTabs = [
    { id: 'PIPELINE', label: 'Release Pipeline', icon: Rocket },
    { id: 'VALIDATION', label: 'Validation Center', icon: ShieldCheck },
    { id: 'ROLLBACK', label: 'Rollback Ledger', icon: RefreshCcw },
    { id: 'DRIFT', label: 'Environment Drift', icon: AlertTriangle },
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
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                CREATE RELEASE
              </button>
          </div>
        }
      />

      <StandardMetricsGrid metrics={mainMetrics} />

      {/* Sub-Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-[24px] w-full lg:w-fit overflow-x-auto no-scrollbar shadow-inner">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative shrink-0",
              activeSubTab === tab.id 
                ? "bg-white/10 text-white shadow-xl italic" 
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeSubTab === tab.id ? "text-brand-400" : "text-slate-500")} />
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
        {activeSubTab === 'PIPELINE' && (
          <DeploymentCenter 
            onNewDeployment={() => setShowPackageBuilder(true)} 
            onOpenApprovals={() => {}} 
            onOpenDrift={() => setShowDriftManager(true)} 
          />
        )}
        {activeSubTab === 'VALIDATION' && (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[40px] border-dashed">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase italic">Validation Center</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Automatic QA, security scans, and Red-Teaming for every AI release</p>
            </div>
          </div>
        )}
        {activeSubTab === 'ROLLBACK' && (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[40px] border-dashed">
            <div className="w-16 h-16 rounded-full bg-slate-500/10 flex items-center justify-center border border-white/5">
              <RefreshCcw className="w-8 h-8 text-slate-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase italic">Rollback Ledger</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Immutable history of releases and one-click restoration of semantic states</p>
            </div>
          </div>
        )}
        {activeSubTab === 'DRIFT' && (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[40px] border-dashed">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase italic">Environment Drift Detection</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Identify discrepancies between Local, Staging, and Production AI configurations</p>
              <button 
                onClick={() => setShowDriftManager(true)}
                className="mt-6 px-6 py-2 bg-brand-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all"
              >
                Sync Environments
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ReleaseManagementCenter;
