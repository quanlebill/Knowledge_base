import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Info, History, Shield, Maximize2, Minimize2, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

/* ─── Drawer size system ──────────────────────────────────────────── */
export type DrawerSizeKey =
  | 'compact' | 'standard' | 'wide' | 'xwide' | 'workspace'
  /* legacy aliases */
  | 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface SizeRange { min: number; default: number; max: number }

const SIZE_CONFIG: Record<'compact' | 'standard' | 'wide' | 'xwide' | 'workspace', SizeRange> = {
  compact:   { min: 420, default: 480,  max: 520 },
  standard:  { min: 560, default: 680,  max: 760 },
  wide:      { min: 760, default: 920,  max: 1080 },
  xwide:     { min: 960, default: 1100, max: 1280 },
  workspace: { min: 960, default: 1280, max: 1440 },
};

const SIZE_ALIAS: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', keyof typeof SIZE_CONFIG> = {
  sm:   'compact',
  md:   'standard',
  lg:   'wide',
  xl:   'xwide',
  full: 'workspace',
};

const resolveSize = (s: DrawerSizeKey): keyof typeof SIZE_CONFIG => {
  return (SIZE_ALIAS as any)[s] ?? (s as keyof typeof SIZE_CONFIG);
};

const useViewportWidth = () => {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
};

const computeDefaultWidth = (sizeKey: keyof typeof SIZE_CONFIG, vw: number): number => {
  if (sizeKey === 'xwide')     return Math.min(Math.round(vw * 0.72), SIZE_CONFIG.xwide.max);
  if (sizeKey === 'workspace') return Math.min(Math.round(vw * 0.85), SIZE_CONFIG.workspace.max);
  return SIZE_CONFIG[sizeKey].default;
};

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: any;
  size?: DrawerSizeKey;
  tabs?: { id: string; label: string; icon?: any }[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  /* Persistent key for remembering user-resized width */
  persistKey?: string;
  /* Lock the modal to a consistent height so tab switches don't resize it */
  fixedHeight?: boolean;
}

export const DetailDrawer = ({
  isOpen, onClose, title, subtitle, children, footer,
  icon: Icon = Info, size = 'standard', tabs, activeTab, onTabChange,
  persistKey, fixedHeight = false,
}: DetailDrawerProps) => {
  const sizeKey   = resolveSize(size);
  const sizeRange = SIZE_CONFIG[sizeKey];
  const vw        = useViewportWidth();
  const isMobile  = vw < 768;
  const storageKey = persistKey ? `drawer-w:${persistKey}` : `drawer-w:${sizeKey}`;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return sizeRange.default;
    const stored = parseInt(localStorage.getItem(storageKey) || '', 10);
    if (!Number.isNaN(stored) && stored >= sizeRange.min && stored <= sizeRange.max) return stored;
    return computeDefaultWidth(sizeKey, window.innerWidth);
  });

  /* Recompute defaults whenever the size key changes (e.g., same drawer reopened with new size) */
  useEffect(() => {
    const stored = parseInt(localStorage.getItem(storageKey) || '', 10);
    if (!Number.isNaN(stored) && stored >= sizeRange.min && stored <= sizeRange.max) {
      setWidth(stored);
    } else {
      setWidth(computeDefaultWidth(sizeKey, vw));
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sizeKey, storageKey]);

  /* Clamp width on viewport resize */
  useEffect(() => {
    const maxAllowed = Math.min(sizeRange.max, vw - 40);
    if (width > maxAllowed) setWidth(maxAllowed);
  }, [vw, width, sizeRange.max]);

  /* Resize-handle drag */
  const isResizing = useRef(false);
  const startResize = useCallback((e: React.MouseEvent) => {
    if (isFullscreen || isMobile) return;
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX;
      const maxAllowed = Math.min(sizeRange.max, window.innerWidth - 40);
      const next = Math.max(sizeRange.min, Math.min(maxAllowed, startWidth + delta));
      setWidth(next);
    };
    const onUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      try { localStorage.setItem(storageKey, String(width)); } catch {}
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, sizeRange.min, sizeRange.max, isFullscreen, isMobile, storageKey]);

  /* Persist width when user finishes dragging or toggles fullscreen */
  useEffect(() => {
    if (!isResizing.current && !isFullscreen) {
      try { localStorage.setItem(storageKey, String(width)); } catch {}
    }
  }, [width, storageKey, isFullscreen]);

  /* Computed visual width — mobile is 100vw, fullscreen is viewport minus margins */
  const renderedWidth = isMobile
    ? '100vw'
    : isFullscreen
      ? 'calc(100vw - 24px)'
      : `${width}px`;

  if (typeof window === 'undefined') return null;

  return createPortal(
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
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[160]"
          />

          {/* Center wrapper */}
          <div className="fixed inset-0 z-[161] flex items-center justify-center pointer-events-none p-4 lg:p-6">
          {/* Sheet */}
          <motion.div
            key="drawer-sheet"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            style={{
              width: isFullscreen ? 'calc(100vw - 24px)' : (isMobile ? '100%' : `${width}px`),
              maxHeight: isFullscreen ? 'calc(100vh - 24px)' : (isMobile ? '100%' : 'calc(100vh - 48px)'),
              ...(fixedHeight && !isMobile && !isFullscreen ? { height: 'calc(100vh - 48px)' } : {}),
            }}
            className={cn(
              'pointer-events-auto',
              'drawer-shell',
              'flex flex-col',
              isMobile ? 'rounded-none w-full h-full' : 'rounded-2xl',
              'overflow-hidden',
              'max-w-full',
            )}
          >

            {/* ── Black Header ── */}
            <div className="drawer-header px-6 pt-5 pb-0 shrink-0 min-h-[64px]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-[#B88719] rounded-xl border border-[#8A5A00] shrink-0">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="drawer-title text-lg font-bold tracking-tight font-display truncate">{title}</h2>
                    {subtitle && (
                      <p className="drawer-subtitle text-[12px] font-medium leading-snug truncate">{subtitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isMobile && (
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                      className="drawer-ctrl w-8 h-8 hidden lg:flex items-center justify-center rounded-lg transition-all"
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    aria-label="Close drawer"
                    className="drawer-ctrl w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {tabs && tabs.length > 0 && (
                <div className="flex gap-1 -mb-px relative z-10 overflow-x-auto no-scrollbar">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange?.(tab.id)}
                      aria-current={activeTab === tab.id ? 'page' : undefined}
                      className={cn('drawer-tab shrink-0', activeTab === tab.id && 'active')}
                    >
                      {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── White Body ── */}
            <div className="drawer-body flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
              {children}
            </div>

            {/* ── Pale Yellow Footer ── */}
            {footer && (
              <div className="drawer-footer px-6 py-3.5 flex items-center justify-between shrink-0 gap-3 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  {footer}
                </div>
              </div>
            )}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
