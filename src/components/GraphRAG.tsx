import React from 'react';
import { 
  Network, 
  Search, 
  Filter, 
  Zap, 
  Database, 
  Plus, 
  Maximize2,
  Minimize2,
  Share2,
  Settings,
  Terminal,
  Grid
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export const GraphRAGView = () => {
  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col gap-6 no-scrollbar">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-400 text-[10px] font-black font-mono tracking-widest uppercase mb-2">
            <Network className="w-3.5 h-3.5" />
            Knowledge Graphics
          </div>
          <h1 className="text-3xl lg:text-4xl font-display font-medium italic tracking-tight">GraphRAG Studio</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-white/20 transition-all">
            <Plus className="w-4 h-4" /> Expand
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20">
            <Zap className="w-4 h-4" /> Synthesize
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Main Graph Canvas (Simulation) */}
        <div className="flex-1 glass-panel rounded-3xl relative overflow-hidden bg-[#020202] border-white/5">
           {/* Graph Controls */}
           <div className="absolute top-4 lg:top-6 left-4 lg:left-6 flex flex-col gap-2 z-10">
              <button className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-slate-400">
                <Plus className="w-4 h-4" />
              </button>
              <button className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-slate-400">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-slate-400">
                <Minimize2 className="w-4 h-4" />
              </button>
           </div>

           <div className="absolute top-4 lg:top-6 right-4 lg:right-6 flex gap-2 z-10">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                Force: Active
              </button>
           </div>

           {/* Pseudo-Graph Visualization */}
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
              <svg viewBox="0 0 800 600" className="w-full h-full p-10 lg:p-0">
                 <defs>
                   <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
                     <stop offset="0%" stopColor="#0c91eb" stopOpacity="0.8" />
                     <stop offset="100%" stopColor="#0c91eb" stopOpacity="0" />
                   </radialGradient>
                 </defs>
                 
                 {/* Edges */}
                 {[
                   [150, 150, 400, 300], [650, 150, 400, 300], [400, 300, 400, 500],
                   [150, 150, 100, 300], [650, 150, 700, 300], [400, 500, 200, 550], [400, 500, 600, 550]
                 ].map((line, i) => (
                   <motion.line 
                     key={`edge-${i}`} 
                     x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} 
                     stroke="rgba(12,145,235,0.2)" strokeWidth="1" 
                     initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: i * 0.2, duration: 1 }}
                   />
                 ))}

                 {/* Nodes */}
                 {[
                   {x: 400, y: 300, label: 'CORE_ENTITY', size: 10},
                   {x: 150, y: 150, label: 'SUB_NODE_A', size: 6},
                   {x: 650, y: 150, label: 'SUB_NODE_B', size: 6},
                   {x: 400, y: 500, label: 'SUB_NODE_C', size: 6},
                   {x: 100, y: 300, label: 'CONTEXT_01', size: 4},
                   {x: 700, y: 300, label: 'CONTEXT_02', size: 4},
                 ].map((node, i) => (
                   <motion.g 
                     key={node.label} 
                     initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }}
                   >
                     <circle cx={node.x} cy={node.y} r={node.size * 4} fill="url(#nodeGrad)" className="animate-pulse" />
                     <circle cx={node.x} cy={node.y} r={node.size} fill="#0c91eb" />
                     <text x={node.x} y={node.y + 25} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono font-bold tracking-widest">{node.label}</text>
                   </motion.g>
                 ))}
              </svg>
           </div>

           {/* AI Overlay Input */}
           <div className="absolute bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-2rem)] lg:max-w-xl">
             <div className="glass-panel p-1.5 lg:p-2 rounded-2xl flex gap-2 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
               <input 
                 className="flex-1 bg-transparent px-4 py-2 text-xs lg:text-sm focus:outline-none placeholder:text-slate-600" 
                 placeholder="Ask the Graph: 'How does Entity-A relate...'" 
               />
               <button className="bg-brand-500 p-2 rounded-xl text-white">
                 <Zap className="w-4 lg:w-5 h-4 lg:h-5" />
               </button>
             </div>
           </div>
        </div>

        {/* Detail Panel */}
        <div className="hidden lg:flex w-80 glass-panel p-6 rounded-3xl flex flex-col gap-6 border-white/5 overflow-y-auto custom-scrollbar">
           <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Discovery Metrics</h3>
              <div className="space-y-4">
                 {[
                   { label: 'Communities', val: '24' },
                   { label: 'Centrality', val: '0.84' },
                   { label: 'Density', val: '0.12' },
                 ].map((m) => (
                    <div key={m.label} className="flex justify-between items-center py-2 border-b border-white/5">
                       <span className="text-xs text-slate-400">{m.label}</span>
                       <span className="text-xs font-mono font-bold text-white">{m.val}</span>
                    </div>
                 ))}
              </div>
           </div>

           <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Entity Details</h3>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                 <div className="text-xs font-bold text-brand-400 mb-2 font-mono">CORE_ENTITY</div>
                 <p className="text-[10px] text-slate-400 leading-relaxed">
                   Primary knowledge cluster representing central product specifications and architectural guidelines. Linked across 14 data sources.
                 </p>
                 <div className="mt-4 flex flex-wrap gap-1.5">
                   {['ARCH', 'SPEC', 'V1', 'GUIDE'].map(tag => (
                     <span key={tag} className="px-1.5 py-0.5 bg-white/5 rounded text-[8px] font-bold text-slate-600">{tag}</span>
                   ))}
                 </div>
              </div>
           </div>

           <div className="mt-auto">
              <button className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors">
                Regenerate Schema
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
