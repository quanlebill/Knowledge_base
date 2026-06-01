import React, { useState } from 'react';
import { 
  Activity, 
  Cpu, 
  Zap, 
  Clock, 
  AlertCircle, 
  Grid3X3, 
  Terminal, 
  Search, 
  Filter, 
  Pause, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  Network,
  Layers,
  MoreHorizontal,
  ArrowUpRight,
  ShieldCheck,
  Server,
  Cloud,
  HardDrive,
  BarChart3,
  Gauge,
  RefreshCw,
  Rocket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { DeploymentCenterRuntime } from './DeploymentCenter/Runtime';
import { DetailDrawer } from './shared/DetailDrawer';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line
} from 'recharts';

// --- MOCK DATA ---
const FLEET_ALERTS = [
  { id: 'a1', level: 'CRITICAL', msg: 'GPU Cluster US-EAST overloading', time: '2m ago' },
  { id: 'a2', level: 'WARNING', msg: 'Queue depth exceeding SLA (node-b2)', time: '12m ago' },
  { id: 'a3', level: 'INFO', msg: 'Auto-scaled worker fleet +4 nodes', time: '1h ago' },
];

const GLOBAL_JOBS = [
  { id: 'OX-9842', type: 'AGENT_EXEC', status: 'RUNNING', progress: 64, node: 'agent-runtime-prod-01', tenant: 'GlobalCorp', duration: '14s' },
  { id: 'WF-1209', type: 'WORKFLOW_SYNC', status: 'COMPLETED', progress: 100, node: 'wf-engine-02', tenant: 'AeroBank', duration: '1m 4s' },
  { id: 'DP-7731', type: 'MODEL_DEPLOY', status: 'RUNNING', progress: 22, node: 'deploy-svc-blue', tenant: 'System', duration: '4m 12s' },
  { id: 'KB-8821', type: 'KB_INGESTION', status: 'FAILED', progress: 45, node: 'ingest-node-04', tenant: 'GlobalCorp', duration: '12m 42s' },
];

const CLUSTERS = [
  { id: 'C-01', label: 'Compute Alpha', region: 'us-east-1', load: 78, type: 'GPU_OPTIMIZED', status: 'HEALTHY' },
  { id: 'C-02', label: 'Compute Bravo', region: 'eu-west-1', load: 42, type: 'GENERAL_PURPOSE', status: 'HEALTHY' },
  { id: 'C-03', label: 'Agent Runtime', region: 'us-west-2', load: 92, type: 'LOW_LATENCY', status: 'SCALING' },
  { id: 'C-04', label: 'Legacy Sync', region: 'ap-south-1', load: 12, type: 'COLD_STORAGE', status: 'DORMANT' },
];

