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
             <button className="btn-secondary">
                <Clock className="w-4 h-4" />
                HISTORY
              </button>
              <button className="btn-primary">
                <Plus className="w-4 h-4" />
                NEW COMPONENT
              </button>
          </div>
        }
      />

      <StandardMetricsGrid metrics={mainMetrics} />

      {/* Sub-Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-[#F8F6EF] border border-[#ECE7DA] rounded-2xl w-full lg:w-fit overflow-x-auto no-scrollbar">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-all shrink-0",
              activeSubTab === tab.id
                ? "bg-white text-[#171717] shadow-sm border border-[#ECE7DA]"
                : "text-[#8B8B8B] hover:text-[#4A4A4A] hover:bg-white/70"
            )}
          >
            <tab.icon className={cn("w-3.5 h-3.5", activeSubTab === tab.id ? "text-[#D9B86C]" : "text-[#C0B9AC]")} />
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
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white border border-[#ECE7DA] rounded-3xl border-dashed">
            <div className="w-16 h-16 rounded-full bg-[#F8F6EF] flex items-center justify-center border border-[#ECE7DA]">
              <History className="w-8 h-8 text-[#B0A99A] animate-pulse" />
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
