import React from 'react';
import { cn } from '../../lib/utils';
import { Activity, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Zap, Target, Clock, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';

export type MetricType = 'PERFORMANCE' | 'VOLUME' | 'EFFICIENCY' | 'COST' | 'HEALTH';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendType?: 'UP' | 'DOWN' | 'NEUTRAL';
  icon: any;
  color?: 'brand' | 'emerald' | 'amber' | 'red' | 'blue';
  description?: string;
}

export const MetricCard = ({ label, value, trend, trendType = 'NEUTRAL', icon: Icon, color = 'brand', description }: MetricCardProps) => {
  const colorStyles = {
    brand: 'bg-brand-500/10 border-brand-500/20 text-brand-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  };

  return (
    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[32px] group hover:bg-white/[0.04] transition-all relative overflow-hidden shadow-xl">
      <div className={cn("absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity", `bg-${color === 'brand' ? 'brand' : color}-500/20`)} />
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className={cn("p-3 rounded-2xl border transition-transform group-hover:scale-110", colorStyles[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-black uppercase tracking-widest",
            trendType === 'UP' ? 'text-emerald-400' : trendType === 'DOWN' ? 'text-red-400' : 'text-slate-500'
          )}>
            {trendType === 'UP' ? <ArrowUpRight className="w-3 h-3" /> : trendType === 'DOWN' ? <ArrowDownRight className="w-3 h-3" /> : null}
            {trend}
          </div>
        )}
      </div>

      <div className="relative z-10">
        <div className="text-3xl font-bold text-white mb-1 uppercase italic tracking-tighter leading-none">{value}</div>
        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{label}</div>
        {description && (
          <p className="text-[10px] text-slate-600 mt-3 italic font-medium leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
};

export const StandardMetricsGrid = ({ metrics }: { metrics: any[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {metrics.map((m) => (
      <MetricCard 
        key={m.label}
        {...m}
      />
    ))}
  </div>
);