export const AIOpsCenter = () => {
  const [activeView, setActiveView] = useState<'FLEET' | 'QUEUES' | 'RUNTIME' | 'DEPLOY'>('FLEET');
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<any>(null);

  return (
    <>
      <div className="space-y-8 h-full pb-20">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-brand-400 text-xs font-bold font-mono tracking-widest uppercase mb-3 text-glow-brand">
            <Cpu className="w-4 h-4" />
            Platform Control Plane
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-medium tracking-tight bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent leading-tight">
            AIOps Command Center
          </h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base lg:text-lg max-w-2xl opacity-80">
            Centralized orchestration for the AI operating system. Monitor worker fleets, 
            runtime traces, and distributed execution queues.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:border-white/20 transition-all flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 text-slate-400" />
            Sync Topology
          </button>
          <button className="px-5 py-2.5 bg-brand-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20 active:scale-95">
            Emergency Stop
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-[24px] w-full lg:w-fit overflow-x-auto no-scrollbar shadow-inner">
        {[
          { id: 'FLEET', label: 'Worker Fleet', icon: Cloud },
          { id: 'QUEUES', label: 'Global Queues', icon: Activity },
          { id: 'RUNTIME', label: 'Runtime Traces', icon: Network },
          { id: 'DEPLOY', label: 'Deployment Center', icon: Rocket },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative shrink-0",
              activeView === tab.id 
                ? "bg-white/10 text-white shadow-xl italic" 
                : "text-slate-500 hover:text-white"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeView === tab.id ? "text-brand-400" : "text-slate-600")} />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 h-full"
      >
        {activeView === 'DEPLOY' && (
           <DeploymentCenterRuntime />
        )}

        {activeView === 'FLEET' && (
          <>
            {/* Fleet High Level Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {[
                { id: 'fleet-health', label: 'Fleet Health', val: '99.98%', sub: 'Global Uptime', color: 'text-green-500' },
                { id: 'active-workers', label: 'Active Workers', val: '242', sub: 'Across 12 Clusters', color: 'text-brand-400' },
                { id: 'gpu-util', label: 'GPU Utilization', val: '64%', sub: 'H100/A100 Fleet', color: 'text-amber-500' },
                { id: 'open-alerts', label: 'Open Alerts', val: '3', sub: '2 Critical', color: 'text-red-500' },
              ].map((stat) => (
                <div key={stat.id} className="glass-panel p-6 rounded-3xl border-white/5">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{stat.label}</div>
                  <div className={cn("text-2xl sm:text-3xl font-display font-bold mt-1", stat.color)}>{stat.val}</div>
                  <div className="text-[10px] text-slate-600 font-mono mt-1">{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Cluster Topology */}
            <div className="glass-panel p-6 lg:p-8 rounded-[3rem] border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 blur-[120px] rounded-full" />
               <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 relative z-10 gap-6">
                  <div>
                    <h3 className="text-xl font-display font-medium flex items-center gap-2 mb-2">
                       <Grid3X3 className="w-5 h-5 text-brand-400" />
                       Infrastructure Topology
                    </h3>
                    <p className="text-sm text-slate-500">Real-time status of distributed worker clusters and specialized GPU nodes.</p>
                  </div>
                  <button 
                    onClick={() => setShowConfigDrawer(true)}
                    className="w-full lg:w-auto px-6 py-3 bg-brand-500 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20 active:scale-95"
                  >
                     Scalability Configuration
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                  {CLUSTERS.map(cluster => (
                    <div key={cluster.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 group hover:border-brand-500/30 transition-all hover:bg-brand-500/[0.02]">
                       <div className="flex justify-between items-start mb-6">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                            cluster.status === 'SCALING' ? "bg-amber-500/20 text-amber-500 animate-pulse" :
                            cluster.status === 'DORMANT' ? "bg-slate-500/10 text-slate-500" :
                            "bg-brand-500/10 text-brand-400"
                          )}>
                             <Server className="w-6 h-6" />
                          </div>
                          <div className={cn(
                            "px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest",
                            cluster.status === 'HEALTHY' ? "bg-green-500/10 text-green-500" :
                            cluster.status === 'SCALING' ? "bg-amber-500/10 text-amber-500" :
                            "bg-white/5 text-slate-500"
                          )}>
                             {cluster.status}
                          </div>
                       </div>
                       <div className="mb-8">
                          <h4 className="text-lg font-bold text-white mb-1">{cluster.label}</h4>
                          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{cluster.region} • {cluster.type}</p>
                       </div>
                       <div className="space-y-3">
                          <div className="flex justify-between text-[10px] font-bold">
                             <span className="text-slate-500 uppercase">Load Balance</span>
                             <span className={cn(cluster.load > 90 ? "text-red-500" : "text-white")}>{cluster.load}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${cluster.load}%` }}
                               className={cn(
                                 "h-full rounded-full transition-all duration-1000",
                                 cluster.load > 90 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-brand-500"
                               )} 
                             />
                          </div>
                       </div>
                       <div className="flex gap-2 mt-8">
                          <button className="flex-1 py-2 bg-white/5 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">Details</button>
                          <button className="px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-red-500 transition-all">
                             <RotateCcw className="w-3 h-3" />
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="col-span-12 lg:col-span-8 glass-panel p-6 lg:p-8 rounded-[3rem]">
                  <div className="flex justify-between items-center mb-10">
                     <h3 className="text-lg font-bold flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-brand-400" />
                        Infrastructure Resource History
                     </h3>
                     <div className="flex gap-2">
                        <button className="px-3 py-1 bg-brand-500 text-white text-[9px] font-black rounded-lg">CPU</button>
                        <button className="px-3 py-1 bg-white/5 text-slate-500 text-[9px] font-black rounded-lg hover:text-white">GPU</button>
                        <button className="px-3 py-1 bg-white/5 text-slate-500 text-[9px] font-black rounded-lg hover:text-white">NET</button>
                     </div>
                  </div>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                           { h: '08:00', load: 45, gpu: 20 },
                           { h: '09:00', load: 55, gpu: 35 },
                           { h: '10:00', load: 85, gpu: 60 },
                           { h: '11:00', load: 92, gpu: 95 },
                           { h: '12:00', load: 78, gpu: 70 },
                           { h: '13:00', load: 65, gpu: 40 },
                           { h: '14:00', load: 82, gpu: 65 },
                        ]}>
                           <defs>
                              <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#0c91eb" stopOpacity={0.3}/>
                                 <stop offset="95%" stopColor="#0c91eb" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <XAxis dataKey="h" stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} />
                           <YAxis hide />
                           <Tooltip 
                              contentStyle={{ backgroundColor: '#05091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                              itemStyle={{ fontSize: '10px', color: '#fff' }}
                           />
                           <Area type="monotone" dataKey="load" stroke="#0c91eb" strokeWidth={3} fillOpacity={1} fill="url(#loadGrad)" />
                           <Area type="monotone" dataKey="gpu" stroke="#f59e0b" strokeWidth={2} fillOpacity={0} />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               <div className="col-span-12 lg:col-span-4 space-y-8">
                  <div className="glass-panel p-6 lg:p-8 rounded-[3rem] bg-red-500/5 border-red-500/10">
                     <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        System Anomaly Log
                     </h3>
                     <div className="space-y-4">
                        {FLEET_ALERTS.map(alert => (
                           <div key={alert.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl group hover:border-red-500/30 transition-all cursor-pointer">
                              <div className="flex justify-between items-center mb-1">
                                 <span className={cn(
                                    "text-[8px] font-black uppercase tracking-widest",
                                    alert.level === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'
                                 )}>{alert.level}</span>
                                 <span className="text-[9px] text-slate-500">{alert.time}</span>
                              </div>
                              <p className="text-[11px] text-slate-300 font-medium">{alert.msg}</p>
                           </div>
                        ))}
                     </div>
                     <button className="w-full mt-6 py-3 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-600 transition-all">Clear Resolved</button>
                  </div>
                  
                  <div className="glass-panel p-8 rounded-[3rem]">
                     <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                        <Gauge className="w-5 h-5 text-brand-400" />
                        SLA Compliance
                     </h3>
                     <div className="flex flex-col items-center py-4">
                        <div className="relative w-40 h-40">
                           <svg className="w-full h-full transform -rotate-90">
                              <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                              <circle cx="80" cy="80" r="70" fill="none" stroke="#0c91eb" strokeWidth="12" strokeDasharray="440" strokeDashoffset="44" strokeLinecap="round" />
                           </svg>
                           <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-3xl font-display font-bold text-white">96%</span>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Global Index</span>
                           </div>
                        </div>
                        <p className="text-[10px] text-slate-500 text-center mt-6 uppercase font-bold tracking-widest">Target: 99.9% Latency &lt; 200ms</p>
                     </div>
                  </div>
               </div>
            </div>
          </>
        )}

        {activeView === 'QUEUES' && (
           <div className="glass-panel rounded-[3rem] overflow-hidden border-white/5 flex flex-col min-h-[600px]">
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
                 <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                       <Terminal className="w-5 h-5 text-brand-400" />
                       Global Distributed Execution Trace
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Cross-tenant operational queue monitoring and execution control.</p>
                 </div>
                 <div className="flex gap-2">
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                       <input type="text" placeholder="Filter executions..." className="bg-white/5 border border-white/10 pl-10 pr-4 py-3 rounded-2xl text-xs w-80 focus:outline-none focus:border-brand-500/50" />
                    </div>
                    <button className="p-3 bg-white/5 rounded-2xl border border-white/5 text-slate-500 hover:bg-white/10 transition-colors">
                       <Filter className="w-5 h-5" />
                    </button>
                 </div>
              </div>
              <div className="flex-1 overflow-x-auto no-scrollbar">
                 {/* Desktop View */}
                 <table className="hidden xl:table w-full text-left">
                    <thead className="bg-white/[0.03] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                       <tr>
                          <th className="px-10 py-6">ID / TYPE</th>
                          <th className="px-8 py-6">NODE TARGET</th>
                          <th className="px-8 py-6">TENANT</th>
                          <th className="px-8 py-6">PROGRESS</th>
                          <th className="px-10 py-6 text-right">OPS</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                       {GLOBAL_JOBS.map(job => (
                          <tr key={`desktop-job-${job.id}`} className="group hover:bg-white/[0.01] transition-colors">
                             <td className="px-10 py-6">
                                <div className="flex items-center gap-4">
                                   <div className={cn(
                                      "w-3 h-3 rounded-full",
                                      job.status === 'RUNNING' ? 'bg-brand-500 animate-pulse' : 
                                      job.status === 'COMPLETED' ? 'bg-green-500' : 'bg-red-500'
                                   )} />
                                   <div>
                                      <div className="font-bold text-slate-200 uppercase tracking-tight">{job.type}</div>
                                      <div className="text-[10px] text-slate-500 font-mono mt-1 tracking-widest">{job.id}</div>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <div className="flex items-center gap-3">
                                   <Cpu className="w-4 h-4 text-slate-500" />
                                   <span className="font-mono text-slate-400 text-xs">{job.node}</span>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <span className={cn(
                                   "px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl",
                                   job.tenant === 'GlobalCorp' ? "text-brand-400 border border-brand-500/20" : 
                                   job.tenant === 'AeroBank' ? "text-purple-400 border border-purple-500/20" : "text-slate-500 border border-white/10"
                                )}>{job.tenant}</span>
                             </td>
                             <td className="px-8 py-6 min-w-[200px]">
                                <div className="flex items-center gap-4">
                                   <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${job.progress}%` }}
                                        className={cn(
                                           "h-full transition-all duration-1000",
                                           job.status === 'COMPLETED' ? 'bg-green-500' : 
                                           job.status === 'FAILED' ? 'bg-red-500' : 'bg-brand-500 shadow-[0_0_10px_rgba(12,145,235,0.4)]'
                                        )}
                                      />
                                   </div>
                                   <span className="font-mono font-bold text-slate-400 text-xs w-10 text-right">{job.progress}%</span>
                                </div>
                             </td>
                             <td className="px-10 py-6 text-right">
                                <MoreHorizontal className="w-4 h-4 text-slate-700 group-hover:text-slate-200 cursor-pointer" />
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>

                 {/* Mobile View */}
                 <div className="xl:hidden divide-y divide-white/5">
                    {GLOBAL_JOBS.map(job => (
                       <div key={`mobile-job-${job.id}`} className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                             <div className="flex items-center gap-3">
                                <div className={cn(
                                   "w-2 h-2 rounded-full",
                                   job.status === 'RUNNING' ? 'bg-brand-500 animate-pulse' : 
                                   job.status === 'COMPLETED' ? 'bg-green-500' : 'bg-red-500'
                                )} />
                                <div>
                                   <div className="font-bold text-slate-200 text-sm uppercase">{job.type}</div>
                                   <div className="text-[10px] text-slate-600 font-mono tracking-widest">{job.id}</div>
                                </div>
                             </div>
                             <span className="text-[10px] text-slate-500 font-mono italic">{job.duration}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                             <span className="text-slate-600">Node: <span className="text-slate-400">{job.node}</span></span>
                             <span className="text-brand-400">{job.tenant}</span>
                          </div>
                          <div className="space-y-2">
                             <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                <span>Progress</span>
                                <span>{job.progress}%</span>
                             </div>
                             <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                     "h-full rounded-full transition-all duration-1000",
                                     job.status === 'COMPLETED' ? 'bg-green-500' : 
                                     job.status === 'FAILED' ? 'bg-red-500' : 'bg-brand-500'
                                  )}
                                  style={{ width: `${job.progress}%` }}
                                />
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {activeView === 'RUNTIME' && (
           <div className="flex items-center justify-center h-[500px] glass-panel rounded-[3rem] text-slate-500 italic">
              <div className="text-center group cursor-pointer">
                 <Network className="w-16 h-16 mx-auto mb-6 text-slate-700 group-hover:text-brand-500 transition-all animate-pulse" />
                 <h3 className="text-xl font-bold not-italic text-slate-400 group-hover:text-white transition-all">Agentic Runtime Visualizer</h3>
                 <p className="text-sm mt-2 max-w-sm mx-auto">Live tracing of planner nodes and tool execution steps across the distributed AeroFlow cluster.</p>
                 <button className="mt-10 px-8 py-3 bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-brand-500 hover:text-white transition-all shadow-2xl">
                    Initialize Full Trace Engine
                 </button>
              </div>
           </div>
        )}
      </motion.div>
    </div>

       <DetailDrawer
         isOpen={showConfigDrawer}
         onClose={() => setShowConfigDrawer(false)}
         title="Infrastructure Scalability"
         subtitle="Global Auto-scaling Policy Configuration"
         icon={Gauge}
         size="lg"
         footer={
           <div className="flex gap-3">
              <button 
                onClick={() => setShowConfigDrawer(false)}
                className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                 Cancel
              </button>
              <button className="px-8 py-2.5 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-500/20">
                 Apply Global Policy
              </button>
           </div>
         }
       >
         <div className="p-10 space-y-12">
            <div className="grid grid-cols-2 gap-8">
               <div className="space-y-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Scaling Thresholds</h4>
                  <div className="space-y-4">
                     {['Upscale Threshold', 'Downscale Threshold', 'Cool-down Period'].map((label, idx) => (
                        <div key={label} className="space-y-2">
                           <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 italic">
                              <span>{label}</span>
                              <span className="text-brand-400">{idx === 0 ? '85%' : idx === 1 ? '15%' : '300s'}</span>
                           </div>
                           <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-500" style={{ width: idx === 0 ? '85%' : idx === 1 ? '15%' : '60%' }} />
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Fleet Strategy</h4>
                  <div className="grid grid-cols-1 gap-3">
                     {[
                       { id: 'perf', label: 'Performance Priority', desc: 'Maintain 20% overhead capacity' },
                       { id: 'cost', label: 'Cost Management', desc: 'Aggressive termination of idle nodes' },
                       { id: 'bal', label: 'Balanced Hybrid', desc: 'Predictive scaling based on history' },
                     ].map(strat => (
                        <div key={strat.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:border-brand-500/30 transition-all group">
                           <div className="text-xs font-bold text-white group-hover:text-brand-400 transition-colors uppercase">{strat.label}</div>
                           <p className="text-[10px] text-slate-600 mt-1">{strat.desc}</p>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-8 bg-[#05091a] border border-white/5 rounded-[2.5rem] space-y-6 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[40px]" />
               <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <h4 className="text-sm font-bold uppercase tracking-widest">Safety Limits</h4>
               </div>
               <div className="grid grid-cols-3 gap-6">
                  {[
                    { label: 'Max Node Count', val: '256' },
                    { label: 'Min Node Count', val: '24' },
                    { label: 'Burst Multiplier', val: '2.5x' },
                  ].map((lim, i) => (
                    <div key={lim.label} className="space-y-1">
                       <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{lim.label}</div>
                       <div className="text-xl font-display font-medium text-white italic">{lim.val}</div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
       </DetailDrawer>

       <DetailDrawer
         isOpen={!!selectedCluster}
         onClose={() => setSelectedCluster(null)}
         title={selectedCluster?.label || 'Cluster Inspect'}
         subtitle={`${selectedCluster?.region} • ${selectedCluster?.type}`}
         icon={Server}
         size="xl"
         tabs={[
           { id: 'NODES', label: 'Active Nodes', icon: Grid3X3 },
           { id: 'TRAFFIC', label: 'Traffic Analysis', icon: Activity },
           { id: 'YAML', label: 'Direct Config', icon: Terminal },
         ]}
         activeTab="NODES"
         onTabChange={() => {}}
       >
         <div className="p-10">
            <div className="grid grid-cols-3 gap-6">
               {[1, 2, 3, 4, 5, 6].map(nodeIdx => (
                  <div key={`node-${selectedCluster?.id}-${nodeIdx}`} className="p-6 bg-white/[0.01] border border-white/5 rounded-3xl hover:border-white/20 transition-all group">
                     <div className="flex justify-between items-center mb-6">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-brand-400 transition-colors">
                           <Cpu className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500">n-{selectedCluster?.id}-{nodeIdx}</span>
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between text-[10px] font-bold">
                           <span className="text-slate-600 uppercase">Load</span>
                           <span className="text-white">{(Math.random() * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full bg-brand-500" style={{ width: `${Math.random() * 100}%` }} />
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>
       </DetailDrawer>
    </>
  );
};
