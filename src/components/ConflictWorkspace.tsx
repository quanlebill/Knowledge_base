import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  GitMerge, 
  FileDiff, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  User, 
  Bot, 
  ChevronRight,
  History as HistoryIcon,
  Info,
  Layers,
  FileText,
  Save,
  Trash2,
  Lock,
  GitPullRequest,
  AlertTriangle,
  Zap,
  Activity,
  Network,
  Clock,
  ArrowUpRight,
  Search,
  MoreHorizontal,
  Brain,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  MoreVertical,
  Plus,
  Filter,
  Check,
  Loader2,
  ShieldQuestion,
  Eye,
  GitBranch,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { DetailDrawer } from './shared/DetailDrawer';

// --- INLINE UI COMPONENTS ---
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn("w-full h-2 bg-white/5 rounded-full overflow-hidden", className)}>
    <div 
      className="h-full bg-brand-500 transition-all duration-500 ease-out" 
      style={{ width: `${value}%` }} 
    />
  </div>
);

// --- TYPES ---
type ConflictStatus = 'NEW' | 'IN_REVIEW' | 'NEEDS_APPROVAL' | 'RESOLVED' | 'PUBLISHED' | 'REJECTED' | 'ESCALATED';
type ConflictType = 'DOCUMENT' | 'SEMANTIC' | 'VERSION' | 'SOURCE_PRIORITY' | 'METADATA' | 'GRAPH_ENTITY' | 'DUPLICATE';
type Severity = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

interface ConflictSource {
  id: string;
  name: string;
  content: string;
  trustScore: number;
  version: string;
  securityLevel: string;
  author: string;
  timestamp: string;
  tags: string[];
}

interface Conflict {
  id: string;
  status: ConflictStatus;
  type: ConflictType;
  severity: Severity;
  target: string;
  explanation: string;
  sources: ConflictSource[];
  tenant: string;
  project: string;
  affectedKB: string;
  affectedAgents: number;
  affectedRetrievals: number;
  confidence: number;
  assignedTo: string;
  lastUpdated: string;
  impactAnalysis?: {
    chunks: number;
    graphEntities: number;
    hallucinationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  }
}

// --- MOCK DATA ---
const CONFLICTS_DATA: Conflict[] = [
  { 
    id: 'CONF-001', 
    status: 'IN_REVIEW',
    type: 'SEMANTIC', 
    severity: 'HIGH',
    target: 'Refund_Policy_2025_Global.md', 
    explanation: 'Divergence in refund window eligibility detected between Corporate Policy and Regional Amendment.',
    tenant: 'BlueChip Enterprise',
    project: 'Global Operations',
    affectedKB: 'Standard Operating Procedures',
    affectedAgents: 12,
    affectedRetrievals: 1450,
    confidence: 0.89,
    assignedTo: 'Sarah Connor',
    lastUpdated: '2h ago',
    sources: [
      {
        id: 's1',
        name: 'Corp_Wiki_V4.2',
        content: 'Customers are eligible for a full refund within 30 business days of original purchase date. Requires receipt.',
        trustScore: 98,
        version: '4.2',
        securityLevel: 'INTERNAL',
        author: 'Policies Team',
        timestamp: '2025-01-10',
        tags: ['legal', 'finance', 'v4']
      },
      {
        id: 's2',
        name: 'Regional_Draft_EMEA',
        content: 'EMEA Enterprise accounts may request refunds up to 45 calendar days. Exceptions apply for digital assets.',
        trustScore: 72,
        version: '1.0-DRAFT',
        securityLevel: 'RESTRICTED',
        author: 'EMEA Ops',
        timestamp: '2025-02-15',
        tags: ['draft', 'emea', 'exception']
      }
    ],
    impactAnalysis: {
      chunks: 24,
      graphEntities: 5,
      hallucinationRisk: 'HIGH'
    }
  },
  { 
    id: 'CONF-002', 
    status: 'NEW',
    type: 'METADATA', 
    severity: 'NORMAL',
    target: 'Security_Guidelines_ISO27001', 
    explanation: 'Discrepancy in security classification tagging between Human Expert and Automated AI Profiler.',
    tenant: 'Federal Systems',
    project: 'Cloud Security',
    affectedKB: 'Compliance Baseline',
    affectedAgents: 4,
    affectedRetrievals: 890,
    confidence: 0.95,
    assignedTo: 'James Smith',
    lastUpdated: '5h ago',
    sources: [
      {
        id: 's3',
        name: 'Human_Audit_Log',
        content: 'Classification: TOP_SECRET. Requires Level 4 clearance.',
        trustScore: 99,
        version: 'Audit-2024',
        securityLevel: 'TOP SECRET',
        author: 'Audit Officer',
        timestamp: '2024-11-20',
        tags: ['iso', 'security']
      },
      {
        id: 's4',
        name: 'AI_Auto_Scanner',
        content: 'Classification: SECRET. Normal handling sufficient for non-PII sections.',
        trustScore: 85,
        version: 'V2_Model',
        securityLevel: 'SECRET',
        author: 'Llama-3-Agent',
        timestamp: '2025-03-01',
        tags: ['automated', 'scanning']
      }
    ],
    impactAnalysis: {
      chunks: 10,
      graphEntities: 2,
      hallucinationRisk: 'MEDIUM'
    }
  },
];

