import React from 'react';
import { Play, Layers, Activity, AlertCircle, Terminal, Filter, Search, ArrowRight, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';

export const JobCenter = () => {
  const JOBS = [
    { id: 'j1', name: 'Embedding: Product Catalog V5', startTime: '10:30 AM', progress: 75, status: 'RUNNING', type: 'EMBEDDING', priority: 'HIGH' },
    { id: 'j2', name: 'OCR: Archives_Folder_14', startTime: '09:45 AM', progress: 100, status: 'COMPLETED', type: 'OCR', priority: 'NORMAL' },
    { id: 'j3', name: 'Graph Extraction: Entity_Map_Nexus', startTime: '11:15 AM', progress: 12, status: 'RUNNING', type: 'GRAPH_SYNC', priority: 'HIGH' },
    { id: 'j4', name: 'Normalization: Financial_Reports_Q1', startTime: '08:00 AM', progress: 100, status: 'COMPLETED', type: 'NORMALIZATION', priority: 'NORMAL' },
    { id: 'j5', name: 'Compliance Sweep: Legal_Docs_Fleet', startTime: '12:00 PM', progress: 5, status: 'RUNNING', type: 'SCAN', priority: 'CRITICAL' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       <div className="grid grid-cols-4 gap-6">
          {[
            { label: 'Active Jobs', val: '12', icon: Play, color: 'brand' },
            { label: 'Queue Depth', val: '4,842', icon: Layers, color: 'purple' },
            { label: 'Fleet Utility', val: '84%', icon: Activity, color: 'amber' },
            { label: 'Failures (24h)', val: '0', icon: AlertCircle, color: 'green' }
          ].map((m, i) => (
            <div key={i} className="glass-panel p-6 rounded-3xl border-white/5">
               <div className="flex justify-between items-center mb-4">
                  <div className="p-2 bg-white/5 rounded-xl">
                     <m.icon className={cn("w-4 h-4", m.color === 'brand' ? 'text-brand-400' : m.color === 'purple' ? 'text-purple-400' : m.color === 'amber' ? 'text-amber-400' : 'text-green-500')} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">STATUS: OK</span>
               </div>
               <div className="text-2xl font-display font-medium text-white">{m.val}</div>
               <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">{m.label}</div>
            </div>
          ))}
       </div>

       <div className="glass-panel rounded-[2.5rem] border-white/5 bg-black/20 overflow-hidden">
          <div className="p-8 border-b border-white/5 flex justify-between items-center">
             <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-3">
                <Terminal className="w-5 h-5 text-brand-400" />
                Processing Pipelines
             </h3>
             <div className="flex gap-2">
                <button className="p-2 bg-white/5 rounded-lg text-slate-500 border border-white/10"><Filter className="w-4 h-4" /></button>
                <button className="p-2 bg-white/5 rounded-lg text-slate-500 border border-white/10"><Search className="w-4 h-4" /></button>
             </div>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-white/5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5">
                   <tr>
                      <th className="px-8 py-4">Job Identification</th>
                      <th className="px-6 py-4">Execution Type</th>
                      <th className="px-6 py-4">Progress / State</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-8 py-4 text-right">Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                   {JOBS.map(job => (
                      <tr key={job.id} className="group hover:bg-white/[0.02] transition-colors">
                         <td className="px-8 py-5">
                            <div>
                               <div className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors uppercase truncate max-w-xs">{job.name}</div>
                               <div className="text-[10px] text-slate-600 font-mono mt-0.5">{job.id} • Started {job.startTime}</div>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-black text-slate-500 uppercase tracking-widest border border-white/10">
                               {job.type}
                            </span>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-4 max-w-[200px]">
                               <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div className={cn(
                                    "h-full transition-all duration-1000 shadow-[0_0_8px_rgba(12,145,235,0.3)]",
                                    job.status === 'RUNNING' ? 'bg-brand-500' : 'bg-green-500'
                                  )} style={{ width: `${job.progress}%` }} />
                               </div>
                               <span className="text-[10px] font-mono text-slate-500">{job.progress}%</span>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-tight",
                              job.priority === 'CRITICAL' ? 'text-red-500' : job.priority === 'HIGH' ? 'text-orange-500' : 'text-slate-500'
                            )}>
                               {job.priority}
                            </span>
                         </td>
                         <td className="px-8 py-5 text-right">
                            <button className="p-2 hover:bg-brand-500/10 rounded-xl text-slate-500 hover:text-brand-400 transition-all">
                               <ArrowRight className="w-4 h-4" />
                            </button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
};
