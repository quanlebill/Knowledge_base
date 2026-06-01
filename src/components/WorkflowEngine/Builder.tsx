import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Play, 
  Activity, 
  Database, 
  Bot, 
  Globe, 
  Zap, 
  Layers, 
  Plus, 
  ArrowRight,
  Code as CodeIcon,
  Search,
  Settings,
  ShieldCheck,
  Layout,
  MousePointer2,
  Hand,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Trash2,
  Share2,
  Cpu,
  Clock,
  Terminal,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Workflow, WorkflowNode, WorkflowStatus, WorkflowType } from '../../types/workflow';

const CATEGORIES = [
  { id: 'AI', label: 'AI & Reasoning', icon: Bot, nodes: ['Agent', 'Planner', 'Reasoning', 'Summarizer', 'Reflection'] },
  { id: 'KNOWLEDGE', label: 'Knowledge Base', icon: Database, nodes: ['Retrieval', 'GraphRAG', 'Search', 'Reranker', 'Sync'] },
  { id: 'TOOLS', label: 'Enterprise Tools', icon: Settings, nodes: ['REST API', 'GraphQL', 'SQL', 'Email', 'Slack'] },
  { id: 'CONTROL', label: 'Control Flow', icon: Activity, nodes: ['If/Else', 'Loop', 'Retry', 'Parallel', 'Merge'] },
  { id: 'HUMAN', label: 'Human Interaction', icon: ShieldCheck, nodes: ['Approval', 'Review', 'Input', 'Escalation'] },
];

