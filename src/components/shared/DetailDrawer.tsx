import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Info, History, Shield, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: any;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  tabs?: { id: string; label: string; icon?: any }[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

const widthMap = {
  sm:   'w-[420px]',
  md:   'w-[600px]',
  lg:   'w-[760px]',
  xl:   'w-[960px]',
  full: 'w-full',
};

export const DetailDrawer = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  icon: Icon = Info,
  size = 'md',
  tabs,
  activeTab,
  onTabChange,
}: DetailDrawerProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/12 backdrop-blur-[2px] z-[100]"
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0, width: isExpanded ? 'calc(100% - 24px)' : undefined }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className={cn(
              'fixed top-0 bottom-0 right-0',
              'lg:top-3 lg:bottom-3 lg:right-3',
              'bg-white border border-[#ECE7DA]',
              'shadow-[0_8px_48px_rgba(0,0,0,0.12)]',
              'z-[101] flex flex-col',
              'rounded-t-3xl lg:rounded-3xl overflow-hidden',
              !isExpanded && widthMap[size],
              'max-w-full',
            )}
          >
            {/* ── Header ── */}
            <div className="px-6 pt-6 pb-0 bg-[#FCFBF7] border-b border-[#ECE7DA] shrink-0">
              {/* Controls */}
              <div className="flex items-center justify-end gap-1.5 mb-4">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg text-[#8B8B8B] hover:text-[#171717] hover:bg-[#F3EFE3] border border-[#ECE7DA] transition-all"
                >
                  {isExpanded
                    ? <Minimize2 className="w-3.5 h-3.5" />
                    : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8B8B8B] hover:text-[#171717] hover:bg-[#F3EFE3] border border-[#ECE7DA] transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Title block */}
              <div className="flex items-start gap-4 mb-5">
                <div className="p-3 bg-[#FAF1D0] rounded-xl border border-[#D9B86C]/25 shrink-0">
                  <Icon className="w-5 h-5 text-[#A07830]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-[#171717] tracking-tight font-display">{title}</h2>
                  {subtitle && (
                    <p className="text-[11px] text-[#8B8B8B] font-medium mt-0.5 leading-snug">{subtitle}</p>
                  )}
                </div>
              </div>

              {/* Tabs */}
              {tabs && tabs.length > 0 && (
                <div className="flex gap-1 -mb-px">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange?.(tab.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold relative transition-all rounded-t-xl',
                        activeTab === tab.id
                          ? 'text-[#171717] bg-white border border-b-0 border-[#ECE7DA]'
                          : 'text-[#8B8B8B] hover:text-[#4A4A4A]',
                      )}
                    >
                      {tab.icon && <tab.icon className="w-3 h-3" />}
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
              {children}
            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-4 border-t border-[#ECE7DA] bg-[#FCFBF7] flex items-center justify-between shrink-0">
              <div className="flex gap-2">
                {footer ?? (
                  <>
                    <button className="flex items-center gap-1.5 py-2 px-3 bg-white hover:bg-[#F8F6EF] rounded-lg border border-[#ECE7DA] text-[11px] font-semibold text-[#4A4A4A] uppercase tracking-wide transition-all">
                      <History className="w-3.5 h-3.5 text-[#8B8B8B]" />
                      History
                    </button>
                    <button className="flex items-center gap-1.5 py-2 px-3 bg-white hover:bg-[#F8F6EF] rounded-lg border border-[#ECE7DA] text-[11px] font-semibold text-[#4A4A4A] uppercase tracking-wide transition-all">
                      <Shield className="w-3.5 h-3.5 text-[#8B8B8B]" />
                      Audit Logs
                    </button>
                  </>
                )}
              </div>
              {!footer && (
                <span className="text-[9px] text-[#D0C9BB] font-mono">
                  TRACE: {Math.random().toString(36).substring(7).toUpperCase()}
                </span>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
