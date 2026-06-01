import React, { useState } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Terminal, 
  Cpu, 
  Zap, 
  Database, 
  Network,
  Clock,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Maximize2,
  BarChart2,
  Layers,
  ArrowUpRight,
  Code2,
  GitBranch,
  Brain,
  MessageSquare,
  FileText,
  Info,
  ShieldCheck,
  Download,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAppState } from '../AppStateContext';
import { DetailDrawer } from './shared/DetailDrawer';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

const TRACES = [
  { id: 'T-8421', service: 'Retrieval_Engine', status: 'COMPLETE', latency: '420ms', tokens: 840, timestamp: '12:04:22', model: 'Gemini 1.5 Flash' },
  { id: 'T-8422', service: 'Embedding_Worker', status: 'FAILED', latency: '2.4s', tokens: 0, timestamp: '12:04:25', model: 'text-embedding-004' },
  { id: 'T-8423', service: 'Prompt_Optimization', status: 'COMPLETE', latency: '180ms', tokens: 120, timestamp: '12:04:28', model: 'Gemini 1.5 Pro' },
  { id: 'T-8424', service: 'Graph_Traversal', status: 'COMPLETE', latency: '560ms', tokens: 2100, timestamp: '12:04:30', model: 'Gemini 1.5 Pro' },
];

const METRICS_DATA = [
  { t: '12:00', l: 400, e: 2 },
  { t: '12:10', l: 450, e: 4 },
  { t: '12:20', l: 580, e: 12 },
  { t: '12:30', l: 420, e: 3 },
  { t: '12:40', l: 390, e: 1 },
  { t: '12:50', l: 410, e: 2 },
];

