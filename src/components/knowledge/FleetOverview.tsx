import React from 'react';
import { Database, ArrowUpRight, Activity, AlertCircle, CheckCircle2, Zap, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { KnowledgeBaseView } from '../KnowledgeBase';

export const FleetOverview = () => {
  const mainMetrics = [
    { label: 'Knowledge Fleet', value: '1,248', trend: '+12%', trendType: 'UP' as const, icon: Database, color: 'brand' as const },
    { label: 'Conflict Rate', value: '0.04%', trend: '-2%', trendType: 'DOWN' as const, icon: AlertCircle, color: 'emerald' as const },
    { label: 'Graph Density', value: '42.8k', trend: '+5k', trendType: 'UP' as const, icon: Zap, color: 'blue' as const },
    { label: 'Pipeline Auth', value: '100%', trend: 'STABLE', trendType: 'NEUTRAL' as const, icon: CheckCircle2, color: 'amber' as const },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-4 gap-8">
         <div className="col-span-3 space-y-8">
            <div className="grid grid-cols-3 gap-6">
               {mainMetrics.map((m, i) => (
                  <div key={i} className="glass-panel p-8 rounded-[2.5rem] border-white/5 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 blur-[40px] group-hover:bg-brand-500/10 transition-all" />
                     <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-white/5 rounded-2xl">
                           <m.icon className={cn("w-6 h-6", m.color === 'brand' ? 'text-brand-400' : 'text-slate-400')} />
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] font-black tracking-widest",
                          m.trendType === 'UP' ? 'text-green-500' : 'text-amber-500'
                        )}>
                           <ArrowUpRight className="w-3 h-3" />
                           {m.trend}
                        </div>
                     </div>
                     <div className="text-3xl font-display font-medium tracking-tight mb-1">{m.value}</div>
                     <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{m.label}</div>
                  </div>
               ))}
            </div>

            <div className="glass-panel rounded-[2.5rem] border-white/5 overflow-hidden">
               <div className="p-8 border-b border-white/5 flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-3">
                     <Activity className="w-5 h-5 text-brand-400" />
                     Real-time Processing Fleet
                  </h3>
                  <button className="text-[10px] font-black text-brand-400 uppercase tracking-widest hover:underline">View All Workers</button>
               </div>
               <div className="p-4 overflow-x-auto no-scrollbar">
                  <div className="flex gap-4 min-w-max p-4">
                     {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-64 p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-mono font-bold text-slate-500">WORKER-KB-{i}</span>
                              <div className="flex items-center gap-1.5">
                                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                 <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                              </div>
                           </div>
                           <div className="space-y-3">
                              <div className="flex justify-between text-[10px]">
                                 <span className="text-slate-600 font-bold uppercase">CPU Load</span>
                                 <span className="text-white font-mono">14%</span>
                              </div>
                              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                 <div className="h-full bg-emerald-500/50 w-[14%]" />
                              </div>
                           </div>
                           <div className="pt-4 border-t border-white/5 text-[9px] text-slate-600 font-medium">
                              Currently processing: <span className="text-slate-400">knowledge_shard_{840 + i}.vec</span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
         <div className="space-y-8">
            <div className="glass-panel p-8 rounded-[2.5rem] border-white/5">
               <h3 className="text-sm font-bold uppercase tracking-widest mb-6">Recent Alerts</h3>
               <div className="space-y-4">
                  {[1, 2].map(i => (
                     <div key={i} className="flex gap-4 items-start p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <div>
                           <div className="text-xs font-bold text-white mb-1">Source Connection Lost</div>
                           <div className="text-[10px] text-slate-500 italic">SharePoint Hub-B timed out.</div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
            <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-brand-500/[0.02]">
               <h3 className="text-sm font-bold uppercase tracking-widest mb-6">Knowledge Health</h3>
               <div className="flex justify-center py-4">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                     <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                        <circle cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="376" strokeDashoffset="40" className="text-brand-500" strokeLinecap="round" />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-2xl font-bold">92%</div>
                        <div className="text-[8px] font-black text-slate-500 tracking-widest">SCORE</div>
                     </div>
                  </div>
               </div>
               <div className="mt-8 space-y-4">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black">
                     <span>Embedding Freshness</span>
                     <span className="text-brand-400">Excellent</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black">
                     <span>Conflict Rate</span>
                     <span className="text-green-500">0.4%</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
      
      <KnowledgeBaseView hideHeader onAddSource={() => {}} />
    </div>
  );
};
