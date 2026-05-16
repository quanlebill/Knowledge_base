import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

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
  className,
}: OperationalHeaderProps) => {
  return (
    <div className={cn('mb-8', className)}>
      {/* Breadcrumb trail */}
      <div className="flex items-center gap-1.5 mb-4">
        {onBack && (
          <button
            onClick={onBack}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#ECE7DA] text-[#6B6B6B] hover:bg-[#F8F6EF] hover:text-[#171717] transition-all mr-1"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.label}>
            {i > 0 && <span className="text-[#D4CBBA] text-xs">/</span>}
            <span className={cn(
              'text-xs font-medium',
              i === breadcrumbs.length - 1 ? 'text-[#6B6B6B]' : 'text-[#B0A99A]',
            )}>
              {crumb.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#171717] tracking-tight leading-none font-display">
              {title}
            </h1>
            {status}
          </div>
          {subtitle && (
            <p className="text-sm text-[#6B6B6B] leading-relaxed max-w-2xl">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
