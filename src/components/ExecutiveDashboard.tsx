import React from 'react';
import { 
  TrendingUp, 
  Activity, 
  ShieldCheck, 
  Database,
  Calendar,
  ChevronRight,
  ArrowRight,
  Zap,
  Globe,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';

const DATA = [
  { name: 'Mon', value: 400, cost: 240 },
  { name: 'Tue', value: 700, cost: 380 },
  { name: 'Wed', value: 600, cost: 310 },
  { name: 'Thu', value: 900, cost: 520 },
  { name: 'Fri', value: 1100, cost: 680 },
  { name: 'Sat', value: 1000, cost: 590 },
  { name: 'Sun', value: 1200, cost: 720 },
];

const TOP_ISSUES = [
  { label: 'Ingestion pipeline failed in EU-WEST-1', risk: 'HIGH', impact: '24 bots' },
  { label: 'Unresolved knowledge conflict in Compliance', risk: 'MEDIUM', impact: '4 users' },
  { label: 'Embedding cost spike detected', risk: 'LOW', impact: 'Finance alert' },
];

export const ExecutiveDashboard = () => {
  const mainMetrics = [
    { label: 'Knowledge Freshness', value: '98.2%', trend: '+0.5%', trendType: 'UP' as const, icon: Database, color: 'brand' as const },
    { label: 'Mean Hallucination Risk', value: '0.14%', trend: '-0.02%', trendType: 'DOWN' as const, icon: ShieldCheck, color: 'emerald' as const },
    { label: 'Calculated Cost Savings', value: '$3.4M', trend: '+$420k', trendType: 'UP' as const, icon: TrendingUp, color: 'blue' as const },
    { label: 'Platform Availability', value: '99.999%', trend: 'OPTIMAL', trendType: 'NEUTRAL' as const, icon: Activity, color: 'amber' as const },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <OperationalHeader 
        title="Executive Pulse"
        subtitle="Operational Intelligence & Human-AI Lifecycle Overview"
        breadcrumbs={[{ label: 'Executive' }, { label: 'Pulse' }]}
        status={<StatusBadge status="STABLE" size="lg" />}
        actions={
          <div className="flex gap-3">
             <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5">
                <Calendar className="w-4 h-4" />
                LAST 30 DAYS
              </button>
              <button className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-95">
                DOWNLOAD REPORT
              </button>
          </div>
        }
      />

      <StandardMetricsGrid metrics={mainMetrics} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Operational Chart */}
        <div className="lg:col-span-2 p-8 bg-white/[0.02] border border-white/5 rounded-[40px] shadow-2xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-bold text-white uppercase italic tracking-tight">Processing Throughput</h3>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1 italic">Semantic ingestion vs Token generation across fabric</p>
            </div>
            <div className="flex gap-2">
               <div className="flex items-center gap-2 px-3 py-1 bg-brand-500/10 rounded-full border border-brand-500/20 text-[9px] font-bold text-brand-400">
                 <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                 INGESTION
               </div>
               <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 text-[9px] font-bold text-blue-400">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                 GENERATION
               </div>
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DATA}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0273c7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0273c7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '16px' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="value" stroke="#0273c7" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                <Area type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Global Compliance & Issues */}
        <div className="space-y-8">
          <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[40px] shadow-2xl">
            <h3 className="text-xl font-bold text-white uppercase italic tracking-tight mb-8">Active Risks</h3>
            <div className="space-y-6">
              {TOP_ISSUES.map((issue, i) => (
                <div key={issue.label} className="group cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        issue.risk === 'HIGH' ? 'bg-red-500' : issue.risk === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-500'
                      )} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {issue.risk} RISK
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-brand-400 transition-colors" />
                  </div>
                  <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{issue.label}</p>
                  <p className="text-[9px] text-slate-600 font-medium uppercase mt-1">IMPACT: {issue.impact}</p>
                  {i < TOP_ISSUES.length - 1 && <div className="h-px bg-white/5 mt-6" />}
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 bg-brand-500/5 border border-brand-500/10 rounded-[40px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 blur-[60px]" />
            <h3 className="text-lg font-bold text-white uppercase italic tracking-tight mb-2">AI Copilot Insights</h3>
            <p className="text-xs text-slate-400 leading-relaxed italic">
              "System efficiency has increased by 14% since the last model promotion. EU-WEST latency spike is correlated with the new embedding release."
            </p>
            <button className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-brand-400 hover:text-white transition-colors">
              Read Analysis <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
