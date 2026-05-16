import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bot, Layers, History, Plus, Zap, Activity, Clock, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';
import { AgentRuntimeView as AgentRuntime } from './AgentRuntime';
import WorkflowEngine from './WorkflowEngine/Overview';

const AIRuntimeCenter = () => {
  const [activeSubTab, setActiveSubTab] = useState<'AGENTS' | 'WORKFLOWS' | 'TRACES'>('AGENTS');

  const mainMetrics = [
    { label: 'Active Agents', value: '482', trend: '+5', trendType: 'UP' as const, icon: Bot, color: 'brand' as const },
    { label: 'Workflow Runs', value: '1.2M', trend: '+18%', trendType: 'UP' as const, icon: Layers, color: 'blue' as const },
    { label: 'Avg Latency', value: '1.4s', trend: '-120ms', trendType: 'DOWN' as const, icon: Zap, color: 'emerald' as const },
    { label: 'Success Rate', value: '99.98%', trend: 'OPTIMAL', trendType: 'NEUTRAL' as const, icon: Shield, color: 'amber' as const },
  ];

  const subTabs = [
    { id: 'AGENTS', label: 'Agent Registry', icon: Bot },
    { id: 'WORKFLOWS', label: 'Workflow Engine', icon: Layers },
    { id: 'TRACES', label: 'Execution Traces', icon: History },
  ];

  return (
    <div className="space-y-8">
      <OperationalHeader 
        title="AI Runtime"
        subtitle="Manage, Orchestrate, and Trace Distributed AI Agents & Workflows"
        breadcrumbs={[{ label: 'AI' }, { label: 'Runtime' }]}
        status={<StatusBadge status="ACTIVE" size="lg" />}
        actions={
          <div className="flex gap-3">
             <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5">
                <Clock className="w-4 h-4" />
                HISTORY
              </button>
              <button className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-95">
                <Plus className="w-4 h-4" />
                NEW COMPONENT
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
        {activeSubTab === 'AGENTS' && <AgentRuntime />}
        {activeSubTab === 'WORKFLOWS' && <WorkflowEngine />}
        {activeSubTab === 'TRACES' && (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[40px] border-dashed">
            <div className="w-16 h-16 rounded-full bg-slate-500/10 flex items-center justify-center border border-white/5">
              <History className="w-8 h-8 text-slate-500 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase italic">Execution Trace Explorer</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Unified view of all agentic and workflow traces across environments</p>
              <button className="mt-6 px-6 py-2 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Open Trace Desktop</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AIRuntimeCenter;
