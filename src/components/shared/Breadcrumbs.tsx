import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BreadcrumbsProps {
  items: { label: string; href?: string }[];
  className?: string;
}

export const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => {
  return (
    <nav className={cn("flex items-center gap-2", className)}>
      <Home className="w-3.5 h-3.5 text-slate-600" />
      <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <button 
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
              index === items.length - 1 
                ? "text-brand-400 cursor-default" 
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {item.label}
          </button>
          {index < items.length - 1 && (
            <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
