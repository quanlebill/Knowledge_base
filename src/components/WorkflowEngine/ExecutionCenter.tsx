import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Play, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  ChevronRight, 
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Pause,
  RotateCcw,
  Ban,
  MoreVertical,
  Activity,
  Cpu,
  Database,
  Bot,
  ShieldCheck,
  Zap,
  Terminal,
  FileText,
  Layers,
  Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ExecutionStatus, WorkflowExecution } from '../../types/workflow';

const MOCK_EXECUTIONS: WorkflowExecution[] = [
  {
    id: 'exec-8921',
    workflowId: 'wf-1',
    workflowName: 'Multi-Agent Banking Support',
    trigger: 'WEBHOOK',
    tenant: 'Global-Finance',
    environment: 'PROD',
    status: ExecutionStatus.COMPLETED,
    startedAt: '12m ago',
    duration: '45s',
    cost: 0.12,
  },
  {
    id: 'exec-8920',
    workflowId: 'wf-3',
    workflowName: 'Gov-Compliance Review',
    trigger: 'UI',
    tenant: 'Gov-Tech-Hanoi',
    environment: 'DEV',
    status: ExecutionStatus.WAITING_APPROVAL,
    startedAt: '45m ago',
    duration: '3h 12m',
    cost: 0.05,
    waitingReason: 'Legal Director Signature Required'
  },
  {
    id: 'exec-8919',
    workflowId: 'wf-2',
    workflowName: 'GraphRAG Intelligence Sync',
    trigger: 'SCHEDULE',
    tenant: 'Smart-City-Nexus',
    environment: 'STAGING',
    status: ExecutionStatus.RUNNING,
    startedAt: 'Just now',
    duration: '1m 12s',
    cost: 0.85,
    currentNodeId: 'node-sync-graph'
  },
  {
    id: 'exec-8918',
    workflowId: 'wf-1',
    workflowName: 'Multi-Agent Banking Support',
    trigger: 'WEBHOOK',
    tenant: 'Global-Finance',
    environment: 'PROD',
    status: ExecutionStatus.FAILED,
    startedAt: '2h ago',
    duration: '12s',
    cost: 0.02,
    waitingReason: 'Gateway Timeout (504)'
  }
];

