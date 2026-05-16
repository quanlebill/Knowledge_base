import React from 'react';
import { 
  Rocket, 
  Activity, 
  ShieldCheck, 
  Clock, 
  Zap, 
  RefreshCw, 
  AlertCircle, 
  ArrowRight,
  BarChart3,
  Search,
  Filter,
  MoreVertical,
  History as HistoryIcon,
  ShieldAlert,
  Server,
  ChevronRight,
  GitPullRequest,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { DeploymentRecord } from '../../types/deployment';
import { MOCK_DEPLOYMENTS, MOCK_ENVIRONMENTS } from '../../constants/deploymentMock';

interface OverviewProps {
  onNewDeployment: () => void;
  onOpenApprovals: () => void;
  onOpenDrift: () => void;
}

export const DeploymentOverview: React.FC<OverviewProps> = ({ 
  onNewDeployment, 
  onOpenApprovals, 
  onOpenDrift 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'FAILED': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'VALIDATING':
      case 'PROMOTING': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'WAITING_APPROVAL': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'ROLLED_BACK': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-500 bg-white/5 border-white/10';
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-brand-400 text-[10px] lg:text-xs font-black font-mono tracking-widest uppercase mb-3 text-glow-blue">
            <Rocket className="w-4 h-4" />
            Control Plane / Release
          </div>
          <h1 className="text-3xl lg:text-5xl font-display font-medium tracking-tight text-white mb-2 italic">Deployment Center</h1>
          <p className="text-slate-500 text-sm lg:text-lg">Orchestrate and promote AI assets across the enterprise lifecycle.</p>
        </div>
        <div className="w-full lg:w-auto">
           <button 
             onClick={onNewDeployment}
             className="w-full lg:w-auto px-6 py-4 lg:py-3 bg-brand-500 text-white rounded-2xl text-[10px] lg:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/20"
           >
             <Zap className="w-4 h-4" /> Create Release Package
           </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
         {[
           { label: 'Active Deployments', val: MOCK_DEPLOYMENTS.filter(d => ['BUILDING', 'VALIDATING', 'PROMOTING'].includes(d.status)).length, icon: Activity, color: 'text-brand-400', onClick: () => {} },
           { label: 'Pending Approvals', val: MOCK_DEPLOYMENTS.filter(d => d.status === 'WAITING_APPROVAL').length, icon: GitPullRequest, color: 'text-purple-400', onClick: onOpenApprovals },
           { label: 'Failed (24h)', val: MOCK_DEPLOYMENTS.filter(d => d.status === 'FAILED').length, icon: ShieldAlert, color: 'text-red-500', onClick: () => {} },
           { label: 'Environment Drift', val: MOCK_ENVIRONMENTS.reduce((acc, curr) => acc + curr.driftCount, 0), icon: RefreshCw, color: 'text-amber-500', onClick: onOpenDrift },
         ].map((stat) => (
            <div 
              key={stat.label} 
              onClick={stat.onClick}
              className="glass-panel p-4 lg:p-8 rounded-[1.5rem] lg:rounded-[2.5rem] border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all cursor-pointer group"
            >
               <div className="flex justify-between items-start mb-4 lg:mb-6">
                  <div className={cn("p-2 lg:p-3 rounded-xl lg:rounded-2xl bg-white/5", stat.color)}>
                     <stat.icon className="w-5 lg:w-6 h-5 lg:h-6" />
                  </div>
                  <div className="hidden lg:block text-[10px] font-black text-slate-700 uppercase tracking-widest">Real-time</div>
               </div>
               <div className="text-2xl lg:text-4xl font-display font-medium text-white group-hover:text-brand-400 transition-colors">{stat.val}</div>
               <div className="text-[9px] lg:text-[10px] text-slate-500 mt-2 font-black uppercase tracking-widest">{stat.label}</div>
            </div>
         ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
         {/* Live Release List */}
         <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <div className="glass-panel rounded-[2rem] lg:rounded-[3rem] overflow-hidden border-white/5 bg-white/[0.01]">
               <div className="px-6 lg:px-10 py-6 lg:py-8 border-b border-white/5 flex flex-col lg:row gap-4 lg:justify-between lg:items-center bg-white/[0.02]">
                  <h3 className="text-lg lg:text-xl font-bold flex items-center gap-3 italic">
                     <HistoryIcon className="w-5 h-5 text-brand-400" />
                     Recent Release Activity
                  </h3>
                  <div className="flex items-center gap-2 lg:gap-4 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                     <div className="relative group shrink-0 lg:shrink">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="Fuzzy search..." 
                          className="bg-black/20 border border-white/10 rounded-xl pl-10 lg:pl-12 pr-4 lg:pr-6 py-2 text-[10px] lg:text-xs w-48 lg:w-64 focus:outline-none focus:border-brand-500/50 transition-all font-mono"
                        />
                     </div>
                     <button className="shrink-0 p-2 lg:p-2.5 bg-white/5 rounded-xl border border-white/10 text-slate-500"><Filter className="w-4 h-4" /></button>
                  </div>
               </div>
               
               <div className="overflow-x-auto no-scrollbar">
                 {/* Desktop Table */}
                 <table className="hidden xl:table w-full text-left">
                    <thead>
                       <tr className="text-[10px] font-black text-slate-600 uppercase tracking-[0.25em] border-b border-white/5">
                          <th className="px-10 py-5">Release Package</th>
                          <th className="px-6 py-5">Target Env</th>
                          <th className="px-6 py-5">Runtime Info</th>
                          <th className="px-6 py-5">Risk</th>
                          <th className="px-6 py-5">Status</th>
                          <th className="px-10 py-5 text-right">Ops</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {MOCK_DEPLOYMENTS.map(dep => (
                          <tr key={`desktop-dep-${dep.id}`} className="group hover:bg-white/[0.02] transition-colors cursor-pointer">
                             <td className="px-10 py-7">
                                <div className="flex items-center gap-4">
                                   <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", getStatusColor(dep.status))}>
                                      <Rocket className="w-4 h-4" />
                                   </div>
                                   <div>
                                      <div className="font-bold text-white group-hover:text-brand-400 transition-colors uppercase tracking-tight italic">{dep.name}</div>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-600 font-mono mt-0.5">
                                         <span className="text-brand-400/70">{dep.id}</span>
                                         <span className="opacity-30">•</span>
                                         <span>{dep.version}</span>
                                      </div>
                                   </div>
                                </div>
                             </td>
                             <td className="px-6 py-7">
                                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black text-slate-400 inline-block tracking-widest">{dep.env}</div>
                             </td>
                             <td className="px-6 py-7">
                                <div className="space-y-1">
                                   <div className="text-[11px] font-bold text-slate-400">{dep.owner}</div>
                                   <div className="text-[9px] font-mono text-slate-600">{dep.startedAt} • {dep.duration}</div>
                                </div>
                             </td>
                             <td className="px-6 py-7">
                                <div className={cn(
                                   "text-sm font-display font-medium",
                                   dep.riskScore > 30 ? "text-red-500" : "text-green-500"
                                )}>{dep.riskScore}</div>
                                <div className="text-[8px] font-black text-slate-700 uppercase">Impact Factor</div>
                             </td>
                             <td className="px-6 py-7">
                                <div className={cn(
                                   "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border inline-flex items-center gap-2",
                                   getStatusColor(dep.status)
                                )}>
                                   {dep.status.replace('_', ' ')}
                                </div>
                             </td>
                             <td className="px-10 py-7 text-right">
                                <button className="p-2 hover:bg-white/10 rounded-xl transition-all"><MoreVertical className="w-4 h-4 text-slate-700" /></button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>

                 {/* Mobile Card List */}
                 <div className="xl:hidden divide-y divide-white/5">
                   {MOCK_DEPLOYMENTS.map(dep => (
                      <div key={`mobile-dep-${dep.id}`} className="p-6 space-y-4 hover:bg-white/[0.01] transition-all">
                        <div className="flex justify-between items-start">
                           <div className="flex items-center gap-3">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", getStatusColor(dep.status))}>
                                 <Rocket className="w-4 h-4" />
                              </div>
                              <div>
                                 <div className="font-bold text-white text-sm uppercase italic tracking-tight">{dep.name}</div>
                                 <div className="text-[10px] text-slate-600 font-mono tracking-widest">{dep.id}</div>
                              </div>
                           </div>
                           <div className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                              getStatusColor(dep.status)
                           )}>
                              {dep.status.split('_')[0]}
                           </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                           <span className="text-slate-500">Env: <span className="text-slate-300">{dep.env}</span></span>
                           <span className="text-slate-500">Risk: <span className={dep.riskScore > 30 ? "text-red-500" : "text-green-500"}>{dep.riskScore}</span></span>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                           <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                 <Activity className="w-2 h-2 text-slate-600" />
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono italic">{dep.owner}</span>
                           </div>
                           <div className="text-[9px] text-slate-600 font-mono">{dep.startedAt}</div>
                        </div>
                      </div>
                   ))}
                 </div>
               </div>
            </div>
         </div>

         {/* Environment Summary Column */}
         <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01]">
               <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center justify-between">
                  Target Infrastructure
                  <RefreshCw className="w-4 h-4 text-slate-700 animate-spin-slow" />
               </h4>
               <div className="space-y-6">
                  {MOCK_ENVIRONMENTS.map(env => (
                     <div key={env.name} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-brand-500/30 transition-all cursor-pointer">
                        <div className="flex justify-between items-center mb-4">
                           <div className="flex items-center gap-3">
                              <Server className={cn(
                                 "w-5 h-5",
                                 env.status === 'HEALTHY' ? "text-green-500" : "text-amber-500"
                              )} />
                              <span className="text-sm font-bold text-white uppercase tracking-widest">{env.name} Instance</span>
                           </div>
                           <div className={cn(
                              "w-2 h-2 rounded-full",
                              env.status === 'HEALTHY' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-amber-500 animate-pulse"
                           )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                           <div>
                              <div className="text-[9px] font-black text-slate-700 uppercase mb-1">Agent Density</div>
                              <div className="text-xl font-display font-medium text-white">{env.agentCount}</div>
                           </div>
                           <div>
                              <div className="text-[9px] font-black text-slate-700 uppercase mb-1">KB Integrity</div>
                              <div className="text-xl font-display font-medium text-white">{env.kbCount}</div>
                           </div>
                        </div>
                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                           <span className="text-[10px] font-mono text-slate-600">Runtime: {env.runtimeVersion}</span>
                           <ArrowUpRight className="w-4 h-4 text-slate-800 group-hover:text-brand-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            <div className="glass-panel p-8 rounded-[2.5rem] border-brand-500/20 bg-brand-500/5 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 rotate-12 opacity-5 scale-150 group-hover:rotate-0 transition-transform duration-700">
                  <Zap className="w-32 h-32 text-brand-400" />
               </div>
               <h4 className="text-xl font-display font-medium mb-4 italic">Heuristic Drift Auditor</h4>
               <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  Platform has detected <span className="text-amber-500 font-bold">12 environment-level configuration mismatches</span> across UAT/PROD boundary. 
               </p>
               <button 
                 onClick={onOpenDrift}
                 className="w-full py-4 bg-white text-black font-black rounded-2xl text-[10px] tracking-widest uppercase hover:bg-slate-200 transition-all shadow-xl shadow-white/5"
               >
                  Initiate Reconciliation
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};
