import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Activity, BarChart3, Cpu, Server, Play, Search, Filter, Plus, ShieldCheck, Zap, Globe, Gauge } from 'lucide-react';
import { cn } from '../lib/utils';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';
import { AIOpsCenter } from './AIOpsCenter';
import { ObservabilityView } from './ObservabilityView';

const OperationsCenter = () => {
  const [activeSubTab, setActiveSubTab] = useState<'HEALTH' | 'OBSERVABILITY' | 'FLEET' | 'JOBS'>('HEALTH');

  const mainMetrics = [
    { label: 'System Health', value: '99.9%', trend: 'STABLE', trendType: 'NEUTRAL' as const, icon: Activity, color: 'emerald' as const },
    { label: 'Ingestion Thru', value: '84GB/s', trend: '+14%', trendType: 'UP' as const, icon: Gauge, color: 'blue' as const },
    { label: 'Worker Fleet', value: '428', trend: 'AUTOSCALING', trendType: 'UP' as const, icon: Server, color: 'brand' as const },
    { label: 'Resource Efficiency', value: '78%', trend: '-2%', trendType: 'DOWN' as const, icon: Cpu, color: 'amber' as const },
  ];

  const subTabs = [
    { id: 'HEALTH', label: 'Platform Health', icon: Activity },
    { id: 'OBSERVABILITY', label: 'Metric Explorer', icon: BarChart3 },
    { id: 'FLEET', label: 'Worker Fleet', icon: Server },
    { id: 'JOBS', label: 'Migration Jobs', icon: Zap },
  ];

  return (
    <div className="space-y-8">
      <OperationalHeader 
        title="Operations Center"
        subtitle="Real-time Platform Health, Resource Observability & Infrastructure Control"
        breadcrumbs={[{ label: 'Operations' }, { label: 'Center' }]}
        status={<StatusBadge status="STABLE" size="lg" />}
        actions={
          <div className="flex gap-3">
             <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5">
                <Globe className="w-4 h-4" />
                REGION: US-EAST-1
              </button>
              <button className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-95">
                <Play className="w-4 h-4" />
                TRIGGER DRIFT CHECK
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
        {activeSubTab === 'HEALTH' && <AIOpsCenter />}
        {activeSubTab === 'OBSERVABILITY' && <ObservabilityView />}
        {activeSubTab === 'FLEET' && (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[40px] border-dashed">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Server className="w-8 h-8 text-blue-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase italic">Worker Fleet Management</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Status of all distributed execution workers across the global fabric</p>
            </div>
          </div>
        )}
        {activeSubTab === 'JOBS' && (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[40px] border-dashed">
             <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Zap className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase italic">Migration Job Center</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Background jobs for data migration, embedding updates, and index rebuilding</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OperationsCenter;
