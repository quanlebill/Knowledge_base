import React from 'react';
import { 
  BarChart3, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Download, 
  Filter,
  Search,
  Bot,
  Database,
  Cpu,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const PERFORMANCE_DATA = [
  { time: '09:00', success: 400, failure: 20 },
  { time: '10:00', success: 300, failure: 10 },
  { time: '11:00', success: 500, failure: 50 },
  { time: '12:00', success: 280, failure: 5 },
  { time: '13:00', success: 390, failure: 15 },
  { time: '14:00', success: 430, failure: 10 },
];

const COST_DATA = [
  { time: 'Mon', cost: 120 },
  { time: 'Tue', cost: 150 },
  { time: 'Wed', cost: 420 },
  { time: 'Thu', cost: 300 },
  { time: 'Fri', cost: 280 },
  { time: 'Sat', cost: 110 },
  { time: 'Sun', cost: 95 },
];

const WorkflowObservability = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      <div className="p-8 border-b border-white/5 bg-slate-900/50">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Workflow Observability</h1>
          </div>
          <div className="flex items-center gap-2">
             <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 text-xs font-bold transition-all"><Download className="w-3.5 h-3.5" /> Export Report</button>
             <div className="w-px h-6 bg-white/10 mx-2" />
             <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg">Last 24h</button>
                <button className="px-4 py-1.5 text-slate-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">7 days</button>
                <button className="px-4 py-1.5 text-slate-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">30 days</button>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
          {[
            { label: 'Avg Latency', value: '42.1s', trend: '+2.4%', up: false, icon: Clock },
            { label: 'Token Consumption', value: '42.1M', trend: '+15.2%', up: true, icon: Layers },
            { label: 'Infrastructure Spend', value: '$1.24k', trend: '-4.1%', up: false, icon: Zap },
            { label: 'Success Rate', value: '99.82%', trend: '+0.1%', up: true, icon: CheckCircle2 },
          ].map((stat) => (
            <div key={stat.label} className="p-6 bg-white/[0.02] border border-white/5 rounded-[32px] group hover:bg-white/[0.04] transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-brand-500/10 rounded-2xl group-hover:bg-brand-500/20 transition-all">
                  <stat.icon className="w-5 h-5 text-brand-400" />
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-bold ${stat.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stat.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {stat.trend}
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Success/Failure Chart */}
          <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[32px]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Execution Volume</h3>
                <p className="text-xs text-slate-500 italic">Total workflow runs vs failure rates</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Success</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Failure</span>
                </div>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PERFORMANCE_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="success" fill="#0273c7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failure" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost Allocation Chart */}
          <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[32px]">
            <div className="flex items-center justify-between mb-8">
               <div>
                <h3 className="text-lg font-bold text-white mb-1">Cost Trends</h3>
                <p className="text-xs text-slate-500 italic">Daily infrastructure and token spend</p>
              </div>
              <div className="p-2 bg-brand-500/10 rounded-xl">
                 <Zap className="w-5 h-5 text-brand-400" />
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={COST_DATA}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0273c7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0273c7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="cost" stroke="#0273c7" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottleneck Detection Table */}
        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[32px]">
          <h3 className="text-lg font-bold text-white mb-6">Workflow Bottleneck Analysis</h3>
          <div className="space-y-4">
            {[
              { type: 'AI_AGENT', node: 'Banking_Triage_v2.4', issue: 'Context Window Overflow', impact: 'High (Latency +4s)', icon: Bot },
              { type: 'KB_RETRIEVAL', node: 'GlobalDoc_Search', issue: 'Index Cache Misses', impact: 'Medium (+2.1s)', icon: Database },
              { type: 'INFRA', node: 'API_Gateway_West', issue: 'Throughput Throttle', impact: 'Medium (90% Cap)', icon: Cpu },
            ].map((issue, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-2xl transition-all group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-900 border border-white/10 rounded-xl">
                    <issue.icon className="w-5 h-5 text-slate-500 group-hover:text-brand-400 transition-colors" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm tracking-tight">{issue.node}</div>
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">{issue.issue}</div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                   <div className="text-right">
                      <div className="text-xs font-bold text-amber-500">{issue.impact}</div>
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Impact Analysis</div>
                   </div>
                   <button className="p-3 hover:bg-white/10 rounded-2xl transition-all text-slate-500 hover:text-white"><ArrowRight className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowObservability;
