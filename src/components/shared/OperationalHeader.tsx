import React from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import { cn } from '../../lib/utils';
import { ChevronLeft } from 'lucide-react';

interface OperationalHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs: { label: string; href?: string }[];
  actions?: React.ReactNode;
  status?: React.ReactNode;
  onBack?: () => void;
  className?: string;
}

export const OperationalHeader = ({ 
  title, 
  subtitle, 
  breadcrumbs, 
  actions, 
  status, 
  onBack,
  className 
}: OperationalHeaderProps) => {
  return (
    <div className={cn("mb-8 space-y-4", className)}>
      <div className="flex items-center gap-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-xl border border-white/5 text-slate-400 hover:text-white transition-all shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <Breadcrumbs items={breadcrumbs} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-none uppercase italic">{title}</h1>
            {status}
          </div>
          {subtitle && (
            <p className="text-slate-500 font-medium tracking-tight text-xs sm:text-sm uppercase opacity-80 max-w-2xl">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {actions}
        </div>
      </div>
    </div>
  );
};
