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
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100]"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0, width: isExpanded ? 'calc(100% - 24px)' : undefined }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className={cn(
              'fixed top-0 bottom-0 right-0 lg:top-3 lg:bottom-3 lg:right-3',
              'bg-white border border-[#BFA66A]',
              'shadow-[0_12px_48px_rgba(0,0,0,0.18)]',
              'z-[101] flex flex-col',
              'rounded-t-2xl lg:rounded-2xl overflow-hidden',
              !isExpanded && widthMap[size],
              'max-w-full',
            )}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-0 bg-[#FFF8E1] border-b border-[#D8CBAA] shrink-0">
              <div className="flex items-center justify-end gap-1.5 mb-3">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={isExpanded ? 'Minimize' : 'Maximize'}
                  className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg text-[#3F3F3F] hover:text-[#111111] hover:bg-[#F8EBC4] border border-[#BFA66A] transition-all"
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#3F3F3F] hover:text-[#111111] hover:bg-[#F8EBC4] border border-[#BFA66A] transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-[#F4E8C3] rounded-xl border border-[#BFA66A] shrink-0">
                  <Icon className="w-5 h-5 text-[#B88719]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-[#111111] tracking-tight font-display">{title}</h2>
                  {subtitle && (
                    <p className="text-[12px] text-[#3F3F3F] font-medium mt-0.5 leading-snug">{subtitle}</p>
                  )}
                </div>
              </div>

              {tabs && tabs.length > 0 && (
                <div className="flex gap-1 -mb-px">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange?.(tab.id)}
                      aria-current={activeTab === tab.id ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold relative transition-all rounded-t-xl',
                        activeTab === tab.id
                          ? 'text-[#111111] bg-white border border-b-0 border-[#BFA66A]'
                          : 'text-[#3F3F3F] hover:text-[#111111]',
                      )}
                    >
                      {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
              {children}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-[#D8CBAA] bg-white flex items-center justify-between shrink-0">
              <div className="flex gap-2">
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
                <span className="text-[10px] text-[#5F5F5F] font-mono">
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
