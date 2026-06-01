import React from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Globe, 
  Database, 
  Grid3X3, 
  Network,
  ArrowRight,
  Shield,
  Zap,
  BarChart2,
  Trash2,
  MoreVertical,
  ExternalLink,
  MessageSquare,
  History as HistoryIcon,
  FileSearch,
  Hash,
  HardDrive
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// --- MOCK DATA ---
const SOURCES = [
  { id: 'src_1', name: 'Annual Report 2025.pdf', type: 'PDF', status: 'INDEXED', chunks: 1420, size: '4.2 MB', updated: '2h ago' },
  { id: 'src_2', name: 'Internal Wiki - Product Spec', type: 'MARKDOWN', status: 'INDEXED', chunks: 520, size: '210 KB', updated: '5h ago' },
  { id: 'src_3', name: 'Customer Feedback Cluster 12', type: 'JSON', status: 'SYNCING', chunks: 0, size: '1.5 MB', updated: 'Just now' },
  { id: 'src_4', name: 'Technical Docs V5.0', type: 'HTML', status: 'INDEXED', chunks: 2840, size: '12.8 MB', updated: '1d ago' },
];

const CHUNKS = [
  { id: 'chk_1', text: 'Section 4.2 states that the neural network architecture utilizes a mixture-of-experts (MoE) approach with 16 experts per layer...', confidence: 0.98, source: 'Technical Docs V5.0' },
  { id: 'chk_2', text: 'The revenue growth for Q3 reached $4.2B, driven primarily by the expansion of AI services in the APAC region...', confidence: 0.94, source: 'Annual Report 2025.pdf' },
  { id: 'chk_3', text: 'Security protocols require mandatory multi-factor authentication for all administrative access points to the primary RAG node...', confidence: 0.99, source: 'Internal Wiki' },
];

const METRICS_DATA = [
  { name: 'Mon', hits: 4000, latency: 240 },
  { name: 'Tue', hits: 3000, latency: 198 },
  { name: 'Wed', hits: 2000, latency: 450 },
  { name: 'Thu', hits: 2780, latency: 210 },
  { name: 'Fri', hits: 1890, latency: 220 },
  { name: 'Sat', hits: 2390, latency: 250 },
  { name: 'Sun', hits: 3490, latency: 180 },
];

const QUALITY_DATA = [
  { name: 'Faithfulness', value: 92 },
  { name: 'Answer Relevance', value: 88 },
  { name: 'Context Precision', value: 95 },
  { name: 'Context Recall', value: 85 },
];

const COLORS = ['#0c91eb', '#36acf7', '#7cc8fb', '#bae0fd'];

// --- COMPONENTS ---

