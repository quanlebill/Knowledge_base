import React from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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

/* Warm icon tints */
const iconStyles: Record<string, { bg: string; border: string; text: string }> = {
  brand:   { bg: 'bg-[#FAF1D0]', border: 'border-[#D9B86C]/30', text: 'text-[#A07830]' },
  emerald: { bg: 'bg-[#EDF5E8]', border: 'border-[#B8D4A8]/50', text: 'text-[#3D7A2F]' },
  amber:   { bg: 'bg-[#FDF5E6]', border: 'border-[#E8C878]/50', text: 'text-[#7C5E1A]' },
  red:     { bg: 'bg-[#FBF0EE]', border: 'border-[#E8B4AE]/50', text: 'text-[#8C3028]' },
  blue:    { bg: 'bg-[#EFF4FB]', border: 'border-[#A8C0E4]/50', text: 'text-[#2D5A9C]' },
};

const trendStyles = {
  UP:      { text: 'text-[#3D7A2F]', icon: ArrowUpRight },
  DOWN:    { text: 'text-[#8C3028]', icon: ArrowDownRight },
  NEUTRAL: { text: 'text-[#8B8B8B]', icon: null },
};

export const MetricCard = ({
  label,
  value,
  trend,
  trendType = 'NEUTRAL',
  icon: Icon,
  color = 'brand',
  description,
}: MetricCardProps) => {
  const ic    = iconStyles[color];
  const tr    = trendStyles[trendType];
  const TIcon = tr.icon;

  return (
    <div className="p-5 bg-white border border-[#ECE7DA] rounded-2xl group hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:border-[#D4CBBA] transition-all relative overflow-hidden">
      {/* Subtle tint blob */}
      <div className={cn(
        'absolute top-0 right-0 w-24 h-24 rounded-full blur-[50px] opacity-40 transition-opacity group-hover:opacity-70',
        ic.bg,
      )} />

      {/* Icon + trend */}
      <div className="relative flex items-center justify-between mb-6">
        <div className={cn('p-2.5 rounded-xl border', ic.bg, ic.border)}>
          <Icon className={cn('w-4 h-4', ic.text)} />
        </div>
        {trend && (
          <div className={cn('flex items-center gap-0.5 text-[10px] font-semibold', tr.text)}>
            {TIcon && <TIcon className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>

      {/* Value + label */}
      <div className="relative">
        <div className="text-2xl font-bold text-[#171717] leading-none mb-1 font-display">{value}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8B8B8B]">{label}</div>
        {description && (
          <p className="text-[11px] text-[#B0A99A] mt-2 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
};

export const StandardMetricsGrid = ({ metrics }: { metrics: any[] }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {metrics.map(m => (
      <MetricCard key={m.label} {...m} />
    ))}
  </div>
);
