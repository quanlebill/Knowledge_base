import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Info, History, Shield, Activity, Share2 } from 'lucide-react';
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
  onTabChange
}: DetailDrawerProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const widthClasses = {
    sm: 'w-[420px]',
    md: 'w-[600px]',
    lg: 'w-[800px]',
    xl: 'w-[1000px]',
    full: 'w-full'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0, width: isExpanded ? 'calc(100% - 32px)' : undefined }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
               "fixed top-0 bottom-0 right-0 lg:top-4 lg:bottom-4 lg:right-4 h-auto bg-[#080808] border border-white/5 z-[101] shadow-2xl flex flex-col rounded-l-[3rem] lg:rounded-[3rem] overflow-hidden",
               !isExpanded && widthClasses[size],
               "max-w-full"
            )}
          >
            {/* Header */}
            <div className="p-8 border-b border-white/5 relative bg-[#0a0a0a] shrink-0">
              <div className="absolute top-8 right-8 flex items-center gap-2">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/5 rounded-xl border border-white/5 text-slate-500 hover:text-white transition-all shadow-inner hidden lg:block"
                >
                  {isExpanded ? <ChevronRight className="w-5 h-5 rotate-180" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-xl border border-white/5 text-slate-500 hover:text-white transition-all shadow-inner"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-4 mb-2">
                <div className="p-4 bg-brand-500/10 rounded-2xl border border-brand-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                  <Icon className="w-6 h-6 text-brand-400" />
                </div>
                <div>
                   <h2 className="text-2xl font-bold text-white tracking-tight uppercase italic">{title}</h2>
                   {subtitle && <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mt-1">{subtitle}</p>}
                </div>
              </div>

              {/* Tabs Integration */}
              {tabs && tabs.length > 0 && (
                <div className="flex gap-8 mt-10 border-b border-white/5 -mb-6 pb-px">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange?.(tab.id)}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest pb-4 relative transition-all",
                        activeTab === tab.id ? "text-brand-400" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-2">
                         {tab.icon && <tab.icon className="w-3 h-3" />}
                         {tab.label}
                      </div>
                      {activeTab === tab.id && (
                        <motion.div 
                          layoutId="drawer-active-tab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-white/5 bg-[#0a0a0a] flex items-center justify-between shrink-0">
               <div className="flex gap-4">
                  {footer ? footer : (
                    <>
                      <button className="flex items-center gap-2 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all">
                        <History className="w-3.5 h-3.5" />
                        Full History
                      </button>
                      <button className="flex items-center gap-2 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all">
                        <Shield className="w-3.5 h-3.5" />
                        Audit Logs
                      </button>
                    </>
                  )}
               </div>
               {!footer && (
                 <div className="text-[10px] text-slate-700 font-mono italic">
                   ENTITY_TRACE_ID: {Math.random().toString(36).substring(7).toUpperCase()}
                 </div>
               )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
