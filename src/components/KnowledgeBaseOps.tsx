import React, { useState } from 'react';
import { 
  Database, 
  Layers, 
  Settings, 
  Settings2,
  Zap, 
  Search, 
  Grid3X3, 
  History as HistoryIcon, 
  FileText,
  ShieldCheck,
  Activity,
  Plus,
  GitBranch,
  Network,
  Cpu,
  Share2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MoreVertical,
  Filter,
  BarChart2,
  ChevronRight,
  ArrowRight,
  Terminal,
  RefreshCw,
  Eye,
  Edit3,
  Trash2,
  Archive,
  ArrowUpRight,
  MessageSquare,
  Sparkles,
  Command,
  Maximize2,
  ChevronDown,
  ArrowDownToLine,
  Save,
  RotateCcw,
  Check,
  X,
  Play,
  Pause,
  StopCircle,
  FileCode,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { KnowledgeLayer, DocStatus, KnowledgeDocument, IngestionJob, KBConnector } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line
} from 'recharts';
import { ConnectorManager } from './ConnectorManager';
import { IngestionWizard } from './IngestionWizard';
import { AssetDetailWorkspace } from './AssetDetailWorkspace';

// --- MOCK DATA ---
const DOCS: KnowledgeDocument[] = [
  { id: 'd1', name: 'Global_Refund_Policy_2025.pdf', layer: 'BRONZE', status: 'PUBLISHED', version: 'v3.1', lastUpdated: '2h ago', author: 'System', metadata: { tenant: 'GlobalCorp', type: 'PDF' } },
  { id: 'd2', name: 'H1_Cloud_Architecture_Specs', layer: 'SILVER', status: 'EMBEDDING', version: 'v1.4', lastUpdated: '10m ago', author: 'ARivera', metadata: { tenant: 'GlobalCorp', type: 'Markdown' } },
  { id: 'd3', name: 'Security_Compliance_Framework', layer: 'GOLD', status: 'PUBLISHED', version: 'v2.0', lastUpdated: '1d ago', author: 'Compliance_Bot', metadata: { tenant: 'GlobalCorp', type: 'Vector Index' } },
  { id: 'd4', name: 'Operational_Manual_Draft.docx', layer: 'BRONZE', status: 'FAILED', version: 'v1.0', lastUpdated: '5h ago', author: 'JSmith', metadata: { tenant: 'Logistics_Sub', type: 'DOCX' } },
  { id: 'd5', name: 'Entity_Map_v2', layer: 'GOLD', status: 'PUBLISHED', version: 'v2.1', lastUpdated: '4h ago', author: 'Graph_Sync', metadata: { tenant: 'GlobalCorp', type: 'Graph Nodes' } },
];

const JOBS: IngestionJob[] = [
  { id: 'j1', name: 'Embedding: Product Catalog V5', startTime: '10:30 AM', progress: 75, status: 'RUNNING', type: 'EMBEDDING', priority: 'HIGH' },
  { id: 'j2', name: 'OCR: Archives_Folder_14', startTime: '09:45 AM', progress: 100, status: 'COMPLETED', type: 'OCR', priority: 'NORMAL' },
  { id: 'j3', name: 'Graph Extraction: Entity_Map_Nexus', startTime: '11:15 AM', progress: 12, status: 'RUNNING', type: 'GRAPH_SYNC', priority: 'HIGH' },
];

// --- SUB-COMPONENTS ---

const StatusBadge = ({ status }: { status: DocStatus }) => {
  const styles: Record<DocStatus, string> = {
    RAW: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    OCR_COMPLETE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    CHUNKING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    EMBEDDING: "bg-brand-500/10 text-brand-400 border-brand-500/20",
    GRAPH_EXTRACTING: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    PUBLISHED: "bg-green-500/10 text-green-400 border-green-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
    DEPRECATED: "bg-white/5 text-slate-500 border-white/10",
    CLEANED: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    ARCHIVED: "bg-slate-700/10 text-slate-500 border-slate-700/20",
    PENDING_APPROVAL: "bg-pink-500/10 text-pink-400 border-pink-500/20"
  };

  return (
    <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold tracking-tight uppercase border", styles[status])}>
      {status.replace('_', ' ')}
    </span>
  );
};

const LayerBadge = ({ layer }: { layer: KnowledgeLayer }) => {
  const styles: Record<KnowledgeLayer, string> = {
    BRONZE: "text-amber-600 border-amber-600/30 bg-amber-600/5",
    SILVER: "text-slate-400 border-slate-400/30 bg-slate-400/5",
    GOLD: "text-brand-400 border-brand-400/30 bg-brand-400/5 shadow-[0_0_10px_rgba(12,145,235,0.2)]"
  };

  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase border tracking-widest", styles[layer])}>
      {layer}
    </span>
  );
};

