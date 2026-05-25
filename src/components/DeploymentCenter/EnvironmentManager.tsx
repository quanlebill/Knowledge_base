import React, { useState } from 'react';
import { 
  Server, 
  Settings, 
  ArrowRight, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Database, 
  Bot, 
  Wrench, 
  GitBranch, 
  Layers, 
  History as HistoryIcon, 
  ChevronRight, 
  ArrowUpRight, 
  Zap, 
  Lock, 
  Search,
  MoreVertical,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../shared/StatusBadge';
import { DetailDrawer } from '../shared/DetailDrawer';
import { MOCK_ENVIRONMENTS } from '../../testing/deploymentMock';

const LocalPlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
);

const LocalEyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);

export const EnvironmentManager = () => {
  const [selectedEnv, setSelectedEnv] = useState<string | null>('PROD');
  const [showRegisterDrawer, setShowRegisterDrawer] = useState(false);
  const env = MOCK_ENVIRONMENTS.find(e => e.name === selectedEnv) || MOCK_ENVIRONMENTS[0];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 h-full flex flex-col">
      <div className="flex justify-between items-end mb-4">
        <div>
          <div className="flex items-center gap-2 text-brand-400 text-xs font-black font-mono tracking-widest uppercase mb-3 text-glow-blue">
            <Server className="w-4 h-4" />
            Control Plane / Environment Management
          </div>
          <h1 className="text-5xl font-display font-medium tracking-tight text-white mb-2 italic">Infrastructure Clusters</h1>
          <p className="text-slate-500 text-lg">Manage multi-tenant isolation, drift reconciliation, and promote runtimes.</p>
        </div>
        <div className="flex gap-4">
           <button className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all flex items-center gap-2">
             <RefreshCw className="w-4 h-4" /> Check for Drift
           </button>
           <button className="px-5 py-2.5 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/20 flex items-center gap-2">
             <Zap className="w-4 h-4" /> Unlock PROD Write-Access
           </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-12 flex-1 overflow-hidden">
         {/* Environment Selection Side */}
         <div className="col-span-12 lg:col-span-3 space-y-4">
            {MOCK_ENVIRONMENTS.map(e => (
               <div 
                 key={e.name}
                 onClick={() => setSelectedEnv(e.name)}
                 className={cn(
                   "p-8 rounded-[2.5rem] border transition-all cursor-pointer group relative overflow-hidden",
                   selectedEnv === e.name 
                     ? "bg-brand-500/10 border-brand-500 shadow-2xl shadow-brand-500/5" 
                     : "bg-white/[0.01] border-white/5 hover:border-white/20"
                 )}
               >
                  <div className="flex justify-between items-center mb-6">
                     <div className="text-2xl font-display font-medium text-white italic tracking-tight">{e.name} Cluster</div>
                     <div className={cn(
                        "w-3 h-3 rounded-full",
                        e.status === 'HEALTHY' ? "bg-green-500" : "bg-amber-500 animate-pulse"
                     )} />
                  </div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Health Score</span>
                        <span className="text-xl font-bold font-mono text-slate-200">{e.healthScore}%</span>
                     </div>
                     <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className={cn(
                           "h-full",
                           e.status === 'HEALTHY' ? "bg-green-500" : "bg-amber-500"
                        )} style={{ width: `${e.healthScore}%` }} />
                     </div>
                  </div>
                  {selectedEnv === e.name && (
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Server className="w-24 h-24 text-brand-400" />
                    </div>
                  )}
               </div>
            ))}

            <div 
               onClick={() => setShowRegisterDrawer(true)}
               className="p-8 border border-white/5 border-dashed rounded-[2.5rem] text-center space-y-4 group hover:border-brand-500/30 transition-all cursor-pointer"
            >
               <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-slate-500 group-hover:text-brand-400 group-hover:scale-110 transition-all">
                  <LocalPlusIcon className="w-6 h-6" />
               </div>
               <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Register New Environment</div>
            </div>
         </div>

         {/* Detailed View */}
         <div className="col-span-12 lg:col-span-9 flex flex-col gap-8 overflow-hidden">
            <AnimatePresence mode="wait">
               <motion.div 
                 key={env.name}
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="flex-1 flex flex-col glass-panel rounded-[4rem] border-white/5 bg-white/[0.01] overflow-hidden"
               >
                  <div className="px-12 py-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                     <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                           <h2 className="text-3xl font-display font-medium text-white italic tracking-tight">{env.name} Runtime Status</h2>
                           <div className="flex items-center gap-2 mt-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              <span className="text-brand-400">{env.runtimeVersion}</span>
                              <span className="opacity-20">•</span>
                              <span>{env.agentCount} ACTIVE AGENTS</span>
                              <span className="opacity-20">•</span>
                              <span>{env.kbCount} KB SOURCES</span>
                           </div>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-2">
                           <HistoryIcon className="w-4 h-4" /> Full Logs
                        </button>
                        <button className="px-8 py-3 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/20 flex items-center gap-2">
                           <ArrowRight className="w-4 h-4" /> Promote from {env.name === 'PROD' ? 'UAT' : 'DEV'}
                        </button>
                     </div>
                  </div>

                  <div className="flex-1 p-12 overflow-y-auto no-scrollbar grid grid-cols-2 gap-12">
                     <div className="space-y-12">
                        <div>
                           <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-8 flex items-center gap-2">
                              <Bot className="w-4 h-4 text-brand-400" /> Allocated Autonomous Units
                           </h4>
                           <div className="space-y-4">
                              {[
                                { name: 'Support Bot', ver: 'v4.2.1', status: 'HEALTHY' },
                                { name: 'Policy Engine', ver: 'v2.0.0', status: 'HEALTHY' },
                                { name: 'IT Ops Unit', ver: 'v1.4.12', status: 'DEGRADED' },
                              ].map(a => (
                                 <div key={a.name} className="p-5 bg-black/40 rounded-[1.5rem] border border-white/5 flex items-center justify-between group cursor-pointer hover:border-brand-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                       <div className={cn(
                                          "w-2 h-2 rounded-full",
                                          a.status === 'HEALTHY' ? "bg-green-500" : "bg-amber-500 animate-pulse"
                                       )} />
                                       <div>
                                          <div className="font-bold text-white text-sm tracking-tight">{a.name}</div>
                                          <div className="text-[9px] font-mono text-slate-600 mt-0.5">{a.ver}</div>
                                       </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                       <button className="p-2 hover:bg-white/5 rounded-lg transition-all"><Settings className="w-4 h-4 text-slate-700" /></button>
                                       <button className="p-2 hover:bg-white/5 rounded-lg transition-all"><ArrowUpRight className="w-4 h-4 text-slate-700" /></button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div>
                           <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-8 flex items-center gap-2">
                              <Database className="w-4 h-4 text-purple-400" /> Active Vector Shards
                           </h4>
                           <div className="grid grid-cols-2 gap-4">
                              {[
                                { name: 'Corporate Master', hits: '1.2M', size: '2.4GB' },
                                { name: 'Support History', hits: '850k', size: '1.2GB' },
                              ].map(kb => (
                                 <div key={kb.name} className="p-5 bg-black/40 rounded-2xl border border-white/5">
                                    <div className="text-xs font-bold text-white mb-4 uppercase tracking-tighter italic">{kb.name}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                       <div className="text-[9px] font-mono text-slate-600">Hits: <span className="text-white">{kb.hits}</span></div>
                                       <div className="text-[9px] font-mono text-slate-600">Size: <span className="text-white">{kb.size}</span></div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>

                     <div className="space-y-12">
                        <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-white/[0.02]">
                           <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-8 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500" /> Platform-level Drift Detection
                           </h4>
                           {env.driftCount > 0 ? (
                              <div className="space-y-6">
                                 <div className="text-3xl font-display font-medium text-amber-500 italic mb-2 tracking-tight">{env.driftCount} Discrepancies Found</div>
                                 <div className="space-y-3">
                                    {['Model: GPT-4o vs Claude 3.5 Sonnet', 'Prompt: v2.3 vs v2.4a', 'Secret: DB_URI mismatch'].map((d) => (
                                       <div key={d} className="flex items-center justify-between text-xs font-mono text-slate-400 group cursor-pointer hover:text-white transition-all">
                                          <div className="flex items-center gap-3">
                                             <Minus className="w-3 h-3 text-red-500" />
                                             {d}
                                          </div>
                                          <RefreshCw className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all text-brand-400" />
                                       </div>
                                    ))}
                                 </div>
                                 <button className="w-full py-4 mt-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-brand-400 hover:bg-brand-500 hover:text-white transition-all">
                                    Initiate Full Cluster Reconciliation
                                 </button>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                                 <ShieldCheck className="w-12 h-12 text-green-500 opacity-50" />
                                 <p className="text-sm font-bold text-green-500 italic uppercase">Cluster Identity bit-perfect with SIT canonical</p>
                              </div>
                           )}
                        </div>

                        <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-white/[0.02]">
                           <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-8 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-purple-400" /> Secrets & Environment Variables
                           </h4>
                           <div className="space-y-4">
                              {['API_GATEWAY_TOKEN', 'FIRESTORE_DB_ID', 'LLM_RETRY_POLICY'].map(k => (
                                 <div key={k} className="flex items-center justify-between px-5 py-3 bg-black/40 rounded-xl border border-white/5">
                                    <span className="text-[10px] font-mono text-slate-500">{k}</span>
                                    <div className="flex items-center gap-2">
                                       <div className="flex gap-1">
                                          {[1,2,3,4,5,6,7,8].map(dotIdx => <div key={`dot-${dotIdx}`} className="w-1.5 h-1.5 rounded-full bg-slate-800" />)}
                                       </div>
                                       <button className="p-1 hover:text-white transition-colors"><LocalEyeIcon className="w-3.5 h-3.5 text-slate-700" /></button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
               </motion.div>
            </AnimatePresence>
         </div>
      </div>

      <DetailDrawer
        isOpen={showRegisterDrawer}
        onClose={() => setShowRegisterDrawer(false)}
        title="Register Infrastructure Cluster"
        subtitle="Multi-tenant Environment Provisioning"
        icon={Server}
        size="md"
        footer={
          <div className="flex gap-3">
             <button onClick={() => setShowRegisterDrawer(false)} className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">
                Cancel
             </button>
             <button className="px-8 py-2.5 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-500/20">
                Initialize Cluster
             </button>
          </div>
        }
      >
        <div className="p-10 space-y-8">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Cluster Name</label>
              <input type="text" placeholder="e.g. STAGING-BRAVO" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-brand-500/50" />
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Deployment Region</label>
              <div className="grid grid-cols-2 gap-3">
                 {['US-East-1', 'EU-West-2', 'Asia-SE-1', 'Global Edge'].map(reg => (
                    <button key={reg} className="p-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-bold text-slate-400 hover:text-white hover:border-white/20 transition-all">
                       {reg}
                    </button>
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Resource Allocation</label>
              <div className="p-6 bg-[#050505] border border-white/10 rounded-3xl space-y-6">
                 {['CPU Fabric', 'GPU Acceleration', 'Vector Memory'].map((it, idx) => (
                    <div key={it} className="space-y-2">
                       <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest">
                          <span>{it}</span>
                          <span className="text-brand-400">{idx === 0 ? 'High' : 'Selective'}</span>
                       </div>
                       <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: idx === 0 ? '80%' : '40%' }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </DetailDrawer>
    </div>
  );
};