export const KnowledgeBaseView = ({ hideHeader, onAddSource }: { hideHeader?: boolean, onAddSource?: () => void }) => {
  return (
    <div className="space-y-8">
      {/* Header Section */}
      {!hideHeader && (
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 text-brand-400 text-xs font-bold font-mono tracking-widest uppercase mb-2">
              <Database className="w-3.5 h-3.5" />
              Knowledge Systems
            </div>
            <h1 className="text-4xl font-display font-medium">Knowledge Base</h1>
            <p className="text-slate-500 mt-2 max-w-2xl">
              Unified retrieval infrastructure for RAG and GraphRAG. Manage data sources, 
              inspect vector indices, and monitor retrieval performance.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm font-medium">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button 
              onClick={onAddSource}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-all text-sm font-medium shadow-[0_0_15px_rgba(12,145,235,0.4)]"
            >
              <Plus className="w-4 h-4" />
              Add Data Source
            </button>
          </div>
        </div>
      )}

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sources', val: '142', sub: '+12 this week', icon: FileText },
          { label: 'Indexed Chunks', val: '1.2M', sub: '98.2% quality', icon: Hash },
          { label: 'Avg Retrieval Latency', val: '142ms', sub: '-15% vs last month', icon: Zap },
          { label: 'Storage', val: '4.2 TB', sub: 'Enterprise tier', icon: HardDrive }
        ].map((stat, i) => (
          <div key={stat.label} className="glass-card p-5 rounded-2xl group">
             <div className="flex justify-between items-start mb-4">
               <div className="p-2 bg-white/5 rounded-lg text-slate-400 group-hover:text-brand-400 transition-colors">
                 <stat.icon className="w-5 h-5" />
               </div>
               <BarChart2 className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
             </div>
             <div className="text-2xl font-bold font-display">{stat.val}</div>
             <div className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-tight">{stat.label}</div>
             <div className="text-[10px] text-brand-500/80 mt-2 font-mono">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Sources Table */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-panel overflow-hidden rounded-2xl border-white/5">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-brand-400" />
                Data Sources
              </h3>
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded">Showing 4 of 142</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/[0.02] text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">
                    <th className="px-6 py-3">Source Name</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Chunks</th>
                    <th className="px-6 py-3">Size</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {SOURCES.map(source => (
                    <tr key={source.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded bg-white/5",
                            source.type === 'PDF' && "text-red-400",
                            source.type === 'MARKDOWN' && "text-blue-400",
                            source.type === 'JSON' && "text-amber-400"
                          )}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold group-hover:text-brand-400 transition-colors uppercase">{source.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Updated {source.updated}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">{source.type}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight uppercase",
                          source.status === 'INDEXED' ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse"
                        )}>
                          {source.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">{source.chunks.toLocaleString()}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">{source.size}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-white/5 bg-white/[0.01]">
              <button className="w-full text-xs font-medium text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                View All Sources
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-6">
              <Zap className="w-4 h-4 text-brand-400" />
              Retrieval Performance
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={METRICS_DATA}>
                  <defs>
                    <linearGradient id="colorHits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0c91eb" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0c91eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ fontSize: 12, color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="hits" stroke="#0c91eb" strokeWidth={2} fillOpacity={1} fill="url(#colorHits)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sidebar panels */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Quality Radar (Pie/List) */}
          <div className="glass-panel p-6 rounded-2xl">
             <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
               <Shield className="w-4 h-4 text-brand-400" />
               RAG Quality
             </h3>
             <div className="h-48 flex items-center justify-center relative">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={QUALITY_DATA}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {QUALITY_DATA.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <div className="text-2xl font-bold tracking-tight">88.5%</div>
                 <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Avg Quality</div>
               </div>
             </div>
             <div className="space-y-4 mt-6">
                {QUALITY_DATA.map((q, i) => (
                  <div key={q.name} className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span className="text-slate-400">{q.name}</span>
                      <span className="text-white">{q.value}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${q.value}%` }}
                        className="h-full bg-brand-500"
                        transition={{ delay: 0.2 + i * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Chunk Inspector */}
          <div className="glass-panel p-6 rounded-2xl flex-1">
             <h3 className="font-semibold text-lg flex items-center gap-2 mb-6">
               <Grid3X3 className="w-4 h-4 text-brand-400" />
               Recent Retrieval
             </h3>
             <div className="space-y-4">
                {CHUNKS.map((chunk) => (
                  <div key={chunk.id} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                     <div className="flex justify-between items-center mb-3">
                       <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                         <Hash className="w-3 h-3" />
                         {chunk.id}
                       </span>
                       <div className="px-2 py-0.5 bg-brand-500/10 text-brand-400 text-[10px] font-bold rounded border border-brand-500/20">
                         {Math.round(chunk.confidence * 100)}% Match
                       </div>
                     </div>
                     <p className="text-[11px] leading-relaxed text-slate-300 line-clamp-3">"{chunk.text}"</p>
                     <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                       <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                         <Database className="w-3 h-3" />
                         {chunk.source}
                       </div>
                       <button className="text-[9px] font-bold text-brand-500 hover:text-brand-400 uppercase tracking-tighter">View Source</button>
                     </div>
                  </div>
                ))}
             </div>
             <button className="w-full mt-6 py-2 border border-white/10 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-all">
               Open Knowledge Graph
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
