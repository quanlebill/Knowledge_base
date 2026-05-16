import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertCircle, XCircle, Clock, ShieldCheck } from 'lucide-react';

export type StatusType = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'STABLE' | 'PROCESSING' | 'PENDING' | 'ACTIVE' | 'INACTIVE';

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge = ({ status, className, size = 'md' }: StatusBadgeProps) => {
  const getStatusStyles = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes('HEALTHY') || s.includes('STABLE') || s.includes('ACTIVE') || s.includes('COMPLETED') || s.includes('SUCCESS')) {
      return {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        text: 'text-emerald-400',
        icon: CheckCircle2
      };
    }
    if (s.includes('WARNING') || s.includes('PENDING') || s.includes('DRIFT') || s.includes('DEGRADED')) {
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        text: 'text-amber-400',
        icon: AlertCircle
      };
    }
    if (s.includes('CRITICAL') || s.includes('FAILED') || s.includes('ERROR') || s.includes('BLOCKED')) {
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        text: 'text-red-400',
        icon: XCircle
      };
    }
    if (s.includes('PROCESSING') || s.includes('RUNNING') || s.includes('SYNCING') || s.includes('DEPLOYING')) {
      return {
        bg: 'bg-brand-500/10',
        border: 'border-brand-500/20',
        text: 'text-brand-400',
        icon: Clock
      };
    }
    return {
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/20',
      text: 'text-slate-400',
      icon: Clock
    };
  };

  const styles = getStatusStyles(status);
  const Icon = styles.icon;

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[9px]',
    md: 'px-2 py-0.5 text-[10px]',
    lg: 'px-3 py-1 text-xs'
  };

  return (
    <div className={cn(
      "flex items-center gap-1.5 font-bold uppercase tracking-widest rounded-full border shadow-sm transition-all",
      styles.bg,
      styles.border,
      styles.text,
      sizeStyles[size],
      className
    )}>
      <Icon className={cn(
        size === 'sm' ? "w-2.5 h-2.5" : size === 'md' ? "w-3 h-3" : "w-4 h-4",
        (status.toUpperCase().includes('PROCESSING') || status.toUpperCase().includes('SYNCING')) && "animate-spin-slow"
      )} />
      {status}
    </div>
  );
};
