import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertCircle, XCircle, Clock, ShieldCheck } from 'lucide-react';

export type StatusType =
  | 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'STABLE' | 'PROCESSING'
  | 'PENDING' | 'ACTIVE' | 'INACTIVE' | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/* Warm muted tones — olive green · sand amber · dusty rose · gold · slate */
const getStyles = (status: string) => {
  const s = status.toUpperCase();

  if (s.includes('HEALTHY') || s.includes('STABLE') || s.includes('ACTIVE') || s.includes('COMPLETED') || s.includes('SUCCESS') || s.includes('SECURE') || s.includes('OPTIMAL') || s.includes('COMPLIANT')) {
    return {
      bg:   'bg-[#EDF5E8]',
      border: 'border-[#B8D4A8]',
      text: 'text-[#3D7A2F]',
      icon: CheckCircle2,
    };
  }
  if (s.includes('WARNING') || s.includes('PENDING') || s.includes('DRIFT') || s.includes('DEGRADED') || s.includes('ACTION')) {
    return {
      bg:   'bg-[#FDF5E6]',
      border: 'border-[#E8C878]',
      text: 'text-[#7C5E1A]',
      icon: AlertCircle,
    };
  }
  if (s.includes('CRITICAL') || s.includes('FAILED') || s.includes('ERROR') || s.includes('BLOCKED')) {
    return {
      bg:   'bg-[#FBF0EE]',
      border: 'border-[#E8B4AE]',
      text: 'text-[#8C3028]',
      icon: XCircle,
    };
  }
  if (s.includes('PROCESSING') || s.includes('RUNNING') || s.includes('SYNCING') || s.includes('DEPLOYING') || s.includes('AUTOSCALING')) {
    return {
      bg:   'bg-[#FAF1D0]',
      border: 'border-[#D9B86C]/50',
      text: 'text-[#7C6230]',
      icon: Clock,
    };
  }
  if (s.includes('INACTIVE') || s.includes('DORMANT') || s.includes('PAUSED')) {
    return {
      bg:   'bg-[#F3F0EB]',
      border: 'border-[#D4CBBA]',
      text: 'text-[#6B6B6B]',
      icon: Clock,
    };
  }
  return {
    bg:   'bg-[#F8F6EF]',
    border: 'border-[#ECE7DA]',
    text: 'text-[#6B6B6B]',
    icon: Clock,
  };
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[9px] gap-1',
  md: 'px-2 py-0.5 text-[10px] gap-1',
  lg: 'px-2.5 py-1 text-[10px] gap-1.5',
};

const iconSizes = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
};

export const StatusBadge = ({ status, className, size = 'md' }: StatusBadgeProps) => {
  const styles = getStyles(status);
  const Icon   = styles.icon;
  const isSpinning = status.toUpperCase().includes('PROCESSING') || status.toUpperCase().includes('SYNCING');

  return (
    <div className={cn(
      'inline-flex items-center font-semibold uppercase tracking-wide rounded-full border transition-all',
      styles.bg,
      styles.border,
      styles.text,
      sizeStyles[size],
      className,
    )}>
      <Icon className={cn(iconSizes[size], isSpinning && 'animate-spin-slow')} />
      {status}
    </div>
  );
};
