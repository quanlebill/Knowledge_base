import React, { useState } from 'react';
import { Eye, Clock, Layers, Terminal, Network, Edit2, Database, Shield, ShieldCheck, User, FileText, Zap, ChevronRight, Search, Download, Maximize2, Sparkles, Code2, History as HistoryIcon, Archive, Check, GitCompare, RefreshCw, X, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAppState } from '../AppStateContext';
import { KnowledgeDocument, KnowledgeLayer, DocStatus } from '../types';
import { DetailDrawer } from './shared/DetailDrawer';

interface AssetDetailWorkspaceProps {
  document: KnowledgeDocument;
  activeTab?: 'PREVIEW' | 'CHUNKS' | 'LOGS' | 'TIMELINE' | 'GRAPH';
  onClose?: () => void;
  onPromote?: (doc: KnowledgeDocument) => void;
}

export const AssetDetailWorkspace = ({ 
  document, 
  activeTab = 'PREVIEW',
  onClose,
  onPromote
}: AssetDetailWorkspaceProps) => {
  const { isExpertMode } = useAppState();
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);

  const getLayerConfigs = (layer: KnowledgeLayer) => {
    switch (layer) {
      case 'BRONZE': return { title: 'Source Asset Inspector', icon: Database, color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
      case 'SILVER': return { title: 'Normalized Content Studio', icon: Edit2, color: 'text-slate-400', bgColor: 'bg-slate-400/10' };
      case 'GOLD': return { title: 'Retrieval Asset Workspace', icon: Zap, color: 'text-brand-400', bgColor: 'bg-brand-400/10' };
    }
  };

  const config = getLayerConfigs(document.layer);

  return (
    <>
      <div className="h-full flex flex-col bg-[#05091a]">
      <div className="flex-1 flex overflow-hidden">
         {/* Metadata & Controls */}
         <div className="w-80 border-r border-white/5 p-8 overflow-y-auto custom-scrollbar flex flex-col gap-8 bg-black/20">
            <section>
               <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6 flex items-center justify-between">
                  Identity & Security
                  <button onClick={() => setIsEditingMetadata(true)} className="text-brand-400 hover:underline">Edit</button>
               </h4>
               <div className="space-y-4">
                  {[
                    { label: 'Security Level', val: 'Level 4 (Confidential)', icon: Shield, color: 'text-amber-500' },
                    { label: 'Owner', val: document.author, icon: User, color: 'text-brand-400' },
                    { label: 'Source Hub', val: 'Corporate OneDrive', icon: Database, color: 'text-slate-500' },
                    { label: 'Asset Type', val: document.metadata.type || 'Document', icon: FileText, color: 'text-slate-500' },
                  ].map((it) => (
                    <div key={it.label} className="flex gap-4">
                       <it.icon className={cn("w-4 h-4 mt-0.5", it.color)} />
                       <div>
                          <div className="text-[10px] text-slate-500 font-bold mb-0.5">{it.label}</div>
                          <div className="text-xs text-white font-medium">{it.val}</div>
                       </div>
                    </div>
                  ))}
               </div>
            </section>

            <section>
               <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6">Pipeline Compliance</h4>
               <div className="space-y-3">
                  {[
                    { label: 'OCR Confidence', score: 98, status: 'HIGH' },
                    { label: 'PII Check', score: 100, status: 'CLEAN' },
                    { label: 'Doc Health', score: 92, status: 'STABLE' },
                  ].map((s) => (
                    <div key={s.label} className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</span>
                          <span className="text-[10px] font-mono text-green-500 font-bold">{s.status}</span>
                       </div>
                       <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: `${s.score}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
            </section>

            {isExpertMode && (
               <div className="mt-8 space-y-6">
                 <div className="p-6 bg-black/40 border border-white/5 rounded-3xl">
                   <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-3">
                       <Code2 className="w-5 h-5 text-indigo-400" />
                       <h4 className="text-sm font-bold">Raw Config</h4>
                     </div>
                   </div>
                   <div className="bg-black/60 p-4 rounded-xl font-mono text-[10px] text-indigo-300/70 overflow-hidden text-xs">
                     <pre className="whitespace-pre-wrap">
                       {`asset_id: ${document.id}\nversion: 4.2.0-rc1\nowner_id: user_12398`}
                     </pre>
                   </div>
                 </div>
               </div>
            )}
         </div>

         {/* Main Content Area */}
         <div className="flex-1 overflow-hidden p-8">
            <AnimatePresence mode="wait">
                  {activeTab === 'PREVIEW' && (
                    <motion.div 
                      key="preview"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="h-full glass-panel rounded-[3rem] border-white/5 bg-slate-900 overflow-hidden flex flex-col shadow-2xl"
                    >
                       <div className="h-12 bg-white/5 border-b border-white/5 flex items-center justify-between px-6">
                          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
                             <span>{document.name}</span>
                             <ChevronRight className="w-3 h-3" />
                             <span>Page 1 of 42</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <button className="p-1.5 hover:bg-white/10 rounded-lg"><Search className="w-3.5 h-3.5 text-slate-400" /></button>
                             <button className="p-1.5 hover:bg-white/10 rounded-lg"><Download className="w-3.5 h-3.5 text-slate-400" /></button>
                             <button className="p-1.5 hover:bg-white/10 rounded-lg"><Maximize2 className="w-3.5 h-3.5 text-slate-400" /></button>
                          </div>
                       </div>
                       <div className="flex-1 p-12 overflow-y-auto custom-scrollbar flex justify-center bg-slate-950">
                          {document.layer === 'BRONZE' ? (
                             <div className="max-w-3xl w-full bg-white rounded-lg shadow-2xl p-16 text-slate-800 font-serif leading-relaxed min-h-[1000px]">
                                <h1 className="text-3xl font-bold mb-10 border-b pb-4 border-slate-200">{document.name}</h1>
                                <p className="mb-6">This document serves as the primary source of truth for the 2025 Global Infrastructure rollout. All vector nodes must adhere to the high-availability constraints defined in section 4.1.2.</p>
                                <div className="h-40 bg-slate-100 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 italic mb-8">
                                   [OCR Overlay Active: 98% confidence]
                                </div>
                                <p className="mb-6">The retrieval architecture utilizes a multi-cluster failover strategy. In the event of a latency spike exceeding 400ms, the agentic runtime will automatically fallback to the regional cold-storage indices.</p>
                                <div className="mb-6">Compliance requirements:
                                   <ul className="list-disc ml-6 mt-4 space-y-2">
                                      <li>Data data sovereignty must be enforced at the chunk level.</li>
                                      <li>PII masking is mandatory during the Silver layer normalization.</li>
                                      <li>Cross-tenant contamination triggers immediate kill-switch on the affected worker nodes.</li>
                                   </ul>
                                </div>
                             </div>
                          ) : document.layer === 'SILVER' ? (
                             <div className="max-w-3xl w-full space-y-8">
                                <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl text-[10px] font-black text-brand-400 uppercase tracking-widest flex items-center justify-center gap-3">
                                   <Sparkles className="w-4 h-4" /> AI-Assisted Normalization Active
                                </div>
                                <div className="font-mono text-xs text-slate-400 p-8 bg-black/40 rounded-[2rem] border border-white/5 leading-relaxed">
                                   <span className="text-cyan-400"># Global Infrastructure Roadmap 2025</span><br/><br/>
                                   <span className="text-slate-600">## Executive Summary</span><br/>
                                   Primary guidance for AI node deployment across Tier-1 regions.<br/><br/>
                                   <span className="text-slate-600">## High Availability Constraints</span><br/>
                                   - Multi-cluster failover required.<br/>
                                   - Latency threshold: 400ms.<br/>
                                   - Regional fallback: Active.<br/><br/>
                                   <span className="text-slate-600">## Compliance Matrix</span><br/>
                                   | Requirement | Implementation | Status |<br/>
                                   | :--- | :--- | :--- |<br/>
                                   | Sovereignty | Chunk-level | **Verified** |<br/>
                                   | PII Masking | Silver Transform | **Auto** |
                                </div>
                             </div>
                          ) : (
                             <div className="w-full flex-col gap-8 flex items-center justify-center h-full">
                                <div className="w-40 h-40 rounded-full border-4 border-brand-500 border-t-transparent animate-spin flex items-center justify-center">
                                   <div className="w-32 h-32 rounded-full border-4 border-amber-500 border-b-transparent animate-spin-reverse" />
                                </div>
                                <div className="text-center">
                                   <h3 className="text-2xl font-display font-bold text-white mb-2">Vectorized Node</h3>
                                   <p className="text-slate-500">Retrieving 420 chunks and 1,842 graph relations...</p>
                                </div>
                             </div>
                          )}
                       </div>
                    </motion.div>
                  )}

                  {activeTab === 'CHUNKS' && (
                    <motion.div key="chunks" className="h-full flex gap-10">
                       <div className="flex-1 glass-panel rounded-[3rem] border-white/5 overflow-hidden flex flex-col bg-black/10">
                          <div className="p-6 border-b border-white/10 flex justify-between items-center">
                             <h4 className="text-sm font-bold flex items-center gap-2">
                                <Layers className="w-4 h-4 text-brand-400" />
                                Chunk Manifest
                             </h4>
                             <div className="flex gap-2">
                                <Search className="w-4 h-4 text-slate-500 mr-2" />
                                <span className="text-[10px] font-mono text-slate-600 tracking-widest">1,240 OBJECTS</span>
                             </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                             {[...Array(10)].map((_, i) => (
                                <div key={`chunk-${842 + i}`} className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-brand-500/40 transition-all cursor-pointer group">
                                   <div className="flex justify-between mb-3 text-[10px] font-mono">
                                      <span className="text-slate-600 tracking-widest">CHUNK_ID_{842 + i}</span>
                                      <span className="text-brand-400 font-bold">SCORE: 0.942</span>
                                   </div>
                                   <p className="text-xs text-slate-400 leading-relaxed truncate">"The retrieval architecture utilizes a multi-cluster failover strategy. In the event of a latency spike exceeding 400ms..."</p>
                                   <div className="mt-4 flex gap-2">
                                      <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-bold text-slate-500 uppercase">Vector</span>
                                      <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-bold text-slate-500 uppercase">Graph</span>
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                       <div className="w-96 glass-panel rounded-[3rem] border-white/5 p-8 flex flex-col gap-8 bg-brand-500/[0.02]">
                          <div>
                             <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Chunk Inspector</h4>
                             <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-mono text-slate-300 leading-relaxed">
                                "The retrieval architecture utilizes a multi-cluster failover strategy. In the event of a latency spike exceeding 400ms, the agentic runtime will automatically fallback to the regional cold-storage indices."
                             </div>
                          </div>
                          <div className="space-y-6">
                             <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-4">Semantic Nearest Neighbors</div>
                                <div className="space-y-2">
                                   {[1, 2, 3].map(n => (
                                      <div key={n} className="flex items-center justify-between text-[10px] font-medium p-2 bg-white/5 rounded-lg border border-white/5">
                                         <span className="text-slate-400">infra_specs_v2.pdf</span>
                                         <span className="text-brand-400 font-mono">0.88</span>
                                      </div>
                                   ))}
                                </div>
                             </div>
                             <div className="pt-6 border-t border-white/5">
                                <button className="w-full py-3 bg-brand-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-600 transition-all flex items-center justify-center gap-2 shadow-xl shadow-brand-500/20">
                                   Simulate Retrieval
                                   <Zap className="w-4 h-4" />
                                </button>
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  )}

                  {activeTab === 'LOGS' && (
                    <motion.div key="logs" className="h-full glass-panel rounded-[3rem] border-white/5 bg-black/40 overflow-hidden flex flex-col">
                       <div className="p-6 border-b border-white/10 flex justify-between bg-white/[0.02]">
                          <div className="flex items-center gap-3">
                             <Terminal className="w-5 h-5 text-brand-400" />
                             <h4 className="text-sm font-bold">Pipeline Execution Logs</h4>
                          </div>
                          <div className="flex gap-2">
                             <button className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-slate-500 uppercase tracking-widest">Export JSON</button>
                          </div>
                       </div>
                       <div className="flex-1 p-8 overflow-y-auto space-y-4 font-mono text-[11px] leading-relaxed custom-scrollbar">
                          {[
                            { t: '12:04:22', lvl: 'INFO', msg: 'Initializing ingestion for document Global_Refund_Policy_2025.pdf', color: 'text-blue-400' },
                            { t: '12:04:24', lvl: 'INFO', msg: 'OCR processing started on worker-node-42', color: 'text-slate-400' },
                            { t: '12:04:30', lvl: 'SUCCESS', msg: 'OCR extraction complete. Identified 4,821 characters with 98% confidence', color: 'text-green-500' },
                            { t: '12:04:31', lvl: 'DEBUG', msg: 'Cleaning redundant whitespace and metadata headers', color: 'text-slate-500' },
                            { t: '12:04:32', lvl: 'INFO', msg: 'Starting PII scan (LLM-based detection)', color: 'text-blue-400' },
                            { t: '12:04:35', lvl: 'WARN', msg: 'Found potential email address in metadata field "author_mail". Auto-masking...', color: 'text-amber-500' },
                            { t: '12:04:38', lvl: 'SUCCESS', msg: 'Pipeline stage BRONZE -> COMPLETED', color: 'text-brand-400 font-bold' },
                          ].map((log) => (
                            <div key={`${log.t}-${log.lvl}`} className="flex gap-4 group">
                               <span className="text-slate-600 shrink-0">{log.t}</span>
                               <span className={cn("shrink-0 font-black", log.color)}>[{log.lvl}]</span>
                               <span className="text-slate-300">{log.msg}</span>
                            </div>
                          ))}
                       </div>
                    </motion.div>
                  )}

                  {activeTab === 'TIMELINE' && (
                    <motion.div key="timeline" className="h-full flex gap-10">
                       <div className="flex-1 glass-panel rounded-[3rem] border-white/5 bg-black/10 overflow-hidden flex flex-col">
                          <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                             <div>
                                <h4 className="text-sm font-bold flex items-center gap-2">
                                   <HistoryIcon className="w-4 h-4 text-brand-400" />
                                   Enterprise Version Control
                                </h4>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Immutable Ledger & State History</p>
                             </div>
                             <div className="flex gap-2">
                                <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
                                   View Audit Log
                                </button>
                             </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar relative">
                             <div className="absolute left-[59px] top-10 bottom-10 w-px bg-white/10" />
                             {[
                               { ver: 'v4.2.0', date: 'Today, 12:04', title: 'Asset Promoted to Gold', actor: 'System (Connector Sync)', icon: Database, color: 'border-brand-500 text-brand-500', current: true },
                               { ver: 'v4.1.2', date: 'Today, 10:30', title: 'Manual Metadata Override', actor: 'Alex Rivera', icon: Edit2, color: 'border-indigo-500 text-indigo-500' },
                               { ver: 'v4.1.0', date: 'Yesterday, 18:00', title: 'Vectorization Complete', actor: 'Worker Fleet Beta', icon: Cpu, color: 'border-green-500 text-green-500' },
                               { ver: 'v4.0.0', date: 'Yesterday, 14:22', title: 'Initial Bronze Invalidation', actor: 'System Auto-Retire', icon: Archive, color: 'border-slate-500 text-slate-500' }
                             ].map((evt) => (
                                <div key={evt.ver} className="relative pl-20 group">
                                   <div className={cn(
                                      "absolute left-[50px] top-0 w-5 h-5 rounded-full border-2 bg-[#050505] flex items-center justify-center z-10 transition-transform group-hover:scale-125 shadow-lg",
                                      evt.color,
                                      evt.current && "shadow-[0_0_15px_rgba(2,115,199,0.4)]"
                                   )}>
                                      {evt.current ? <Check className="w-3 h-3" /> : (evt.icon && <evt.icon className="w-2.5 h-2.5" />)}
                                   </div>
                                   <div className="flex justify-between items-start">
                                      <div>
                                         <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono font-bold text-slate-500">{evt.ver}</span>
                                            <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">{evt.date}</span>
                                            {evt.current && <span className="px-1.5 py-0.5 bg-brand-500/10 text-brand-400 text-[8px] font-black rounded border border-brand-500/20 uppercase tracking-widest">Active</span>}
                                         </div>
                                         <div className="text-sm font-bold text-white mt-1 group-hover:text-brand-400 transition-colors cursor-pointer">{evt.title}</div>
                                         <div className="text-xs text-slate-500 mt-1">Authorized by: <span className="text-slate-300 font-bold">{evt.actor}</span></div>
                                      </div>
                                      {!evt.current && (
                                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:text-white hover:bg-white/10">
                                               <GitCompare className="w-3.5 h-3.5" />
                                               Compare
                                            </button>
                                            <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[9px] font-black uppercase text-indigo-400 hover:text-white hover:bg-indigo-500">
                                               <RefreshCw className="w-3.5 h-3.5" />
                                               Rollback
                                            </button>
                                         </div>
                                      )}
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                       <div className="w-80 space-y-6">
                          <div className="glass-panel p-6 rounded-[2rem] border-white/5 bg-white/[0.01]">
                             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Version Statistics</h4>
                             <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                   <div className="text-[10px] font-bold text-slate-600 uppercase">State Drift</div>
                                   <div className="text-xs font-mono font-bold text-green-500">None Detected</div>
                                </div>
                                <div className="flex justify-between items-end">
                                   <div className="text-[10px] font-bold text-slate-600 uppercase">Total Revisions</div>
                                   <div className="text-xs font-mono font-bold text-white">42</div>
                                </div>
                                <div className="flex justify-between items-end">
                                   <div className="text-[10px] font-bold text-slate-600 uppercase">Last Verification</div>
                                   <div className="text-xs font-mono font-bold text-slate-400">4m ago</div>
                                </div>
                             </div>
                          </div>
                          
                          <div className="glass-panel p-6 rounded-[2rem] border-white/5 bg-white/[0.01]">
                             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Storage Lineage</h4>
                             <div className="space-y-4">
                                {[
                                   { label: 'S3 Source', path: 's3://bucket/docs/...', icon: Database },
                                   { label: 'Vector Store', path: 'pinecone.idx.v2', icon: Layers },
                                   { label: 'Graph DB', path: 'neo4j::node_842', icon: Network },
                                ].map((item) => (
                                   <div key={item.label} className="flex gap-3 items-start">
                                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                                         <item.icon className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="overflow-hidden">
                                         <div className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{item.label}</div>
                                         <div className="text-[10px] font-mono text-slate-400 truncate">{item.path}</div>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  )}

                  {activeTab === 'GRAPH' && (
                    <motion.div key="graph" className="h-full glass-panel rounded-[3rem] border-white/5 bg-[#010310] relative overflow-hidden flex items-center justify-center">
                       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(12,145,235,0.05)_0%,transparent_70%)]" />
                       <div className="relative z-10 flex flex-col items-center">
                          <div className="relative">
                             <div className="w-24 h-24 rounded-full bg-brand-500/20 border-2 border-brand-500 flex items-center justify-center shadow-[0_0_50px_rgba(12,145,235,0.3)] animate-pulse">
                                <Network className="w-10 h-10 text-brand-400" />
                             </div>
                             {/* Mock Nodes around */}
                             {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                                <motion.div 
                                  key={`node-${i}`}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: i * 0.1 }}
                                  className="absolute w-4 h-4 rounded-full bg-white/10 border border-white/20"
                                  style={{ 
                                    transform: `rotate(${deg}deg) translate(120px) rotate(-${deg}deg)` 
                                  }}
                                />
                             ))}
                             {/* Connection Lines (SVG) */}
                             <svg className="absolute inset-[-150px] w-[400px] h-[400px] pointer-events-none opacity-20">
                                <circle cx="200" cy="200" r="120" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
                                {[0, 60, 120, 180, 240, 300].map(deg => {
                                   const rad = (deg * Math.PI) / 180;
                                   const x2 = 200 + 120 * Math.cos(rad);
                                   const y2 = 200 + 120 * Math.sin(rad);
                                   return <line key={deg} x1="200" y1="200" x2={x2} y2={y2} stroke="white" strokeWidth="1" />;
                                })}
                             </svg>
                          </div>
                          <div className="mt-12 text-center">
                             <h4 className="text-xl font-bold text-white mb-2 tracking-tight">Semantic Lineage Map</h4>
                             <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                                Visualizing relational nodes and edge weights across the GlobalCorp knowledge graph. 
                                <span className="text-brand-400 font-bold block mt-2">1,842 Relations Identified</span>
                             </p>
                          </div>
                       </div>
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>
         </div>
      </div>

      <DetailDrawer
        isOpen={isEditingMetadata}
        onClose={() => setIsEditingMetadata(false)}
        title="Edit Knowledge Metadata"
        subtitle={document.name}
        icon={Edit2}
        size="md"
        footer={
          <div className="flex gap-3">
             <button onClick={() => setIsEditingMetadata(false)} className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-slate-400">
                Discard
             </button>
             <button className="px-8 py-2.5 bg-brand-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-brand-500/20">
                Commit Changes
             </button>
          </div>
        }
      >
        <div className="p-10 space-y-8">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Document Title</label>
              <input type="text" defaultValue={document.name} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-brand-500/50" />
           </div>
           
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Security Classification</label>
              <select className="w-full bg-[#050505] border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-brand-500/50 appearance-none text-white">
                 <option>Level 1 (Public)</option>
                 <option>Level 2 (Internal)</option>
                 <option>Level 3 (Restricted)</option>
                 <option>Level 4 (Confidential)</option>
                 <option>Level 5 (Highly Confidential)</option>
              </select>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Retention Policy</label>
              <div className="flex gap-4">
                 {['30 Days', '1 Year', '7 Years', 'Permanent'].map((p) => (
                    <button key={p} className={cn(
                       "flex-1 py-3 px-4 rounded-xl text-[10px] font-bold uppercase transition-all border",
                       p === '1 Year' ? "bg-brand-500/10 border-brand-500/40 text-brand-400" : "bg-white/5 border-white/10 text-slate-500 hover:border-white/20"
                    )}>{p}</button>
                 ))}
              </div>
           </div>

           <div className="p-6 bg-slate-900 border border-white/5 rounded-3xl space-y-4">
              <div className="flex items-center gap-2 text-slate-400">
                 <ShieldCheck className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Governance Impact</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed italic">
                Updating metadata will trigger a <b>Re-compliance Audit</b> event in the system logs. All subsequent retrieval requests will adhere to the new security classification.
              </p>
           </div>
        </div>
      </DetailDrawer>
    </>
  );
};

const TooltipLabel = ({ label }: { label: string }) => (
  <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-[10px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all pointer-events-none z-50 shadow-2xl">
     {label}
  </div>
);
