import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Info, History, Shield, Maximize2, Minimize2 } from 'lucide-react';
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
  isOpen, onClose, title, subtitle, children, footer,
  icon: Icon = Info, size = 'md', tabs, activeTab, onTabChange,
}: DetailDrawerProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100]"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0, width: isExpanded ? 'calc(100% - 24px)' : undefined }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className={cn(
              'fixed top-0 bottom-0 right-0 lg:top-3 lg:bottom-3 lg:right-3',
              'drawer-shell',
              'z-[101] flex flex-col',
              'rounded-t-2xl lg:rounded-2xl overflow-hidden',
              !isExpanded && widthMap[size],
              'max-w-full',
            )}
          >
            {/* ── Black Header ── */}
            <div className="drawer-header px-6 pt-5 pb-0 shrink-0">
              <div className="flex items-center justify-end gap-1.5 mb-3">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={isExpanded ? 'Minimize' : 'Maximize'}
                  className="drawer-ctrl hidden lg:flex w-7 h-7 items-center justify-center rounded-lg transition-all"
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="drawer-ctrl w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-[#B88719] rounded-xl border border-[#8A5A00] shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="drawer-title text-xl font-bold tracking-tight font-display">{title}</h2>
                  {subtitle && (
                    <p className="drawer-subtitle text-[12px] font-medium mt-0.5 leading-snug">{subtitle}</p>
                  )}
                </div>
              </div>

              {tabs && tabs.length > 0 && (
                <div className="flex gap-1 -mb-px relative z-10">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange?.(tab.id)}
                      aria-current={activeTab === tab.id ? 'page' : undefined}
                      className={cn('drawer-tab', activeTab === tab.id && 'active')}
                    >
                      {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── White Body ── */}
            <div className="drawer-body flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </div>

            {/* ── Pale Yellow Footer ── */}
            <div className="drawer-footer px-6 py-3.5 flex items-center justify-between shrink-0 gap-3">
              <div className="flex gap-2 flex-wrap">
                {footer ?? (
                  <>
                    <button className="btn-secondary">
                      <History className="w-3.5 h-3.5" /> History
                    </button>
                    <button className="btn-secondary">
                      <Shield className="w-3.5 h-3.5" /> Audit
                    </button>
                  </>
                )}
              </div>
              {!footer && (
                <span className="text-[10px] text-[#5A5A5A] font-mono whitespace-nowrap">
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