const WorkflowBuilder = ({ onClose, workflow }: { onClose: () => void, workflow: Workflow | null }) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'VISUAL' | 'CODE'>('VISUAL');
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflow?.nodes || [
    { 
      id: 'start', 
      type: 'START', 
      label: 'Workflow Entry', 
      icon: Play, 
      position: { x: 50, y: 50 }, 
      config: {} 
    }
  ]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-slate-200">
      {/* Builder Toolbar */}
      <div className="h-16 border-b border-white/5 bg-[#050505] flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400">
            <X className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-white/10" />
          <div>
            <h2 className="text-sm font-bold text-white mb-0.5">{workflow?.name || 'Untitled Workflow'}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">{workflow?.version || 'v1.0.0-draft.1'}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">• UNSAVED CHANGES</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-4">
            <button 
              onClick={() => setViewMode('VISUAL')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'VISUAL' ? 'bg-brand-500 text-white' : 'text-slate-400'}`}
            >
              <Layout className="w-3.5 h-3.5" />
              Visual
            </button>
            <button 
              onClick={() => setViewMode('CODE')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'CODE' ? 'bg-brand-500 text-white' : 'text-slate-400'}`}
            >
              <CodeIcon className="w-3.5 h-3.5" />
              YAML
            </button>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all">
            <Activity className="w-3.5 h-3.5" />
            Dry Run
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-500/20">
            <Save className="w-3.5 h-3.5" />
            Publish
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Node Library */}
        <div className="w-72 border-r border-white/5 bg-[#050505] flex flex-col shrink-0">
          <div className="p-4 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search nodes..." 
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2 custom-scrollbar">
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="mb-4">
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <cat.icon className="w-3.5 h-3.5 text-brand-400/50" />
                  {cat.label}
                </div>
                <div className="space-y-1 mt-1">
                  {cat.nodes.map((node) => (
                    <div 
                      key={node} 
                      className="group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-grab border border-transparent hover:border-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-800 rounded-lg group-hover:bg-brand-500/10 transition-colors">
                          <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400" />
                        </div>
                        <span className="text-xs font-medium text-slate-300 group-hover:text-white">{node}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-700 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Canvas Area */}
        <div className="flex-1 relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] overflow-hidden group">
          {/* Canvas Navigation Controls */}
          <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-10">
            <div className="flex flex-col bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <button className="p-3 hover:bg-white/5 text-slate-400 hover:text-white transition-all"><ZoomIn className="w-4 h-4" /></button>
              <div className="h-px bg-white/10 mx-2" />
              <button className="p-3 hover:bg-white/5 text-slate-400 hover:text-white transition-all"><ZoomOut className="w-4 h-4" /></button>
            </div>
            <button className="p-3 bg-slate-900 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all shadow-2xl"><Maximize2 className="w-4 h-4" /></button>
          </div>

          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-4 shadow-2xl z-10 transition-all group-hover:translate-y-0 -translate-y-4 opacity-0 group-hover:opacity-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Canvas Healthy</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="text-[10px] font-medium text-slate-400 tracking-tight">32 Nodes Configured</div>
          </div>

          {/* Node Render (Placeholder for actual canvas logic) */}
          <div className="absolute inset-0 p-20 flex items-center justify-center pointer-events-none">
             <div className="w-full h-full border-2 border-dashed border-white/5 rounded-[40px] flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                  {viewMode === 'VISUAL' ? (
                    <motion.div 
                      key="visual"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      className="absolute inset-0"
                    >
                      {/* Fake Nodes */}
                      <div className="absolute top-1/4 left-1/4 w-64 p-4 bg-slate-900 border border-brand-500 rounded-2xl shadow-2xl pointer-events-auto">
                        <div className="flex items-center justify-between mb-4">
                           <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-brand-500/10 rounded-lg"><Play className="w-4 h-4 text-brand-400" /></div>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trigger</span>
                           </div>
                           <MoreVertical className="w-4 h-4 text-slate-600" />
                        </div>
                        <h4 className="font-bold text-white mb-1">Webhook Inbound</h4>
                        <p className="text-[10px] text-slate-500">Listens for incident alerts from DataDog...</p>
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-900 border-2 border-brand-500 rounded-full flex items-center justify-center">
                           <ArrowRight className="w-3 h-3 text-brand-400" />
                        </div>
                      </div>

                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 p-1 bg-gradient-to-br from-brand-500 to-purple-500 rounded-2xl shadow-2xl pointer-events-auto">
                        <div className="bg-slate-900 rounded-[14px] p-4 border border-white/10">
                          <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-2">
                               <div className="p-1.5 bg-brand-500/10 rounded-lg"><Bot className="w-4 h-4 text-brand-400" /></div>
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agent</span>
                             </div>
                             <span className="text-[9px] px-1.5 py-0.5 bg-white/10 rounded-md font-mono text-slate-400">v2.1</span>
                          </div>
                          <h4 className="font-bold text-white mb-1">Incident Triage Agent</h4>
                          <div className="space-y-2 mt-4">
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full w-3/4 bg-brand-500" />
                            </div>
                            <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest">
                              <span>Confidence</span>
                              <span>82%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="absolute bottom-1/4 right-1/4 w-64 p-4 bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl pointer-events-auto">
                        <div className="flex items-center justify-between mb-4">
                           <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-amber-500/10 rounded-lg"><ShieldCheck className="w-4 h-4 text-amber-400" /></div>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Human Approval</span>
                           </div>
                        </div>
                        <h4 className="font-bold text-white mb-1">Executive Sign-off</h4>
                        <div className="flex -space-x-2 mt-3">
                          {[1,2,3].map(avatarIdx => <div key={`avatar-${avatarIdx}`} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-800" />)}
                          <div className="w-6 h-6 rounded-full border-2 border-slate-900 bg-brand-500 flex items-center justify-center text-[8px] font-bold text-white">+2</div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="code"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="w-full h-full pointer-events-auto"
                    >
                      <div className="w-full h-full bg-[#050505] p-6 font-mono text-sm overflow-auto text-slate-400 hover:text-slate-300">
                        <pre>{`name: "Multi-Agent Banking Support"
version: "2.4.0"
tenant: "Global-Finance"

nodes:
  - id: "start"
    type: "trigger"
    config:
      type: "webhook"
      auth: "bearer"
      endpoint: "/api/wf/inbound"

  - id: "agent_triage"
    type: "agent"
    depends_on: ["start"]
    config:
      agent_id: "banking-triage-v2"
      model: "gemini-pro-3"
      memory: "session"
      
  - id: "tool_crm"
    type: "tool"
    depends_on: ["agent_triage"]
    config:
      action: "fetch_customer_data"
      api: "salesforce-production"

  - id: "approval_ops"
    type: "human_approval"
    depends_on: ["tool_crm"]
    config:
      roles: ["SUPPORT_MANAGER", "OPS_LEAD"]
      sla: "2h"
      escalation: "director_bot"`}</pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>
        </div>

        {/* Right Panel: Node Config */}
        <div className="w-80 border-l border-white/5 bg-[#050505] flex flex-col shrink-0 overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-white tracking-tight">Configuration</h3>
              <button className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Reset</button>
            </div>

            <div className="space-y-6">
              {/* Type Info */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-brand-500/10 rounded-xl">
                    <Bot className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm leading-none">Agent Reasoning</div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-widest">Logic Node</div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  Executes autonomous reasoning using the selected agent profile. Supports long-term memory and GraphRAG context injection.
                </p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Select Agent</label>
                   <div className="relative">
                     <select className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white appearance-none focus:outline-none focus:ring-1 focus:ring-brand-500">
                       <option>Banking Triage v2.4</option>
                       <option>Account Support v1.0</option>
                       <option>System Auditor v3.2</option>
                     </select>
                     <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                   </div>
                 </div>

                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Context Mode</label>
                   <div className="grid grid-cols-2 gap-2">
                     <button className="px-3 py-2 bg-brand-500/10 border border-brand-500/50 rounded-xl text-[10px] font-bold text-brand-400">GraphRAG</button>
                     <button className="px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold text-slate-500 hover:text-white transition-colors">Vector Only</button>
                   </div>
                 </div>

                 <div className="space-y-2">
                   <div className="flex items-center justify-between ml-1">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Temperature</label>
                     <span className="text-[10px] font-mono text-brand-400">0.7</span>
                   </div>
                   <input type="range" className="w-full h-1 bg-white/5 rounded-full appearance-none accent-brand-500" />
                 </div>

                 <div className="pt-4 border-t border-white/5">
                   <div className="flex items-center justify-between mb-4">
                     <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Advanced Guardrails</div>
                     <div className="w-8 h-4 bg-brand-500/20 rounded-full relative">
                       <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-brand-500 rounded-full" />
                     </div>
                   </div>
                   <div className="space-y-1">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span className="text-[9px] font-medium text-slate-400">PII Redaction Enabled</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <Lock className="w-3 h-3 text-brand-400" />
                        <span className="text-[9px] font-medium text-slate-400">Entitlement Bound Check</span>
                      </div>
                   </div>
                 </div>
              </div>

              {/* Output Mapping */}
              <div className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Output Mapping</h4>
                  <Plus className="w-3 h-3 text-slate-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl p-2 group hover:border-brand-500/50 transition-all">
                    <div className="w-6 h-6 bg-brand-500/10 rounded-lg flex items-center justify-center text-[10px] font-bold text-brand-400">JS</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">Response JSON</div>
                      <div className="text-[10px] text-slate-300 font-mono truncate">$.data.analysis</div>
                    </div>
                    <Trash2 className="w-3 h-3 text-slate-700 group-hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Shelf: Logs/Validation */}
      <div className="h-10 bg-slate-900 border-t border-white/10 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">DAG Validation Passed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">Workers Scaled: Healthy (12)</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors cursor-pointer">
             <Terminal className="w-3.5 h-3.5" />
             <span className="text-[9px] font-black uppercase tracking-widest">Runtime Logs</span>
             <span className="px-1 py-0.5 bg-brand-500/20 text-brand-400 rounded text-[8px] font-bold">124</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
