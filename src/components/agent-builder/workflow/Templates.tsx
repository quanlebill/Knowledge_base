import React from 'react';
import { 
  Rocket, 
  Search, 
  Plus, 
  ArrowRight, 
  Layers, 
  Database, 
  Bot, 
  Activity, 
  ShieldCheck, 
  FileText,
  Copy,
  Layout
} from 'lucide-react';
import { motion } from 'motion/react';

const TEMPLATES = [
  {
    id: 't1',
    name: 'Advanced RAG Pipeline',
    desc: 'Hybrid search with reranking and PII extraction for sensitive document ingestion.',
    icon: Database,
    color: 'emerald',
    category: 'Knowledge',
    nodes: 12
  },
  {
    id: 't2',
    name: 'Multi-Agent Triage',
    desc: 'Coordinator agent delegating to specialized support and billing sub-agents.',
    icon: Bot,
    color: 'brand',
    category: 'AI',
    nodes: 8
  },
  {
    id: 't3',
    name: 'Compliance Sign-off',
    desc: 'Sequential human approval flow with automated document versioning and audit trails.',
    icon: ShieldCheck,
    color: 'amber',
    category: 'Human',
    nodes: 5
  },
  {
    id: 't4',
    name: 'Auto-Incident Response',
    desc: 'Triggered by external webhooks, performs log analysis and proposes resolution steps.',
    icon: Activity,
    color: 'red',
    category: 'Operations',
    nodes: 15
  }
];

const WorkflowTemplates = ({ onUse }: { onUse: (t: any) => void }) => {
  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      <div className="p-8 border-b border-white/5 bg-slate-900/50">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Rocket className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Workflow Templates</h1>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20">
            <Plus className="w-4 h-4" />
            Publish Template
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search templates for RAG, Multi-Agent, Compliance..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            {['All', 'AI', 'Knowledge', 'Human', 'System'].map(cat => (
              <button key={cat} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${cat === 'All' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{cat}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEMPLATES.map((t, i) => (
            <motion.div 
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-brand-500/30 rounded-[32px] p-8 transition-all flex flex-col shadow-xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className={`p-4 rounded-2xl bg-${t.color}-500/10 border border-${t.color}-500/20`}>
                  <t.icon className={`w-8 h-8 text-${t.color}-400 group-hover:scale-110 transition-transform`} />
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t.category}</span>
                   <span className="text-xs font-bold text-slate-400 mt-1">{t.nodes} Nodes</span>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-brand-400 transition-colors">{t.name}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-8 flex-1 italic">{t.desc}</p>

              <div className="flex items-center justify-between pt-6 border-t border-white/5">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800" />)}
                  <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-brand-500 flex items-center justify-center text-[10px] font-bold text-white">42+</div>
                </div>
                <button 
                  onClick={() => onUse(t)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-brand-500 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/10 group-hover:border-transparent"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Clone & Build
                </button>
              </div>
            </motion.div>
          ))}

          {/* New Template Placeholder */}
          <div className="group bg-slate-900/40 border border-white/5 border-dashed rounded-[32px] p-8 flex flex-col items-center justify-center text-center hover:border-brand-500/50 hover:bg-white/[0.02] transition-all cursor-pointer min-h-[300px]">
            <div className="p-4 rounded-full bg-white/5 mb-4 group-hover:bg-brand-500/10 transition-all">
              <Plus className="w-8 h-8 text-slate-600 group-hover:text-brand-400" />
            </div>
            <h4 className="font-bold text-white mb-1">Custom Template</h4>
            <p className="text-xs text-slate-500">Register a new reusable pattern...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowTemplates;
