import React, { useState } from 'react';
import { 
  Zap, 
  Search, 
  Terminal, 
  ChevronRight, 
  Play, 
  History as HistoryIcon,
  Filter,
  MessageSquare,
  Activity,
  Network
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export const KnowledgePlayground = () => {
  const [query, setQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleExecute = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setResults([
        { 
          id: '1', 
          source: 'Security_Compliance_v2.pdf', 
          relevance: 0.94, 
          excerpt: '...encryption protocols for data at rest must adhere to AES-256 standards with monthly rotation of master keys...',
          layer: 'GOLD'
        },
        { 
          id: '2', 
          source: 'Infrastructure_Baseline_V4', 
          relevance: 0.88, 
          excerpt: '...the storage clusters in availability zone C utilize encrypted volumes by default, managed by the root security controller...',
          layer: 'SILVER'
        }
      ]);
      setIsExecuting(false);
    }, 1500);
  };

  return (
    <div className="h-[calc(100vh-14rem)] flex gap-8 animate-in fade-in duration-500">
      {/* Control Panel */}
      <div className="w-96 glass-panel p-8 rounded-[3rem] border-white/5 space-y-8 flex flex-col bg-black/20">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest italic flex items-center gap-2 mb-6">
            <Terminal className="w-4 h-4 text-brand-400" />
            Retrieval Lab
          </h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Environment</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-brand-500/40">
                 <option>Production Fleet</option>
                 <option>Staging</option>
                 <option>Sandbox</option>
              </select>
            </div>
            <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Strategy</label>
               <div className="grid grid-cols-2 gap-2">
                  {['Hybrid', 'Vector', 'Graph', 'Keyword'].map(m => (
                    <button key={m} className={cn(
                      "py-2 rounded-xl text-[9px] font-black uppercase transition-all border",
                      m === 'Hybrid' ? "bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-500/20" : "bg-white/5 text-slate-500 border-white/5"
                    )}>{m}</button>
                  ))}
               </div>
            </div>
            <div className="space-y-4 pt-4 border-t border-white/5">
               <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-500 uppercase">Top K</span>
                  <span className="text-brand-400">5</span>
               </div>
               <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 w-[50%]" />
               </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4">
           <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Knowledge Query</label>
           <textarea 
             value={query}
             onChange={(e) => setQuery(e.target.value)}
             className="flex-1 w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-slate-300 font-mono resize-none focus:border-brand-500/40 outline-none placeholder:text-slate-700 leading-relaxed" 
             placeholder="e.g. Protocol for encrypted storage failover..." 
           />
        </div>

        <button 
          onClick={handleExecute}
          disabled={!query || isExecuting}
          className="w-full py-4 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-brand-500/20 hover:bg-brand-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
           {isExecuting ? 'Synthesizing...' : 'Execute Retrieval'}
           <Zap className={cn("w-4 h-4", isExecuting && "animate-pulse")} />
        </button>
      </div>

      {/* Result Area */}
      <div className="flex-1 glass-panel rounded-[3rem] border-white/5 bg-black/40 overflow-hidden flex flex-col">
        <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
           <div className="flex items-center gap-4">
              <div className="p-2.5 bg-brand-500/10 rounded-xl">
                 <Activity className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                 <h3 className="text-sm font-bold uppercase tracking-widest">Trace Analysis</h3>
                 <p className="text-[10px] text-slate-600 font-black uppercase mt-0.5">Real-time retrieval latency: {isExecuting ? '--' : results.length > 0 ? '420ms' : '0ms'}</p>
              </div>
           </div>
           <div className="flex gap-3">
              <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-500 hover:text-white transition-all"><HistoryIcon className="w-4 h-4" /></button>
              <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-500 hover:text-white transition-all"><Filter className="w-4 h-4" /></button>
           </div>
        </div>

        <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
           <AnimatePresence mode="wait">
              {isExecuting ? (
                <motion.div 
                   key="loading"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="h-full flex flex-col items-center justify-center space-y-6"
                >
                   <div className="w-16 h-16 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin" />
                   <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">Scanning multi-layer vector space...</p>
                </motion.div>
              ) : results.length > 0 ? (
                <motion.div 
                   key="results"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="space-y-6"
                >
                   {results.map((res, i) => (
                      <div key={res.id} className="p-8 bg-white/[0.03] border border-white/5 rounded-[2.5rem] group hover:border-brand-500/20 transition-all">
                         <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                                  <ChevronRight className="w-5 h-5" />
                               </div>
                               <div>
                                  <div className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors uppercase tracking-tight">{res.source}</div>
                                  <div className="flex items-center gap-3 mt-1">
                                     <span className="text-[10px] font-mono text-brand-500 font-bold">RELEVANCE: {res.relevance}</span>
                                     <span className="px-1.5 py-0.5 rounded bg-white/5 text-[8px] font-black text-slate-600 uppercase tracking-widest border border-white/10">{res.layer}</span>
                                  </div>
                               </div>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-xl transition-all">
                               <MessageSquare className="w-4 h-4 text-slate-500" />
                            </button>
                         </div>
                         <p className="text-sm text-slate-400 leading-relaxed italic italic font-serif">
                            {res.excerpt}
                         </p>
                         <div className="mt-8 flex gap-3 pt-6 border-t border-white/5">
                            <button className="px-3 py-1.5 bg-white/5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all">View Full Asset</button>
                            <button className="px-3 py-1.5 bg-white/5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all">Re-rank Feedback</button>
                         </div>
                      </div>
                   ))}
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                   <div className="w-24 h-24 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center">
                      <Play className="w-10 h-10 text-slate-700" />
                   </div>
                   <div>
                      <h3 className="text-xl font-bold uppercase italic text-slate-400">Ready for Execution</h3>
                      <p className="text-xs text-slate-600 font-bold uppercase mt-2 tracking-widest">Input a query to begin trace analysis</p>
                   </div>
                </div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