export const ObservabilityView = () => {
  const { isExpertMode } = useAppState();
  const [selectedTrace, setSelectedTrace] = useState<any | null>(null);
  const [activeTraceTab, setActiveTraceTab] = useState('OVERVIEW');

  const TRACE_TABS = [
    { id: 'OVERVIEW', label: 'Summary', icon: Info },
    { id: 'SPANS', label: 'Span Topology', icon: GitBranch },
    { id: 'REASONING', label: 'AI Trace', icon: Brain },
    { id: 'PAYLOAD', label: 'Raw Payload', icon: Code2 },
  ];

  return (
    <div className="space-y-8 h-full flex flex-col no-scrollbar">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
...        <div>
          <div className="flex items-center gap-2 text-brand-400 text-[10px] lg:text-xs font-bold font-mono tracking-widest uppercase mb-3 text-glow-brand">
            <Activity className="w-4 h-4" />
            Global Observability Node
          </div>
          <h1 className="text-3xl lg:text-5xl font-display font-medium tracking-tight">System Telemetry</h1>
          <p className="text-slate-500 mt-2 text-sm lg:text-lg">
            Real-time traces, resource monitoring, and AI-native logging.
          </p>
        </div>
        <div className="flex gap-2 lg:gap-4 w-full lg:w-auto">
           <button className="flex-1 lg:flex-none px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:border-white/20 transition-all flex items-center justify-center gap-2">
             <Filter className="w-4 h-4 text-slate-400" />
             Filters
           </button>
           <button className="flex-1 lg:flex-none px-5 py-3 bg-brand-500 text-white rounded-2xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20">
             Debugger
           </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-12 gap-6 lg:gap-8">
         <div className="col-span-12 lg:col-span-8 glass-panel p-6 lg:p-8 rounded-3xl border-white/5 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6 lg:mb-10">
               <div>
                  <h3 className="text-base lg:text-lg font-bold flex items-center gap-2 italic">
                     <Zap className="w-5 h-5 text-amber-500" />
                     Pipeline Latency (P95)
                  </h3>
                  <p className="hidden lg:block text-xs text-slate-500 mt-1">Millisecond response time across global instances</p>
               </div>
               <div className="text-right">
                  <div className="text-xl lg:text-2xl font-display font-bold text-white">428ms</div>
                  <div className="text-[10px] text-green-500 font-bold uppercase tracking-widest mt-1">STABLE</div>
               </div>
            </div>
            <div className="h-48 lg:h-64">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={METRICS_DATA}>
                     <defs>
                        <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#0c91eb" stopOpacity={0.2}/>
                           <stop offset="95%" stopColor="#0c91eb" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                     <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} />
                     <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                        itemStyle={{ fontSize: '10px' }}
                     />
                     <Area type="monotone" dataKey="l" stroke="#0c91eb" strokeWidth={2} fillOpacity={1} fill="url(#latencyGrad)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 lg:gap-8">
            <div className="flex-1 glass-panel p-6 lg:p-8 rounded-3xl border-white/5 bg-slate-500/[0.03]">
               <h4 className="text-[10px] font-black text-slate-400 mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                  <Cpu className="w-4 h-4 text-brand-400" />
                  Compute Utilization
               </h4>
               <div className="space-y-6">
                  {[
                    { label: 'Token Throttling', val: 'Low', pct: 12, color: 'bg-green-500' },
                    { label: 'Worker Queue', val: '840/s', pct: 78, color: 'bg-brand-500' },
                    { label: 'Memory Pressure', val: 'Safe', pct: 45, color: 'bg-slate-500' },
                  ].map((m) => (
                    <div key={m.label}>
                       <div className="flex justify-between text-[11px] font-bold mb-2">
                          <span className="text-slate-500 uppercase tracking-widest">{m.label}</span>
                          <span className="text-white font-mono">{m.val}</span>
                       </div>
                       <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className={cn("h-full", m.color)} style={{ width: `${m.pct}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      {/* Trace Table */}
      <div className="flex-1 glass-panel overflow-hidden rounded-3xl border-white/5 flex flex-col min-h-[400px]">
         <div className="p-6 border-b border-white/10 flex flex-col sm:row gap-4 sm:justify-between sm:items-center bg-white/[0.01]">
            <h3 className="text-base lg:text-lg font-bold flex items-center gap-2 italic">
               <Terminal className="w-5 h-5 text-brand-400" />
               Distributed Traces
            </h3>
            <div className="flex gap-2 w-full sm:w-auto">
               <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input type="text" placeholder="Trace ID..." className="bg-white/5 border border-white/5 pl-8 pr-4 py-1.5 rounded-lg text-[10px] w-full sm:w-48 focus:outline-none focus:border-brand-500/50 uppercase font-mono" />
               </div>
               <button className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 shrink-0">Export</button>
            </div>
         </div>
         <div className="flex-1 overflow-x-auto no-scrollbar">
            {/* Desktop Table View */}
            <table className="hidden xl:table w-full text-left">
               <thead className="bg-white/[0.03] border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
                  <tr>
                     <th className="px-8 py-4">Trace ID</th>
                     <th className="px-6 py-4">Service Node</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-4 py-4 text-right">Latency</th>
                     <th className="px-4 py-4 text-right">Tokens</th>
                     <th className="px-6 py-4 text-right">Timestamp</th>
                     <th className="px-8 py-4 text-right"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {TRACES.map((trace) => (
                    <tr 
                      key={trace.id} 
                      onClick={() => setSelectedTrace(trace)}
                      className="group hover:bg-white/[0.01] transition-all cursor-pointer"
                    >
                       <td className="px-8 py-4 text-xs font-mono font-bold text-slate-300 group-hover:text-brand-400 transition-colors">
                          <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-brand-500/40" />
                             {trace.id}
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 uppercase">
                             {trace.service}
                          </span>
                       </td>
                       <td className="px-6 py-4">
                          <div className={cn(
                             "flex items-center gap-2 text-[10px] font-black",
                             trace.status === 'COMPLETE' ? "text-green-500" : "text-red-500"
                          )}>
                             {trace.status === 'COMPLETE' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                             {trace.status}
                          </div>
                       </td>
                       <td className="px-4 py-4 text-right text-xs font-mono text-slate-400 italic">{trace.latency}</td>
                       <td className="px-4 py-4 text-right text-xs font-mono text-slate-500 font-bold">{trace.tokens}</td>
                       <td className="px-6 py-4 text-right text-[10px] font-medium text-slate-600">{trace.timestamp}</td>
                       <td className="px-8 py-4 text-right">
                          <button className="p-1.5 rounded hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all text-slate-500">
                             <Maximize2 className="w-4 h-4" />
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>

            {/* Mobile List View */}
            <div className="xl:hidden divide-y divide-white/5">
               {TRACES.map((trace) => (
                 <div 
                   key={trace.id} 
                   onClick={() => setSelectedTrace(trace)}
                   className="p-6 space-y-4 hover:bg-white/[0.01] transition-all cursor-pointer"
                 >
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-brand-500" />
                          <div>
                             <div className="text-[10px] text-slate-400 font-mono font-bold tracking-widest">{trace.id}</div>
                             <div className="text-[11px] font-black uppercase text-slate-200 mt-0.5 italic">{trace.service.replace('_', ' ')}</div>
                          </div>
                       </div>
                       <div className={cn(
                          "px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest",
                          trace.status === 'COMPLETE' ? "text-green-500" : "text-red-500"
                       )}>
                          {trace.status}
                       </div>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[10px]">
                       <div className="flex items-center gap-4">
                          <span className="text-slate-500">LAT: <span className="text-slate-300 italic">{trace.latency}</span></span>
                          <span className="text-slate-500">TKN: <span className="text-slate-300 font-bold">{trace.tokens}</span></span>
                       </div>
                       <span className="text-slate-600 font-medium">{trace.timestamp}</span>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>

      <DetailDrawer
        isOpen={!!selectedTrace}
        onClose={() => setSelectedTrace(null)}
        title={`Trace Inspection: ${selectedTrace?.id}`}
        subtitle={selectedTrace?.service}
        size="lg"
        tabs={TRACE_TABS}
        activeTab={activeTraceTab}
        onTabChange={setActiveTraceTab}
      >
        <div className="p-8 h-full overflow-y-auto no-scrollbar">
          {activeTraceTab === 'OVERVIEW' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 {[
                   { label: 'Total Latency', val: selectedTrace?.latency, sub: 'P95 Percentile', icon: Clock, color: 'text-brand-400' },
                   { label: 'Token Count', val: selectedTrace?.tokens, sub: 'Model Context', icon: Layers, color: 'text-purple-400' },
                   { label: 'Model used', val: selectedTrace?.model, sub: 'Azure / Vertex', icon: Cpu, color: 'text-amber-400' },
                   { label: 'Status', val: selectedTrace?.status, sub: 'Exit Code 0', icon: ShieldCheck, color: 'text-green-400' },
                 ].map((stat, i) => (
                   <div key={stat.label} className="p-5 bg-white/5 border border-white/5 rounded-3xl">
                      <div className="flex items-center gap-3 mb-3">
                        <stat.icon className={cn("w-4 h-4", stat.color)} />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                      </div>
                      <div className="text-xl font-display font-medium text-white tracking-tight">{stat.val}</div>
                      <div className="text-[9px] text-slate-600 mt-1 uppercase font-bold">{stat.sub}</div>
                   </div>
                 ))}
              </div>

              <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01]">
                 <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                   <Activity className="w-5 h-5 text-brand-400" />
                   System Propagation Trace
                 </h4>
                 <div className="space-y-6">
                    {[
                      { step: 'Authentication Gateway', dur: '12ms', status: 'PASS', actor: 'Vault_Auth_V2' },
                      { step: 'Semantic Retrieval', dur: '184ms', status: 'PASS', actor: 'Pinecone_Node_X4' },
                      { step: 'Graph Entity Merge', dur: '24ms', status: 'PASS', actor: 'Knowledge_Graph_Svc' },
                      { step: 'Inference Completion', dur: '198ms', status: 'PASS', actor: selectedTrace?.model },
                    ].map((step, i) => (
                      <div key={step.step} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 group hover:bg-brand-500/5 transition-all">
                        <div className="flex items-center gap-4">
                           <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-500">
                             0{i+1}
                           </div>
                           <div>
                              <div className="text-xs font-bold text-white uppercase tracking-tight">{step.step}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{step.actor}</div>
                           </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <span className="text-[11px] font-mono font-bold text-slate-400">{step.dur}</span>
                           <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-black rounded uppercase">Passed</span>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          )}

          {activeTraceTab === 'REASONING' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
               <div className="p-8 bg-[#0a0a0d] border border-white/5 rounded-[3rem] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 blur-[80px]" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-8">
                      <Brain className="w-6 h-6 text-brand-400" />
                      <h4 className="text-xl font-bold italic tracking-tight">Cortex Thinking Stream</h4>
                    </div>
                    <div className="space-y-6 font-mono text-sm leading-relaxed text-slate-300">
                      <p className="text-slate-500 italic uppercase text-[10px] font-black tracking-widest border-b border-white/5 pb-2">Internal Monologue:</p>
                      <p>1. User is requesting refund policy (EMEA context suspected due to metadata headers).</p>
                      <p>2. Fetching nodes: [refund_eligibility, emea_overrides, regional_docs_2025].</p>
                      <p>3. Found conflict in regional window (30 vs 45 days). Applying source trust score logic.</p>
                      <p>4. Regional EMEA (ID: doc_842) has priority due to "Geographic Relevance" heuristic.</p>
                      <p>5. Formatting output with disclaimer for digital assets.</p>
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem]">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Prompt Template</h5>
                    <div className="text-xs font-mono text-slate-400 line-clamp-4 italic bg-black/40 p-4 rounded-xl">
                      System: You are an enterprise assistance bot... User Context: {`{region: "EMEA", status: "VIP"}`}... Task: Summarize policy nodes...
                    </div>
                  </div>
                  <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem]">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Guardrail Check</h5>
                    <div className="space-y-3">
                       {['Hate/Toxicity', 'PII Disclosure', 'Data Scraping'].map(g => (
                         <div key={g} className="flex justify-between items-center text-[10px]">
                           <span className="text-slate-400">{g}</span>
                           <span className="text-green-500 font-bold uppercase tracking-tight">Safe</span>
                         </div>
                       ))}
                    </div>
                  </div>
               </div>
            </div>
          )}

          {activeTraceTab === 'PAYLOAD' && (
            <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
               <div className="flex-1 bg-black/60 rounded-[3rem] border border-white/5 p-10 font-mono text-xs overflow-y-auto no-scrollbar leading-relaxed">
                  <pre className="text-brand-300/80">
                    {JSON.stringify({
                      trace_id: selectedTrace?.id,
                      timestamp: selectedTrace?.timestamp,
                      request: {
                        model: selectedTrace?.model,
                        temperature: 0.2,
                        top_p: 0.95,
                        messages: [
                          { role: "system", content: "..." },
                          { role: "user", content: "What is the refund window for Sweden?" }
                        ]
                      },
                      response: {
                        content: "The refund window for EMEA region, including Sweden, is 45 calendar days for enterprise accounts...",
                        token_usage: {
                          prompt: 120,
                          completion: 720,
                          total: 840
                        }
                      }
                    }, null, 2)}
                  </pre>
               </div>
               <div className="flex gap-4">
                  <button className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all flex items-center justify-center gap-3">
                    <Download className="w-4 h-4" />
                    Download JSON
                  </button>
                  <button className="flex-1 py-4 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20 flex items-center justify-center gap-3">
                    <MessageSquare className="w-4 h-4" />
                    Open in Playground
                  </button>
               </div>
            </div>
          )}
          
          {activeTraceTab === 'SPANS' && (
            <div className="h-full bg-slate-950/40 rounded-[4rem] border border-white/5 flex items-center justify-center relative overflow-hidden animate-in fade-in zoom-in-95">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_0%,transparent_70%)]" />
               <div className="relative text-center">
                  <div className="flex items-center justify-center gap-8 mb-12">
                     <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                       <Database className="w-8 h-8 text-brand-400" />
                     </div>
                     <ArrowRight className="w-6 h-6 text-slate-700" />
                     <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.15)] relative">
                        <Cpu className="w-10 h-10 text-purple-400" />
                        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-brand-500 text-white rounded text-[8px] font-black uppercase tracking-widest">Active</div>
                     </div>
                     <ArrowRight className="w-6 h-6 text-slate-700" />
                     <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                       <CheckCircle2 className="w-8 h-8 text-green-500" />
                     </div>
                  </div>
                  <h4 className="text-2xl font-display font-medium text-white italic">Multi-Cluster Trace Topology</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-4 leading-relaxed">
                    Visualizing the execution flow through the decentralized worker fleet. 
                    <span className="text-brand-400 font-bold block mt-2 tracking-widest uppercase">Encryption: AES-256-GCM Active</span>
                  </p>
               </div>
            </div>
          )}
        </div>
      </DetailDrawer>
    </div>
  );
};
