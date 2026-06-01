import React from 'react';
import { 
  Clock, 
  Plus, 
  Search, 
  Calendar, 
  Bell, 
  MoreVertical, 
  Play, 
  Zap, 
  GitMerge, 
  Database, 
  Bot,
  RefreshCcw,
  CheckCircle2,
  Settings2,
  CalendarDays
} from 'lucide-react';
import { motion } from 'motion/react';

const SCHEDULES = [
  { id: 'sc-1', name: 'Global Finance Sync', workflow: 'Multi-Agent Banking Support', type: 'CRON', pattern: '0 */4 * * *', nextRun: '2h 12m', status: 'ACTIVE' },
  { id: 'sc-2', name: 'Knowledge Graph Maintenance', workflow: 'GraphRAG Intelligence Sync', type: 'EVENT', pattern: 'KB_UPDATE_V2', nextRun: 'On Change', status: 'WAITING' },
  { id: 'sc-3', name: 'Dev Weekly Audit', workflow: 'Gov-Compliance Review', type: 'SCHEDULED', pattern: 'Mon @ 09:00', nextRun: '3d 14h', status: 'PAUSED' },
];

const SchedulingCenter = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      <div className="p-8 border-b border-white/5 bg-slate-900/50">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Scheduling Center</h1>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20">
            <Plus className="w-4 h-4" />
            New Trigger
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search schedules, cron patterns, or event IDs..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
             <button className="p-2.5 hover:bg-white/10 text-slate-400 hover:text-white transition-all rounded-lg"><CalendarDays className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main List */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-4">Active Triggers</h3>
            {SCHEDULES.map((sc) => (
              <motion.div 
                key={sc.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-6">
                  <div className={`p-4 rounded-xl bg-slate-900 border border-white/10 ${sc.status === 'ACTIVE' ? 'text-brand-400' : 'text-slate-600'}`}>
                    <RefreshCcw className={`w-5 h-5 ${sc.status === 'ACTIVE' ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '8s' }} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white mb-1 group-hover:text-brand-400 transition-colors">{sc.name}</h4>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded border border-white/10">
                         <GitMerge className="w-3 h-3 text-brand-400" />
                         <span className="text-[10px] font-bold text-slate-400">{sc.workflow}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 italic uppercase">{sc.pattern}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-12">
                   <div className="text-right">
                      <div className="text-xs font-bold text-white mb-1">In {sc.nextRun}</div>
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Next Execution</div>
                   </div>
                   <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-emerald-400 transition-all"><Play className="w-4 h-4" /></button>
                      <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"><Settings2 className="w-4 h-4" /></button>
                      <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"><MoreVertical className="w-4 h-4" /></button>
                   </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right Metrics Panel */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-4">Scheduling Health</h3>
            
            <div className="p-6 bg-brand-500/5 border border-brand-500/20 rounded-3xl">
              <div className="flex items-center justify-between mb-6">
                <Calendar className="w-5 h-5 text-brand-400" />
                <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">SLA: 99.9%</span>
              </div>
              <div className="text-3xl font-display font-bold text-white mb-1">1,242</div>
              <div className="text-xs text-slate-500">Executions scheduled this month</div>
              <div className="mt-8 pt-8 border-t border-brand-500/10 space-y-4">
                 <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-400">Total Cron Jobs</span>
                    <span className="text-white font-bold">12</span>
                 </div>
                 <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-400">Event Triggers</span>
                    <span className="text-white font-bold">156</span>
                 </div>
                 <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-400">Missed Windows</span>
                    <span className="text-emerald-400 font-bold">0</span>
                 </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900 border border-white/5 rounded-3xl">
              <h4 className="text-xs font-bold text-white mb-4">Conflict Alerts</h4>
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
                 <Bell className="w-4 h-4 shrink-0" />
                 <p className="text-[10px] font-medium leading-relaxed">2 workflows overlap on Wednesday 09:00 window. Resource bottleneck detected.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulingCenter;