const PipelineStep = ({ label, status, icon: Icon, delay = 0 }: any) => (
  <motion.div 
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="flex flex-col items-center gap-2 group"
  >
    <div className={cn(
      "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 relative",
      status === 'complete' ? "bg-green-500/10 text-green-500 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]" :
      status === 'active' ? "bg-brand-500/20 text-brand-400 border border-brand-500/40 animate-pulse" :
      "bg-white/5 text-slate-500 border border-white/5"
    )}>
      <Icon className="w-5 h-5" />
      {status === 'complete' && (
        <div className="absolute -top-1 -right-1 bg-green-500 text-black rounded-full p-0.5">
          <CheckCircle2 className="w-2.5 h-2.5" />
        </div>
      )}
    </div>
    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter text-center group-hover:text-slate-300 transition-colors">
      {label}
    </span>
  </motion.div>
);

// --- MAIN VIEWS ---

const OverviewTab = ({ onSelectAsset }: { onSelectAsset: (doc: KnowledgeDocument) => void }) => {
  return (
    <div className="space-y-8">
      {/* Real-time Pipeline Visualization */}
      <div className="glass-panel p-8 rounded-3xl overflow-hidden relative border-white/5 shadow-2xl">
         <div className="flex justify-between items-start mb-10">
            <div>
               <h3 className="text-xl font-display font-medium flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-brand-400" />
                  Live Ingestion Pipeline
               </h3>
               <p className="text-sm text-slate-500 mt-1">Status of global knowledge processing factory</p>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-3 px-4 py-2 bg-green-500/5 border border-green-500/10 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                  <span className="text-xs font-bold text-green-500/80 uppercase tracking-tighter">Healthy</span>
               </div>
            </div>
         </div>

         <div className="flex items-center justify-between px-4 lg:px-10 py-6 relative overflow-x-auto no-scrollbar scroll-smooth">
            {/* Connection Line */}
            <div className="hidden lg:block absolute left-[8%] right-[8%] top-1/2 -translate-y-1/2 h-px bg-white/5 z-0" />
            
            <div className="flex items-center justify-between min-w-[600px] lg:min-w-0 w-full gap-8">
              <PipelineStep label="Raw Source" icon={FileText} status="complete" delay={0.1} />
              <PipelineStep label="OCR Processing" icon={Zap} status="complete" delay={0.2} />
              <PipelineStep label="Normalization" icon={Layers} status="complete" delay={0.3} />
              <PipelineStep label="Chunking" icon={Grid3X3} status="active" delay={0.4} />
              <PipelineStep label="Embedding" icon={Activity} status="idle" delay={0.5} />
              <PipelineStep label="Graph Extract" icon={Network} status="idle" delay={0.6} />
              <PipelineStep label="Index Publish" icon={ShieldCheck} status="idle" delay={0.7} />
            </div>
         </div>

         <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Throughput', val: '4.2k eps', sub: 'Documents per hour' },
              { label: 'Mean Latency', val: '840ms', sub: 'End-to-end processing' },
              { label: 'Error Rate', val: '0.04%', sub: 'Ingestion failures' },
              { label: 'Queue Depth', val: '142', sub: 'Pending operations' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{stat.label}</div>
                <div className="text-2xl font-display font-medium text-white mt-1">{stat.val}</div>
                <div className="text-[10px] text-brand-500/60 mt-1 font-mono">{stat.sub}</div>
              </div>
            ))}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-8">
           <div className="glass-panel p-8 rounded-3xl">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-lg font-bold flex items-center gap-2">
                    <HistoryIcon className="w-5 h-5 text-brand-400" />
                    Latest Knowledge Artifacts
                 </h3>
                 <button className="text-xs font-bold text-brand-400 hover:text-brand-300">View All Architecture</button>
              </div>
              <div className="space-y-4">
                 {DOCS.map(doc => (
                    <div 
                      key={doc.id} 
                      onClick={() => onSelectAsset(doc)}
                      className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-brand-500/30 transition-all cursor-pointer"
                    >
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center text-slate-400 group-hover:text-brand-400 transition-colors">
                             <FileText className="w-5 h-5" />
                          </div>
                          <div>
                             <div className="text-sm font-semibold flex items-center gap-2">
                                {doc.name}
                                <LayerBadge layer={doc.layer} />
                             </div>
                             <div className="text-[10px] text-slate-500 font-mono mt-1">
                                {doc.version} • Updated by {doc.author} {doc.lastUpdated}
                             </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <StatusBadge status={doc.status} />
                          <button className="p-1.5 text-slate-600 hover:text-slate-300">
                             <ArrowRight className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-8">
           <div className="glass-panel p-8 rounded-3xl bg-amber-500/[0.02] border-amber-500/10">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                 <AlertCircle className="w-5 h-5 text-amber-500" />
                 Knowledge Conflicts (8)
              </h3>
              <div className="space-y-3">
                 {[
                   { t: 'Semantic Duplicates', c: 12, s: 'High impact' },
                   { t: 'Conflicting Sources', c: 4, s: 'Requires approval' },
                   { t: 'Outdated Version', c: 24, s: 'Auto-deprecate failed' },
                 ].map((c, i) => (
                   <div key={`conflict-${c.t}`} className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex justify-between items-center group cursor-pointer hover:bg-amber-500/10 transition-all">
                      <div>
                         <div className="text-xs font-bold text-amber-200">{c.t}</div>
                         <div className="text-[10px] text-amber-500/60 font-mono mt-0.5">{c.s}</div>
                      </div>
                      <div className="text-xl font-display font-bold text-amber-500">{c.c}</div>
                   </div>
                 ))}
              </div>
              <button className="w-full mt-6 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-amber-500 transition-all">
                 Review Conflicts
              </button>
           </div>

           <div className="glass-panel p-8 rounded-3xl">
              <h3 className="text-lg font-bold mb-6">Embedding Model Performance</h3>
              <div className="space-y-6">
                 {[
                   { name: 'voyage-law-2', perf: 98, cost: '$0.12/1k' },
                   { name: 'text-embedding-3-small', perf: 82, cost: '$0.02/1k' },
                 ].map((m) => (
                    <div key={m.name}>
                       <div className="flex justify-between text-[11px] font-bold mb-2">
                          <span className="text-slate-400">{m.name}</span>
                          <span className="text-brand-400">{m.perf}%</span>
                       </div>
                       <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${m.perf}%` }} />
                       </div>
                       <div className="mt-1 text-[9px] text-slate-600 font-mono text-right">{m.cost}</div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const InventoryTab = ({ onSelectAsset }: { onSelectAsset: (doc: KnowledgeDocument) => void }) => {
  const [layer, setLayer] = useState<KnowledgeLayer>('BRONZE');
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);

  const getLayerFeatures = (l: KnowledgeLayer) => {
    switch (l) {
      case 'BRONZE': return { icon: HardDrive, color: 'text-amber-500', desc: 'Raw source files, OCR results, and ingestion originals.' };
      case 'SILVER': return { icon: FileCode, color: 'text-slate-400', desc: 'Normalized markdown content, metadata enriched artifacts.' };
      case 'GOLD': return { icon: Sparkles, color: 'text-brand-400', desc: 'Vectorized chunks, published indices, and graph entities.' };
    }
  };

  const feature = getLayerFeatures(layer);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6">
         <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6">
            <div className="flex p-1 bg-white/[0.03] border border-white/5 rounded-2xl overflow-x-auto no-scrollbar">
               {(['BRONZE', 'SILVER', 'GOLD'] as KnowledgeLayer[]).map(l => (
                  <button 
                    key={l}
                    onClick={() => setLayer(l)}
                    className={cn(
                      "px-4 lg:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
                      layer === l ? "bg-white/10 text-white shadow-xl shadow-black/50" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                     <div className={cn("w-2 h-2 rounded-full", l === 'BRONZE' ? 'bg-amber-500' : l === 'SILVER' ? 'bg-slate-500' : 'bg-brand-500')} />
                     {l}
                  </button>
               ))}
            </div>
            <div className="hidden md:block h-10 w-px bg-white/5" />
            <div className="flex items-center gap-4">
               <feature.icon className={cn("w-6 h-6 shrink-0", feature.color)} />
               <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-tight">{layer} LAYER</h4>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter line-clamp-1">{feature.desc}</p>
               </div>
            </div>
         </div>
         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
               <input 
                 type="text" 
                 placeholder={`Filter ${layer.toLowerCase()}...`}
                 className="w-full bg-white/5 border border-white/5 px-10 py-2.5 rounded-xl text-xs sm:w-64 focus:outline-none focus:border-brand-500/50"
               />
            </div>
            <button className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-slate-500 flex items-center justify-center">
               <Filter className="w-4 h-4" />
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="col-span-12 lg:col-span-8 order-2 lg:order-1">
            <div className="glass-panel overflow-hidden rounded-3xl border-white/5">
               <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/5">
                     <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <th className="px-8 py-4">Knowledge Resource</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Format</th>
                        <th className="px-6 py-4 text-center">Version</th>
                        <th className="px-8 py-4 text-right">Operational Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {DOCS.filter(d => d.layer === layer).map(doc => (
                        <tr 
                          key={doc.id} 
                          onClick={() => setSelectedDoc(doc)}
                          className={cn(
                             "group cursor-pointer transition-colors",
                             selectedDoc?.id === doc.id ? "bg-brand-500/5" : "hover:bg-white/[0.02]"
                          )}
                        >
                           <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                 <div className={cn(
                                    "w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:bg-brand-500/10 transition-all",
                                    selectedDoc?.id === doc.id ? "text-brand-400 bg-brand-500/10" : ""
                                 )}>
                                    <FileText className="w-5 h-5" />
                                 </div>
                                 <div>
                                    <div className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{doc.name}</div>
                                    <div className="text-[10px] text-slate-600 font-mono mt-0.5">{doc.id} • {doc.metadata.tenant}</div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-5">
                              <StatusBadge status={doc.status} />
                           </td>
                           <td className="px-6 py-5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{doc.metadata.type}</span>
                           </td>
                           <td className="px-6 py-5 text-center">
                              <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                 {doc.version}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-right">
                              <div className="flex justify-end gap-2 px-1">
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); onSelectAsset(doc); }}
                                   className="p-2 hover:bg-brand-500/20 rounded-lg text-slate-500 hover:text-brand-400 transition-all" 
                                   title="Open Inspector"
                                 >
                                    <Eye className="w-4 h-4" />
                                 </button>
                                 {layer === 'BRONZE' && (
                                    <button className="p-2 hover:bg-brand-500/20 rounded-lg text-slate-500 hover:text-brand-400 transition-all" title="OCR Reprocess">
                                       <Zap className="w-4 h-4" />
                                    </button>
                                 )}
                                 {layer === 'SILVER' && (
                                    <button className="p-2 hover:bg-brand-500/20 rounded-lg text-slate-500 hover:text-brand-400 transition-all" title="Semantic Cleanup">
                                       <Edit3 className="w-4 h-4" />
                                    </button>
                                 )}
                                 {layer === 'GOLD' && (
                                    <button className="p-2 hover:bg-brand-500/20 rounded-lg text-slate-500 hover:text-brand-400 transition-all" title="Re-index Chunk">
                                       <Activity className="w-4 h-4" />
                                    </button>
                                 )}
                                 <button className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white">
                                    <MoreVertical className="w-4 h-4" />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         <div className="col-span-12 lg:col-span-4 order-1 lg:order-2">
            <AnimatePresence mode="wait">
               {selectedDoc ? (
                  <motion.div 
                     key={selectedDoc.id}
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 20 }}
                     className="glass-panel p-8 rounded-3xl sticky top-8"
                  >
                     <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-brand-500/10 rounded-xl">
                              <Eye className="w-5 h-5 text-brand-400" />
                           </div>
                           <h3 className="text-lg font-bold">Document Inspector</h3>
                        </div>
                        <button onClick={() => setSelectedDoc(null)} className="p-1 hover:bg-white/10 rounded-full text-slate-500">
                           <X className="w-5 h-5" />
                        </button>
                     </div>

                     <div className="space-y-6">
                        <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                           <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Lineage Trace</div>
                           <div className="flex items-center justify-between relative px-2">
                              <div className="absolute left-4 right-4 h-0.5 bg-white/5 top-1/2 -translate-y-1/2" />
                              {['BRONZE', 'SILVER', 'GOLD'].map((l, i) => (
                                 <div key={l} className="relative z-10 flex flex-col items-center gap-2">
                                    <div className={cn(
                                       "w-4 h-4 rounded-full border-2",
                                       l === layer ? "bg-brand-500 border-brand-500 animate-pulse" : 
                                       i < (layer === 'BRONZE' ? 0 : layer === 'SILVER' ? 1 : 2) ? "bg-green-500 border-green-500" :
                                       "bg-[#0a0a0a] border-white/10"
                                    )} />
                                    <span className="text-[8px] font-black text-slate-500">{l}</span>
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div>
                           <h4 className="text-sm font-bold text-white mb-2">{selectedDoc.name}</h4>
                           <p className="text-xs text-slate-500 font-medium">Enterprise mapping for {selectedDoc.metadata.tenant} infrastructure.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-white/[0.03] rounded-xl border border-white/5">
                              <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Chunks</div>
                              <div className="text-xl font-display font-medium text-white">1,240</div>
                           </div>
                           <div className="p-4 bg-white/[0.03] rounded-xl border border-white/5">
                              <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-1">Retrieval Score</div>
                              <div className="text-xl font-display font-medium text-green-500">0.92</div>
                           </div>
                        </div>

                        <div className="space-y-3 pt-2">
                           <button 
                             onClick={() => onSelectAsset(selectedDoc)}
                             className="w-full py-3.5 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-brand-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                           >
                              Open Detail Studio
                              <ArrowUpRight className="w-4 h-4" />
                           </button>
                           <button className="w-full py-3 bg-white/5 border border-white/10 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all">
                              View Processing Logs
                           </button>
                        </div>

                        <div className="pt-4 border-t border-white/5 space-y-4">
                           <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-slate-500 uppercase">Version History</span>
                              <button className="text-brand-400 hover:underline flex items-center gap-1">
                                 <HistoryIcon className="w-3 h-3" />
                                 View Timeline
                              </button>
                           </div>
                           <div className="space-y-3">
                              {[
                                 { v: 'v3.1', date: '2h ago', action: 'Published to Gold' },
                                 { v: 'v3.0', date: '5h ago', action: 'Metadata Enrichment' },
                              ].map((v, i) => (
                                 <div key={v.v} className="flex gap-3 group/item cursor-help">
                                    <div className="w-px h-full bg-white/5 group-hover/item:bg-brand-500/40 relative">
                                       <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/10 group-hover/item:bg-brand-500" />
                                    </div>
                                    <div className="pb-1">
                                       <div className="text-[10px] font-bold text-slate-300">{v.v} • {v.action}</div>
                                       <div className="text-[9px] text-slate-600 font-mono">{v.date}</div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  </motion.div>
               ) : (
                  <div className="h-full min-h-[400px] border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center p-12 text-center opacity-40 group hover:opacity-100 transition-all cursor-crosshair">
                     <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-brand-500/10 transition-all">
                        <Maximize2 className="w-10 h-10 text-slate-600 group-hover:text-brand-400" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-400 mb-2">Inspector Dormant</h3>
                     <p className="text-sm text-slate-600 max-w-[200px]">Select a knowledge asset from the grid to inspect its operational lineage and performance metrics.</p>
                  </div>
               )}
            </AnimatePresence>
         </div>
      </div>
    </div>
  );
};

const PipelineOpsTab = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Quick Stats Panel */}
      <div className="grid grid-cols-4 gap-6">
         {[
            { label: 'Active Jobs', val: '12', trend: '+2', icon: Activity, color: 'text-brand-400' },
            { label: 'Ingestion Rate', val: '4.2M', trend: '84k/h', icon: Zap, color: 'text-amber-500' },
            { label: 'Sync Latency', val: '840ms', trend: '-12%', icon: Clock, color: 'text-green-500' },
            { label: 'Processing Errors', val: '0.04%', trend: 'Stable', icon: AlertCircle, color: 'text-red-500' }
         ].map((stat) => (
            <div key={stat.label} className="glass-panel p-6 rounded-3xl border-white/5 flex items-center gap-5">
               <div className={cn("p-4 rounded-2xl bg-white/[0.03]", stat.color)}>
                  <stat.icon className="w-6 h-6" />
               </div>
               <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</div>
                  <div className="text-2xl font-display font-bold text-white mt-0.5">{stat.val}</div>
                  <div className="text-[10px] font-mono text-slate-600 mt-1">{stat.trend}</div>
               </div>
            </div>
         ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
         <div className="col-span-12 glass-panel rounded-3xl overflow-hidden border-white/5 flex flex-col">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
               <h3 className="text-lg font-bold flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-brand-400" />
                  Knowledge Processing Topology
               </h3>
               <div className="flex gap-2">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                     <input type="text" placeholder="Filter pipeline jobs..." className="bg-white/5 border border-white/10 pl-9 pr-4 py-2 rounded-xl text-xs w-64 focus:outline-none focus:border-brand-500/50" />
                  </div>
                  <button className="p-2 bg-white/5 rounded-xl border border-white/5 text-slate-500 hover:bg-white/10 transition-colors">
                     <Filter className="w-4 h-4" />
                  </button>
               </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="bg-white/[0.03] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                     <tr>
                        <th className="px-8 py-4">Pipeline Step / ID</th>
                        <th className="px-6 py-4">Processing Node</th>
                        <th className="px-6 py-4">Context</th>
                        <th className="px-6 py-4">Trace Progress</th>
                        <th className="px-6 py-4">Cycle Time</th>
                        <th className="px-8 py-4 text-right">Control</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                     {JOBS.map(job => (
                        <tr key={job.id} className="group hover:bg-white/[0.01] transition-colors">
                           <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                 <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    job.status === 'RUNNING' ? 'bg-brand-500 animate-pulse' : 
                                    job.status === 'COMPLETED' ? 'bg-green-500' : 'bg-red-500'
                                 )} />
                                 <div>
                                    <div className="font-bold text-slate-200 uppercase tracking-tighter">{job.type}</div>
                                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">{job.id}</div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-5">
                              <div className="flex items-center gap-2">
                                 <Cpu className="w-3.5 h-3.5 text-slate-500" />
                                 <span className="font-mono text-slate-400">ingest-{job.id.toLowerCase()}</span>
                              </div>
                           </td>
                           <td className="px-6 py-5">
                              <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] font-bold text-slate-500 uppercase tracking-tight">V-INDEX-P0</span>
                           </td>
                           <td className="px-6 py-5 min-w-[200px]">
                              <div className="flex items-center gap-3">
                                 <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${job.progress}%` }}
                                      className={cn(
                                         "h-full transition-all duration-1000 shadow-[0_0_8px_rgba(12,145,235,0.2)]",
                                         job.status === 'COMPLETED' ? 'bg-green-500' : 'bg-brand-500'
                                      )}
                                    />
                                 </div>
                                 <span className="font-mono font-bold text-slate-400 w-8">{job.progress}%</span>
                              </div>
                           </td>
                           <td className="px-6 py-5 text-slate-500 font-mono italic">
                              12m 42s
                           </td>
                           <td className="px-8 py-5 text-right">
                              <div className="flex justify-end gap-2">
                                 <button className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all shadow-sm">
                                    <Pause className="w-3.5 h-3.5" />
                                 </button>
                                 <button className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-brand-400 transition-all">
                                    <HistoryIcon className="w-3.5 h-3.5" />
                                 </button>
                                 <button className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500 transition-all">
                                    <X className="w-3.5 h-3.5" />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};

const GraphTab = () => {
   return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
         <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
               <Network className="w-5 h-5 text-brand-400" />
               GraphRAG Intelligence Map
            </h3>
            <p className="text-sm text-slate-500">Traversing semantic relationships across distributed knowledge nodes.</p>
         </div>
         <div className="flex gap-3">
            <div className="p-1 bg-white/5 border border-white/10 rounded-xl flex">
               <button className="px-3 py-1.5 bg-white/10 text-white text-[10px] font-bold rounded-lg uppercase tracking-widest transition-all">2D View</button>
               <button className="px-3 py-1.5 text-slate-500 text-[10px] font-bold rounded-lg uppercase tracking-widest hover:text-white transition-all">3D Engine</button>
            </div>
            <button className="px-4 py-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-brand-500 hover:text-white transition-all">
               Sync Graph
            </button>
         </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-8 min-h-[600px]">
         <div className="col-span-9 glass-panel rounded-[3rem] border-white/5 relative overflow-hidden bg-[#020617]">
            {/* Mock Graph Visualization */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full border border-brand-500/40" />
                <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full border border-brand-500/20" />
                <div className="absolute bottom-1/4 right-1/4 w-24 h-24 rounded-full border border-brand-500/60" />
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="relative w-full h-full p-20">
                  {/* Mock Nodes */}
                  {[
                    { t: 'Entity: GlobalCorp', x: '20%', y: '15%', c: 'bg-brand-500' },
                    { t: 'Doc: Refund_Policy', x: '45%', y: '40%', c: 'bg-green-500' },
                    { t: 'Concept: Compliance', x: '70%', y: '25%', c: 'bg-amber-500' },
                    { t: 'User: ARivera', x: '35%', y: '75%', c: 'bg-purple-500' },
                    { t: 'Entity: Cloud_Arch', x: '65%', y: '65%', c: 'bg-blue-500' },
                  ].map((node, i) => (
                    <motion.div 
                      key={node.t}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      style={{ left: node.x, top: node.y }}
                      className="absolute group cursor-pointer"
                    >
                       <div className={cn("w-4 h-4 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] mb-2", node.c)} />
                       <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-[10px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                          {node.t}
                       </div>
                    </motion.div>
                  ))}
               </div>
            </div>

            <div className="absolute bottom-8 left-8 p-6 glass-panel rounded-3xl bg-black/40 border-white/10">
               <div className="flex gap-6">
                  <div>
                     <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Entities</div>
                     <div className="text-xl font-display font-bold">1,842</div>
                  </div>
                  <div className="w-px h-8 bg-white/10 mt-2" />
                  <div>
                     <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Relations</div>
                     <div className="text-xl font-display font-bold text-brand-400">12,504</div>
                  </div>
                  <div className="w-px h-8 bg-white/10 mt-2" />
                  <div>
                     <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Clusters</div>
                     <div className="text-xl font-display font-bold text-amber-500">84</div>
                  </div>
               </div>
            </div>

            <div className="absolute top-8 right-8 flex flex-col gap-2">
                <button className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-slate-400 hover:text-white shadow-2xl">
                   <Maximize2 className="w-5 h-5" />
                </button>
                <button className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-slate-400 hover:text-white shadow-2xl">
                   <Settings2 className="w-5 h-5" />
                </button>
            </div>
         </div>

         <div className="col-span-3 flex flex-col gap-6">
            <div className="glass-panel p-6 rounded-[2.5rem] bg-amber-500/[0.02] border-amber-500/10">
               <h4 className="text-xs font-black flex items-center gap-2 mb-4 uppercase tracking-[0.2em]">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  AI Recommendations
               </h4>
               <div className="space-y-3">
                  {[
                    { t: 'Merge Entity', d: '"Global_Corp" and "GlobalCorp" likely duplicate', type: 'CONFLICT' },
                    { t: 'New Relation', d: 'Connect "Security" to "Compliant_Framework_v2"', type: 'SUGGESTION' }
                  ].map((rec, i) => (
                    <div key={`rec-${rec.t}`} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-brand-500/30 transition-all cursor-pointer">
                       <div className="text-[10px] font-black text-brand-400 mb-1">{rec.t}</div>
                       <p className="text-[10px] text-slate-500 leading-tight">{rec.d}</p>
                       <div className="flex gap-2 mt-3">
                          <button className="flex-1 py-1 bg-brand-500 text-white rounded-lg text-[9px] font-bold uppercase">Resolve</button>
                          <button className="px-2 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-slate-500">Hide</button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="flex-1 glass-panel p-8 rounded-[2.5rem]">
               <h4 className="text-xs font-black flex items-center gap-2 mb-6 uppercase tracking-[0.2em]">
                  <Search className="absolute right-8 top-8 w-4 h-4 text-slate-500" />
                  Graph Explorer
               </h4>
               <div className="space-y-4">
                  {[
                    { l: 'Entity Strength', v: 84, c: 'bg-green-500' },
                    { l: 'Semantic Density', v: 42, c: 'bg-brand-500' },
                    { l: 'Traversal Latency', v: 67, c: 'bg-amber-500' },
                  ].map((m) => (
                    <div key={m.l}>
                       <div className="flex justify-between text-[10px] font-bold mb-1.5">
                          <span className="text-slate-500 uppercase">{m.l}</span>
                          <span className="text-white">{m.v}%</span>
                       </div>
                       <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", m.c)} style={{ width: `${m.v}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
               <div className="mt-8 pt-8 border-t border-white/5">
                  <div className="text-[10px] font-bold text-slate-600 mb-4 uppercase tracking-widest">Active Filters</div>
                  <div className="flex flex-wrap gap-2">
                     {['High-Confidence', 'Global-Scope', 'Verified-Only'].map(f => (
                        <span key={f} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-bold text-slate-400">{f}</span>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
   );
};

const PlaygroundTab = () => {
   return (
      <div className="h-[700px] grid grid-cols-12 gap-8 animate-in fade-in duration-500">
         {/* Left Panel: Query & Control */}
         <div className="col-span-3 glass-panel rounded-[3rem] p-8 flex flex-col gap-8 bg-black/20">
            <div className="space-y-2">
               <h3 className="text-lg font-bold flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-amber-500" />
                  RAG Debugger
               </h3>
               <p className="text-xs text-slate-500">Simulate retrieval over multi-Tenant indices.</p>
            </div>

            <div className="flex-1 space-y-6">
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Target Tenant</label>
                  <button className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white">
                     GlobalCorp
                     <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Retrieval Strategy</label>
                  <div className="grid grid-cols-2 gap-2">
                     {['Hybrid', 'Vector', 'BM25', 'Graph'].map(strat => (
                        <button key={strat} className={cn(
                           "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                           strat === 'Hybrid' ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20" : "bg-white/5 text-slate-500 hover:text-white"
                        )}>{strat}</button>
                     ))}
                  </div>
               </div>

               <div className="space-y-3">
                  <div className="flex justify-between items-center">
                     <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Similarity Threshold</label>
                     <span className="text-[10px] font-mono text-brand-400">0.82</span>
                  </div>
                  <input type="range" className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-brand-500" defaultValue={82} />
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Prompt Engineering</label>
                  <textarea 
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-slate-300 focus:outline-none focus:border-brand-500/50 transition-all font-mono"
                    placeholder="Enter meta-retrieval instructions..."
                    defaultValue="Retrieve only high-confidence compliance nodes related to SEC filings."
                  />
               </div>
            </div>

            <button className="w-full py-4 bg-brand-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-brand-500/30 hover:bg-brand-600 transition-all flex items-center justify-center gap-3">
               Execute Retrieval
               <Play className="w-4 h-4" />
            </button>
         </div>

         {/* Center Panel: Results */}
         <div className="col-span-6 flex flex-col gap-6">
            <div className="glass-panel rounded-[3rem] p-8 flex-1 bg-black/40 border-white/5 flex flex-col overflow-hidden">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="p-2 bg-green-500/10 rounded-xl">
                        <Check className="w-5 h-5 text-green-500" />
                     </div>
                     <h3 className="text-xl font-bold">Retrieved Chunks (4)</h3>
                  </div>
                  <div className="flex gap-2">
                     <button className="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white">
                        <ArrowDownToLine className="w-4 h-4" />
                     </button>
                     <button className="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white">
                        <Maximize2 className="w-4 h-4" />
                     </button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
                  {[1, 2, 3].map(i => (
                     <div key={`retrieval-chunk-${i}`} className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem] group hover:border-brand-500/30 transition-all">
                        <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-brand-500/10 text-brand-400 text-[9px] font-black rounded uppercase">Score: 0.942</span>
                              <span className="text-[10px] font-mono text-slate-600">ID: chnk-84k2-9s</span>
                           </div>
                           <button className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-white">
                              <ExternalLink className="w-4 h-4" />
                           </button>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed italic">
                           "The 2025 Security Protocol mandates that all vector indexing must occur within 100ms of document publication to maintain real-time RAG efficacy..."
                        </p>
                        <div className="mt-4 flex items-center gap-4">
                           <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3 text-slate-600" />
                              <span className="text-[9px] font-bold text-slate-500">Refund_Policy.pdf</span>
                           </div>
                           <div className="flex items-center gap-1">
                              <Network className="w-3 h-3 text-slate-600" />
                              <span className="text-[9px] font-bold text-slate-500">8 Connected Entities</span>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            <div className="glass-panel rounded-[2.5rem] p-6 bg-brand-500/[0.02] border-brand-500/10 flex items-center gap-6">
                <div className="p-4 bg-brand-500/10 rounded-2xl">
                   <Sparkles className="w-8 h-8 text-brand-400" />
                </div>
                <div>
                   <h4 className="text-sm font-bold text-white mb-1">RAG Optimization Tip</h4>
                   <p className="text-xs text-slate-500">Try re-indexing your document with a 20% overlap in chunks to improve semantic bridge across document sections.</p>
                </div>
            </div>
         </div>

         {/* Right Panel: Analytics */}
         <div className="col-span-3 flex flex-col gap-6">
            <div className="glass-panel p-8 rounded-[3rem] bg-black/20 flex flex-col gap-8">
               <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Retrieval Performance</h4>
                  <div className="h-40">
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[ { t: 0, v: 400 }, { t: 1, v: 420 }, { t: 2, v: 800 }, { t: 3, v: 450 }, { t: 4, v: 430 } ]}>
                           <Line type="monotone" dataKey="v" stroke="#0c91eb" strokeWidth={3} dot={false} />
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                           <XAxis hide />
                           <YAxis hide />
                        </LineChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               <div className="space-y-4">
                  {[
                     { label: 'Latency', val: '432ms', color: 'text-green-500' },
                     { label: 'Token Usage', val: '1,240', color: 'text-brand-400' },
                     { label: 'Confidence', val: 'High', color: 'text-blue-400' },
                  ].map((s) => (
                     <div key={s.label} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{s.label}</span>
                        <span className={cn("text-xs font-bold font-mono", s.color)}>{s.val}</span>
                     </div>
                  ))}
               </div>

               <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Retrieval Tree</div>
                  <div className="space-y-3">
                     {[
                        { step: 'Hybrid Query Expansion', time: '120ms' },
                        { step: 'Vector Similarity Search', time: '82ms' },
                        { step: 'Graph Traversal', time: '180ms' },
                        { step: 'Cross-Encoder Re-ranking', time: '50ms' }
                     ].map((step, i) => (
                        <div key={step.step} className="flex justify-between items-center text-[10px]">
                           <span className="text-slate-400 font-bold">{i+1}. {step.step}</span>
                           <span className="text-slate-600 font-mono">{step.time}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <button className="flex-1 rounded-[3rem] border-2 border-dashed border-white/5 hover:border-brand-500/20 hover:bg-brand-500/[0.02] transition-all flex flex-col items-center justify-center p-8 text-slate-600 hover:text-brand-400 group">
               <Save className="w-8 h-8 mb-4 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
               <span className="text-[10px] font-black uppercase tracking-widest">Save Query to Regression Test</span>
            </button>
         </div>
      </div>
   );
};

export const KnowledgeBaseOps = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'INVENTORY' | 'JOBS' | 'GRAPH' | 'PLAYGROUND'>('OVERVIEW');
  const [showConnectorManager, setShowConnectorManager] = useState(false);
  const [showIngestionWizard, setShowIngestionWizard] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<KnowledgeDocument | null>(null);

  if (showConnectorManager) {
    return <ConnectorManager onBack={() => setShowConnectorManager(false)} />;
  }

  return (
    <div className="space-y-8 h-full">
      <AnimatePresence>
         {showIngestionWizard && (
            <IngestionWizard 
              onCancel={() => setShowIngestionWizard(false)} 
              onComplete={() => setShowIngestionWizard(false)} 
            />
         )}
      </AnimatePresence>

      <AnimatePresence>
         {selectedAsset && (
            <AssetDetailWorkspace 
              document={selectedAsset}
              onClose={() => setSelectedAsset(null)}
              onPromote={(doc) => {
                 console.log("Promoting", doc);
                 // In a real app, this would trigger a promotion workflow
              }}
            />
         )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-brand-400 text-xs font-bold font-mono tracking-widest uppercase mb-3 text-glow-brand">
            <Database className="w-4 h-4" />
            Control Plane
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-medium tracking-tight bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent leading-tight">
            Knowledge Operations
          </h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base lg:text-lg max-w-2xl opacity-80">
            Redefining the RAG pipeline. Manage data lineage, embedding lifecycles, and knowledge graphs 
            from a single mission-critical console.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => setShowConnectorManager(true)}
            className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 text-slate-400" />
            Register Connector
          </button>
          <button 
            onClick={() => setShowIngestionWizard(true)}
            className="px-5 py-2.5 bg-brand-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20 active:scale-95"
          >
            Ingest New Knowledge
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-[24px] w-full lg:w-fit overflow-x-auto no-scrollbar shadow-inner">
        {[
          { id: 'OVERVIEW', label: 'Pipeline Control', icon: Zap },
          { id: 'INVENTORY', label: 'Knowledge Vault', icon: Layers },
          { id: 'JOBS', label: 'Pipeline Ops', icon: Activity },
          { id: 'GRAPH', label: 'Knowledge Graph', icon: Network },
          { id: 'PLAYGROUND', label: 'Playground', icon: Terminal },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-5 lg:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative shrink-0",
              activeTab === tab.id 
                ? "bg-white/10 text-white shadow-xl italic" 
                : "text-slate-500 hover:text-white"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-brand-400" : "text-slate-600")} />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 pb-20"
      >
        {activeTab === 'OVERVIEW' && <OverviewTab onSelectAsset={setSelectedAsset} />}
        {activeTab === 'INVENTORY' && <InventoryTab onSelectAsset={setSelectedAsset} />}
        {activeTab === 'JOBS' && <PipelineOpsTab />}
        {activeTab === 'GRAPH' && <GraphTab />}
        {activeTab === 'PLAYGROUND' && <PlaygroundTab />}
      </motion.div>
    </div>
  );
};