export const ConflictWorkspace = () => {
  const [view, setView] = useState<'LIST' | 'DETAIL'>('LIST');
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [resolutionStrategy, setResolutionStrategy] = useState<string | null>(null);
  const [canonicalDraft, setCanonicalDraft] = useState<string>('');
  const [isAiMerging, setIsAiMerging] = useState(false);
  const [showDiscardDrawer, setShowDiscardDrawer] = useState(false);
  const [showPublishDrawer, setShowPublishDrawer] = useState(false);
  const [publishStep, setPublishStep] = useState(1);

  const getSeverityColor = (sev: Severity) => {
    switch (sev) {
      case 'CRITICAL': return 'text-red-500 border-red-500/20 bg-red-500/5';
      case 'HIGH': return 'text-amber-500 border-amber-500/20 bg-amber-500/5';
      case 'NORMAL': return 'text-blue-500 border-blue-500/20 bg-blue-500/5';
      case 'LOW': return 'text-slate-500 border-slate-500/20 bg-slate-500/5';
    }
  };

  const getStatusColor = (status: ConflictStatus) => {
    switch (status) {
      case 'NEW': return 'bg-white/10 text-white';
      case 'IN_REVIEW': return 'bg-amber-500/20 text-amber-500';
      case 'NEEDS_APPROVAL': return 'bg-purple-500/20 text-purple-500';
      case 'RESOLVED': return 'bg-green-500/20 text-green-400';
      case 'PUBLISHED': return 'bg-brand-500/20 text-brand-400';
      case 'REJECTED': return 'bg-red-500/20 text-red-500';
      case 'ESCALATED': return 'bg-orange-500/20 text-orange-500';
    }
  };

  const ListView = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-amber-500 text-xs font-black font-mono tracking-widest uppercase mb-3 text-glow-amber">
            <ShieldAlert className="w-4 h-4" />
            Knowledge Integrity Node
          </div>
          <h1 className="text-5xl font-display font-medium tracking-tight">Operations Center</h1>
          <p className="text-slate-500 mt-2 text-lg">
            Manage semantic reconciled models and resolve structural discrepancies across multi-source ingestion.
          </p>
        </div>
        <div className="flex gap-4">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Query conflicts..." 
                className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-xs w-64 focus:outline-none focus:border-brand-500/50 transition-all font-mono" 
              />
           </div>
           <button className="px-6 py-3 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-xl shadow-white/5 flex items-center gap-2">
             <CheckCircle2 className="w-4 h-4" />
             Approve All
           </button>
        </div>
      </div>

      <div className="glass-panel rounded-[2rem] overflow-hidden border-white/5 bg-white/[0.01]">
         <table className="w-full text-left">
            <thead>
               <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="px-8 py-5">Conflict ID</th>
                  <th className="px-6 py-5">Type / Severity</th>
                  <th className="px-6 py-5">Target Entity</th>
                  <th className="px-6 py-5">Impact (Agents/Queries)</th>
                  <th className="px-6 py-5">Confidence</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5">Reviewer</th>
                  <th className="px-8 py-5 text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
               {CONFLICTS_DATA.map(conflict => (
                  <tr 
                    key={conflict.id}
                    onClick={() => {
                      setSelectedConflict(conflict);
                      setView('DETAIL');
                    }}
                    className="group hover:bg-white/[0.02] transition-all cursor-pointer"
                  >
                     <td className="px-8 py-6">
                        <div className="font-mono text-xs font-bold text-slate-300">{conflict.id}</div>
                        <div className="text-[10px] text-slate-600 mt-1">{conflict.tenant}</div>
                     </td>
                     <td className="px-6 py-6 font-mono">
                        <div className="flex items-center gap-2 mb-1">
                           <GitPullRequest className="w-3.5 h-3.5 text-brand-400" />
                           <span className="text-xs font-bold uppercase">{conflict.type}</span>
                        </div>
                        <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase border", getSeverityColor(conflict.severity))}>
                          {conflict.severity}
                        </span>
                     </td>
                     <td className="px-6 py-6">
                        <div className="text-xs font-bold text-white mb-0.5">{conflict.target}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-1 italic">{conflict.explanation}</div>
                     </td>
                     <td className="px-6 py-6">
                        <div className="flex items-center gap-4">
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-600 uppercase">Agents</span>
                              <span className="text-xs font-mono font-bold text-slate-300">{conflict.affectedAgents}</span>
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-600 uppercase">Hits</span>
                              <span className="text-xs font-mono font-bold text-brand-400">{conflict.affectedRetrievals}</span>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-6">
                        <div className="flex items-center gap-2">
                           <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-500" style={{ width: `${conflict.confidence * 100}%` }} />
                           </div>
                           <span className="text-xs font-mono text-slate-400">{(conflict.confidence * 100).toFixed(0)}%</span>
                        </div>
                     </td>
                     <td className="px-6 py-6">
                        <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", getStatusColor(conflict.status))}>
                          {conflict.status.replace('_', ' ')}
                        </span>
                     </td>
                     <td className="px-6 py-6">
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-[10px] font-bold text-brand-400">
                             {conflict.assignedTo.split(' ').map(n => n[0]).join('')}
                           </div>
                           <span className="text-xs text-slate-400">{conflict.assignedTo}</span>
                        </div>
                     </td>
                     <td className="px-8 py-6 text-right">
                        <button className="p-2 hover:bg-white/10 rounded-xl transition-all">
                           <ChevronRight className="w-5 h-5 text-slate-500" />
                        </button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );

  const DetailView = () => {
    if (!selectedConflict) return null;

    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex justify-between items-center mb-8">
           <div className="flex items-center gap-6">
              <button 
                onClick={() => setView('LIST')}
                className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-500 hover:text-white transition-all shadow-xl"
              >
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
              <div>
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.3em] mb-2">
                   <GitMerge className="w-4 h-4 text-brand-400" />
                   <span className="text-slate-500">Working Conflict:</span>
                   <span className="text-brand-400">{selectedConflict.id}</span>
                </div>
                <h2 className="text-3xl font-display font-medium tracking-tight italic">Resolving {selectedConflict.target}</h2>
              </div>
           </div>
            <div className="flex gap-4">
              <button className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest hover:text-white transition-all">
                 Escalate Concern
              </button>
              <button 
                onClick={() => setShowDiscardDrawer(true)}
                className="px-5 py-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-all"
              >
                 Discard Resolution
              </button>
              <button 
                onClick={() => setShowPublishDrawer(true)}
                className="px-8 py-2.5 bg-brand-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/30 flex items-center gap-3"
              >
                 Publish Canonical
                 <ArrowRight className="w-4 h-4" />
              </button>
           </div>
        </div>

        <div className="grid grid-cols-12 gap-8 flex-1 overflow-hidden">
           {/* Left Source Panel */}
           <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden">
              <div className="flex-1 flex gap-6 overflow-hidden">
                 {selectedConflict.sources.map((source, i) => (
                    <div key={source.id} className="flex-1 flex flex-col glass-panel rounded-3xl border-white/5 bg-white/[0.01] overflow-hidden group">
                       <div className="p-4 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500">
                                <FileText className="w-4 h-4" />
                             </div>
                             <div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Source {String.fromCharCode(65 + i)}</div>
                                <div className="text-xs font-bold text-white">{source.name}</div>
                             </div>
                          </div>
                          <div className={cn(
                             "px-2 py-0.5 rounded-full text-[8px] font-black uppercase border",
                             source.trustScore > 90 ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          )}>
                             {source.trustScore}% Trust
                          </div>
                       </div>
                       <div className="p-6 space-y-4 text-xs">
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                                <span className="text-[9px] font-black text-slate-600 uppercase">Version</span>
                                <div className="font-mono text-slate-400">{source.version}</div>
                             </div>
                             <div className="space-y-1">
                                <span className="text-[9px] font-black text-slate-600 uppercase">Security</span>
                                <div className="font-mono text-slate-400">{source.securityLevel}</div>
                             </div>
                          </div>
                          <div className="pt-4 border-t border-white/5 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar font-mono leading-relaxed text-slate-300 bg-black/20 p-4 rounded-xl">
                             {source.content}
                          </div>
                          <button 
                            onClick={() => {
                              setResolutionStrategy(`USE_SOURCE_${String.fromCharCode(65+i)}`);
                              setCanonicalDraft(source.content);
                            }}
                            className="w-full py-3 bg-white/5 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:bg-brand-500 group-hover:text-white transition-all shadow-xl"
                          >
                            Accept Variant {String.fromCharCode(65 + i)}
                          </button>
                       </div>
                    </div>
                 ))}
              </div>

              {/* Center Panel (Conflict Analysis / Resolution Interface) */}
              <div className="glass-panel p-8 rounded-[3rem] border-white/5 bg-white/[0.01] relative overflow-hidden shrink-0">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 blur-[80px]" />
                 <div className="relative flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                       <h3 className="text-xl font-bold flex items-center gap-2">
                          <Brain className="w-5 h-5 text-brand-400" />
                          Canonical Resolution Workspace
                       </h3>
                       <div className="flex gap-2">
                          <button 
                            onClick={handleAiMerge}
                            disabled={isAiMerging}
                            className="px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-brand-400 hover:bg-brand-500 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                             {isAiMerging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                             Trigger AI Merge
                          </button>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Canonical Knowledge Output (Gold Layer)</label>
                       <textarea 
                         value={canonicalDraft}
                         onChange={(e) => setCanonicalDraft(e.target.value)}
                         placeholder="Start typing your canonical resolution or select a strategy above..."
                         className="w-full h-40 bg-black/40 border border-white/10 rounded-[2rem] p-8 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-500/50 transition-all resize-none leading-relaxed"
                       />
                       <div className="flex items-center justify-between px-6 py-4 bg-white/5 rounded-2xl text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                          <div className="flex items-center gap-4">
                             <span>Strategy: <span className="text-brand-400">{resolutionStrategy || 'Manual Drafting'}</span></span>
                             <span>Length: {canonicalDraft.length} chars</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <CheckCircle2 className="w-4 h-4 text-green-500" />
                             Valid Citations Detected
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Right Audit & Impact Panel */}
           <div className="col-span-12 lg:col-span-4 flex flex-col gap-8 overflow-y-auto custom-scrollbar pr-1">
              <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01]">
                 <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-400" />
                    Conflict Impact Analysis
                 </h4>
                 <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Affected Chunks</div>
                          <div className="text-xl font-display font-medium text-white">{selectedConflict.impactAnalysis?.chunks}</div>
                       </div>
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="text-[9px] font-black text-slate-600 uppercase mb-1">Graph Entities</div>
                          <div className="text-xl font-display font-medium text-white">{selectedConflict.impactAnalysis?.graphEntities}</div>
                       </div>
                    </div>
                    <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <ShieldQuestion className="w-5 h-5 text-red-500" />
                          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Hallucination Risk</span>
                       </div>
                       <span className="text-xs font-bold text-red-500">{selectedConflict.impactAnalysis?.hallucinationRisk}</span>
                    </div>
                    
                    <div className="pt-6 border-t border-white/5">
                       <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Affected Retrieval Streams</h5>
                       <div className="space-y-3">
                          {['customer_support_v2', 'knowledge_portal_api', 'global_search_agent'].map((stream, i) => (
                              <div key={`stream-${stream}`} className="flex items-center justify-between text-[11px] group">
                                <span className="text-slate-400 group-hover:text-brand-400 transition-colors cursor-pointer italic underline">/api/v1/{stream}</span>
                                <BarChart3 className="w-3.5 h-3.5 text-slate-700" />
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01]">
                 <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-brand-400" />
                    Resolution Timeline
                 </h4>
                 <div className="space-y-6 relative ml-4">
                    <div className="absolute left-[-17px] top-1 bottom-0 w-px bg-white/10" />
                    {[
                      { ev: 'Conflict Detected', time: '12h ago', actor: 'Ingest Pipeline V2', icon: ShieldAlert, color: 'text-amber-500' },
                      { ev: 'Reviewer Assigned', time: '10h ago', actor: 'SARAH CONNOR', icon: User, color: 'text-blue-400' },
                      { ev: 'AI Analysis Complete', time: '9h ago', actor: 'Gemini 1.5 Pro', icon: Bot, color: 'text-brand-400' },
                      { ev: 'Draft Resolution Started', time: 'Recently', actor: 'YOU', icon: GitBranch, color: 'text-green-500' },
                    ].map((item, i) => (
                        <div key={`timeline-${item.ev}`} className="relative group">
                          <div className={cn(
                             "absolute left-[-22px] top-1 w-2.5 h-2.5 rounded-full border-4 border-[#050505] transition-all group-hover:scale-150",
                             item.color.replace('text-', 'bg-')
                          )} />
                          <div className="flex justify-between items-start">
                             <div>
                                <h5 className={cn("text-[11px] font-bold uppercase tracking-tight", item.color)}>{item.ev}</h5>
                                <p className="text-[10px] text-slate-500 mt-0.5">{item.actor}</p>
                             </div>
                             <span className="text-[9px] font-mono text-slate-600">{item.time}</span>
                          </div>
                       </div>
                    ))}
                 </div>
                 <div className="mt-8 flex gap-2">
                    <input type="text" placeholder="Add annotation..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] focus:outline-none" />
                    <button className="p-2 bg-brand-500 text-white rounded-xl">
                       <MessageSquare className="w-4 h-4" />
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const DiscardDrawerContent = () => (
    <div className="p-10 text-center space-y-8">
      <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500 shadow-lg shadow-red-500/10">
         <Trash2 className="w-10 h-10" />
      </div>
      <div>
        <h3 className="text-3xl font-display font-medium text-white mb-4">Purge Resolution?</h3>
        <p className="text-slate-500 text-sm leading-relaxed mx-auto max-w-sm italic">
          This action will revert all draft changes to the <b className="text-white">{selectedConflict?.target}</b> canonical model. Semantic annotations and merge outcomes will be permanently purged from the Gold Layer.
        </p>
      </div>
      <div className="space-y-4 pt-6">
         <button 
           onClick={() => {
             setCanonicalDraft('');
             setResolutionStrategy(null);
             setShowDiscardDrawer(false);
           }}
           className="w-full py-4 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-red-600/20 hover:bg-red-700 transition-all"
         >
            Confirm Destructive Purge
         </button>
         <button 
           onClick={() => setShowDiscardDrawer(false)}
           className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all underline decoration-white/10 underline-offset-4"
         >
            Retain Workspace State
         </button>
      </div>
    </div>
  );

  const PublishWizardContent = () => (
    <div className="flex flex-col h-full bg-[#01030a] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="flex justify-center items-center mb-16">
             <div className="flex items-center gap-12">
                {[1, 2, 3].map(step => (
                   <div key={step} className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black transition-all",
                        publishStep === step ? "bg-brand-500 text-white shadow-xl shadow-brand-500/30 scale-110" : 
                        publishStep > step ? "bg-green-500/20 text-green-500" : "bg-white/5 text-slate-700"
                      )}>
                        {publishStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                      </div>
                      <div className="hidden md:block">
                         <div className={cn("text-[9px] font-black uppercase tracking-widest mb-0.5", publishStep === step ? "text-brand-400" : "text-slate-600")}>
                           {step === 1 ? 'Validation' : step === 2 ? 'Impact' : 'Publish'}
                         </div>
                      </div>
                      {step < 3 && <div className="w-8 h-px bg-white/10" />}
                   </div>
                ))}
             </div>
          </div>

          <div className="min-h-[400px]">
             {publishStep === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                   <div className="text-center mb-10">
                      <h2 className="text-4xl font-display font-medium mb-3 italic">Integrity Verification</h2>
                      <p className="text-slate-500 uppercase text-[10px] font-black tracking-[0.4em]">Final checks before canonical ingestion</p>
                   </div>
                   <div className="grid grid-cols-1 gap-4 max-w-xl mx-auto">
                      {[
                        { label: 'Metadata Enrichment', status: 'PASS', desc: 'All mandatory governance tags populated.' },
                        { label: 'Security Context', status: 'PASS', desc: 'Classification matches enterprise baseline.' },
                        { label: 'LLM Citations', status: 'PASS', desc: 'Every claim mapped to a source variant.' },
                        { label: 'Semantic Consistency', status: 'PASS', desc: 'No internal logical contradictions found.' },
                      ].map((check, i) => (
                          <div key={`integrity-${check.label}`} className="p-6 bg-white/5 border border-white/5 rounded-3xl flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                               <Check className="w-5 h-5" />
                            </div>
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-white">{check.label}</span>
                                  <span className="text-[8px] font-black bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded uppercase">{check.status}</span>
                               </div>
                               <p className="text-[10px] text-slate-500 italic">{check.desc}</p>
                            </div>
                         </div>
                      ))}
                   </div>
                </motion.div>
             )}

             {publishStep === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                   <div className="text-center mb-10">
                      <h2 className="text-4xl font-display font-medium mb-3 italic">System Impact Audit</h2>
                      <p className="text-slate-500 uppercase text-[10px] font-black tracking-[0.4em]">Propagating knowledge through neural graph</p>
                   </div>
                   <div className="grid grid-cols-3 gap-6">
                      <div className="p-8 bg-brand-500/5 border border-brand-500/20 rounded-[2.5rem] text-center space-y-4">
                         <Cpu className="w-10 h-10 text-brand-400 mx-auto" />
                         <div>
                            <div className="text-3xl font-display font-medium leading-none">1.2B</div>
                            <div className="text-[10px] font-black text-slate-600 uppercase mt-2">Tokens Affected</div>
                         </div>
                      </div>
                      <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] text-center space-y-4">
                         <Network className="w-10 h-10 text-purple-400 mx-auto" />
                         <div>
                            <div className="text-3xl font-display font-medium leading-none">42</div>
                            <div className="text-[10px] font-black text-slate-600 uppercase mt-2">Graph Relations</div>
                         </div>
                      </div>
                      <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] text-center space-y-4">
                         <Zap className="w-10 h-10 text-amber-400 mx-auto" />
                         <div>
                            <div className="text-3xl font-display font-medium leading-none">0.02c</div>
                            <div className="text-[10px] font-black text-slate-600 uppercase mt-2">Est. Rerank Cost</div>
                         </div>
                      </div>
                   </div>
                   <div className="p-6 bg-brand-500/10 border border-brand-500/20 rounded-[2.5rem] flex items-center gap-6 max-w-2xl mx-auto">
                      <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-500/30">
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                         <div className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">Knowledge Refresh Policy</div>
                         <div className="text-xs font-bold text-white mb-2">Continuous Incremental Propagation (AUTO)</div>
                         <Progress value={85} className="h-1 bg-white/10" />
                      </div>
                      <div className="text-xs font-mono font-bold text-brand-400">85% Ready</div>
                   </div>
                </motion.div>
             )}

             {publishStep === 3 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-10 text-center mx-auto max-w-2xl">
                   <div className="w-32 h-32 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mb-10 shadow-[0_0_100px_rgba(34,197,94,0.15)] group">
                      <ShieldCheck className="w-16 h-16 text-green-500 group-hover:scale-110 transition-transform" />
                   </div>
                   <h2 className="text-4xl font-display font-medium italic mb-6">Commit to Gold Layer</h2>
                   <p className="text-slate-500 mb-12 text-sm leading-relaxed">
                     You are about to authorize the publication of this canonical knowledge. This will instantly refresh retrieval indices across all active agents and production endpoints.
                   </p>
                   <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      <div className="p-5 bg-white/5 border border-white/5 rounded-3xl group cursor-pointer hover:bg-brand-500/10 hover:border-brand-500/40 transition-all">
                         <div className="flex items-center gap-3 mb-2">
                            <div className="p-1 bg-brand-500/20 rounded text-brand-400"><Layers className="w-3.5 h-3.5" /></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Environment</span>
                         </div>
                         <div className="text-sm font-bold text-white">Production (Stable)</div>
                      </div>
                      <div className="p-5 bg-white/5 border border-white/5 rounded-3xl group cursor-pointer hover:bg-brand-500/10 hover:border-brand-500/40 transition-all">
                         <div className="flex items-center gap-3 mb-2">
                            <div className="p-1 bg-purple-500/20 rounded text-purple-400"><MessageSquare className="w-3.5 h-3.5" /></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Notifications</span>
                         </div>
                         <div className="text-sm font-bold text-white">Alert Affected Ops</div>
                      </div>
                   </div>
                </motion.div>
             )}
          </div>
      </div>

      <div className="p-12 border-t border-white/5 bg-[#02040a] flex gap-4 relative z-10">
         {publishStep > 1 && (
            <button 
              onClick={() => setPublishStep(publishStep - 1)}
              className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all shadow-xl"
            >
               Previous Audit
            </button>
         )}
         <button 
           onClick={() => {
              if (publishStep < 3) setPublishStep(publishStep + 1);
              else {
                 setShowPublishDrawer(false);
                 setView('LIST');
              }
           }}
           className="flex-1 py-4 bg-brand-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/40 flex items-center justify-center gap-3"
         >
            {publishStep === 3 ? 'Finalize & Propagate Knowledge' : 'Validate Semantic Continuity'}
            {publishStep !== 3 && <ArrowRight className="w-4 h-4" />}
         </button>
      </div>
    </div>
  );

  const handleAiMerge = () => {
    setIsAiMerging(true);
    setResolutionStrategy('AI_HYBRID_SYNTHESIS');
    setTimeout(() => {
      if (selectedConflict) {
        const merged = `// CANONICAL SYNTHESIS BY GEMINI 1.5 PRO\n// STRATEGY: SEMANTIC RECONCILIATION\n\n- Customers are eligible for a full refund within 30 business days of original purchase date.\n- [ENTERPRISE_OVERRIDE]: EMEA Enterprise accounts may request refunds up to 45 calendar days for non-digital assets.\n- All returns must include original packaging and valid proof of purchase.`;
        setCanonicalDraft(merged);
      }
      setIsAiMerging(false);
    }, 2000);
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <AnimatePresence mode="wait">
        {view === 'LIST' ? <ListView key="list" /> : <DetailView key="detail" />}
      </AnimatePresence>

      <AnimatePresence>
        <DetailDrawer
          isOpen={showDiscardDrawer}
          onClose={() => setShowDiscardDrawer(false)}
          title="Security Governance"
          subtitle="Critical Workspace Action"
          icon={Trash2}
          size="md"
        >
          <DiscardDrawerContent />
        </DetailDrawer>

        <DetailDrawer
          isOpen={showPublishDrawer}
          onClose={() => setShowPublishDrawer(false)}
          title="Knowledge Propagation"
          subtitle={`Publishing canonical resolution for ${selectedConflict?.id}`}
          icon={GitMerge}
          size="lg"
        >
          <PublishWizardContent />
        </DetailDrawer>
      </AnimatePresence>
    </div>
  );
};