const ExecutionCenter = () => {
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);

  const renderTrace = () => {
    if (!selectedExecution) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5"
      >
        <div className="p-6 border-b border-white/5 bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedExecution(null)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest leading-none">TRACE ID</span>
                <span className="text-xs font-mono text-white leading-none">#{selectedExecution.id}</span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight leading-none">{selectedExecution.workflowName}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all"><Play className="w-3.5 h-3.5" /> Replay</button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all"><Code className="w-3.5 h-3.5" /> JSON Trace</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-8">
          <div className="max-w-4xl mx-auto">
            {/* Trace Statistics */}
            <div className="grid grid-cols-4 gap-4 mb-12">
              {[
                { label: 'Total Duration', value: selectedExecution.duration, icon: Clock },
                { label: 'Infrastructure Cost', value: `$${selectedExecution.cost}`, icon: Zap },
                { label: 'Tokens Processed', value: '1,242k', icon: Layers },
                { label: 'Worker Affinity', value: 'US-EAST-1A', icon: Cpu },
              ].map((stat) => (
                <div key={stat.label} className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <stat.icon className="w-3.5 h-3.5 text-brand-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <div className="text-lg font-bold text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Trace Steps Tree */}
            <div className="space-y-4 relative">
              <div className="absolute left-[23px] top-6 bottom-6 w-px bg-white/10" />
              
              {[
                { title: 'Workflow Triggered', type: 'SYSTEM', status: 'SUCCESS', icon: Zap, time: 'T+0s' },
                { title: 'Metadata Extraction', type: 'KNOWLEDGE', status: 'SUCCESS', icon: Database, time: 'T+12s', logs: 'Extracted 12 PII fields, masked 4.' },
                { title: 'Agent Reasoning Stage', type: 'AI', status: 'SUCCESS', icon: Bot, time: 'T+24s', tokens: 420 },
                { title: 'Human Approval Request', type: 'HUMAN', status: selectedExecution.status === ExecutionStatus.WAITING_APPROVAL ? 'PENDING' : 'SUCCESS', icon: ShieldCheck, time: 'T+32s' },
                { title: 'External Tool Call', type: 'TOOL', status: 'IDLE', icon: Activity, time: '--' },
              ].map((step, i) => (
                <div key={i} className="group relative pl-14">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 bg-[#050505] flex items-center justify-center z-10 ${
                    step.status === 'SUCCESS' ? 'border-emerald-500' : 
                    step.status === 'PENDING' ? 'border-amber-500' : 'border-slate-800'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      step.status === 'SUCCESS' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                      step.status === 'PENDING' ? 'bg-amber-500 animate-pulse' : 'bg-slate-800'
                    }`} />
                  </div>

                  <div className="p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl transition-all flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-slate-800 rounded-xl">
                        <step.icon className="w-4 h-4 text-slate-400 group-hover:text-brand-400 transition-colors" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm tracking-tight">{step.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{step.type}</span>
                          {step.time !== '--' && <span className="text-[9px] text-brand-500 font-mono italic">{step.time}</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {step.tokens && <div className="text-[9px] px-1.5 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded font-mono">{step.tokens} TOKENS</div>}
                      <button className="p-2 hover:bg-white/10 rounded-lg text-slate-500 transition-all"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                  </div>
                  
                  {step.logs && (
                    <div className="mt-2 ml-4 p-3 bg-white/5 rounded-xl text-[10px] font-mono text-slate-500 italic border-l-2 border-brand-500/30">
                      LOGGER OUT: {step.logs}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex h-full bg-slate-950 overflow-hidden">
      <div className={`flex-1 flex flex-col transition-all duration-500 ${selectedExecution ? 'w-1/2' : 'w-full'}`}>
        <div className="p-8 border-b border-white/5 bg-slate-900/50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-brand-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">Recent Executions</h1>
            </div>
            <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
              <button className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-bold shadow-lg">History</button>
              <button className="px-4 py-1.5 text-slate-500 hover:text-white rounded-lg text-xs font-bold transition-all">Queue</button>
              <button className="px-4 py-1.5 text-slate-500 hover:text-white rounded-lg text-xs font-bold transition-all">Schedules</button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search executions by trace ID, workflow name, or environment..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <button className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 transition-all"><Filter className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10">
                <th className="px-6 pb-4 text-left">Execution ID / Workflow</th>
                <th className="px-6 pb-4 text-left">Trigger / Env</th>
                <th className="px-6 pb-4 text-left">Status</th>
                <th className="px-6 pb-4 text-left">Metrics</th>
                <th className="px-6 pb-4 text-right">Activity</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_EXECUTIONS.map((exec) => (
                <tr 
                  key={exec.id} 
                  onClick={() => setSelectedExecution(exec)}
                  className={`group border-b border-white/[0.03] hover:bg-white/[0.03] transition-all cursor-pointer ${selectedExecution?.id === exec.id ? 'bg-brand-500/5 border-brand-500/50' : ''}`}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-brand-400">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-white font-bold leading-none mb-1">#{exec.id}</div>
                        <div className="text-xs text-slate-400 font-medium">{exec.workflowName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{exec.trigger}</span>
                      <span className="text-[10px] text-brand-400 font-bold">{exec.tenant} / {exec.environment}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      exec.status === ExecutionStatus.COMPLETED ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      exec.status === ExecutionStatus.RUNNING ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                      exec.status === ExecutionStatus.FAILED ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${
                        exec.status === ExecutionStatus.COMPLETED ? 'bg-emerald-400' :
                        exec.status === ExecutionStatus.RUNNING ? 'bg-blue-400 animate-pulse' :
                        exec.status === ExecutionStatus.FAILED ? 'bg-red-400' : 'bg-amber-400'
                      }`} />
                      {exec.status.replace('_', ' ')}
                    </div>
                    {exec.waitingReason && <div className="text-[9px] text-slate-500 mt-1 italic italic">Wait: {exec.waitingReason}</div>}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-xs font-bold text-white">{exec.duration}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Duration</div>
                      </div>
                      <div className="w-px h-6 bg-white/10" />
                      <div>
                        <div className="text-xs font-bold text-white">${exec.cost}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Cost</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 text-slate-500">
                      <div className="text-xs font-medium italic mr-4">{exec.startedAt}</div>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-all"><ArrowRight className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedExecution && (
          <div className="w-1/2">
            {renderTrace()}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExecutionCenter;
