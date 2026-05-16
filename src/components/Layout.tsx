import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppState } from '../AppStateContext';
import { NAV_ITEMS, ROLES, INDUSTRIES, ENVIRONMENTS, MODULE_SUB_ITEMS } from '../constants';
import {
  Search, Bell, LogOut, Cpu, LayoutGrid, ChevronDown, Terminal,
  User as UserIcon, Plus, Building2, Menu, X, Settings,
  Sparkles, ArrowRight, Command, ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Role, Industry, Environment } from '../types';

/* ─── Command Palette ─────────────────────────────────────────────── */
const PALETTE_GROUPS = [
  {
    category: 'Agents',
    items: ['GPT-4 Pipeline Agent', 'RAG Knowledge Agent', 'Graph Extraction Agent', 'Document Processor v2'],
  },
  {
    category: 'Workflows',
    items: ['Daily Sync Pipeline', 'Document Processing Flow', 'Approval Workflow', 'Incident Response'],
  },
  {
    category: 'Knowledge',
    items: ['compliance_gold_index', 'policy_silver_v3', 'onboarding_bronze_raw'],
  },
  {
    category: 'Traces',
    items: ['trace-a8f2b1 · Agent run · 2m ago', 'trace-c3d9e4 · KB ingest · 14m ago'],
  },
];

const CommandPalette = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
      setQuery('');
    }
  }, [isOpen]);

  const filtered = query.trim()
    ? PALETTE_GROUPS.map(g => ({
        ...g,
        items: g.items.filter(i => i.toLowerCase().includes(query.toLowerCase())),
      })).filter(g => g.items.length > 0)
    : PALETTE_GROUPS;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/15 backdrop-blur-[2px] z-[200]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-[14%] left-1/2 -translate-x-1/2 w-full max-w-[580px] px-4 z-[201]"
          >
            <div className="bg-white rounded-2xl border border-[#ECE7DA] shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#ECE7DA]">
                <Search className="w-4 h-4 text-[#8B8B8B] shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  type="text"
                  placeholder="Search agents, traces, documents, workflows..."
                  className="flex-1 bg-transparent text-[13px] text-[#171717] placeholder:text-[#B0A99A] outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-[#B0A99A] hover:text-[#6B6B6B]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="px-1.5 py-0.5 text-[10px] bg-[#F8F6EF] border border-[#ECE7DA] rounded-md text-[#8B8B8B] font-mono">ESC</kbd>
              </div>

              {/* Results */}
              <div className="max-h-[380px] overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-[#8B8B8B]">No results for "{query}"</div>
                ) : (
                  filtered.map(group => (
                    <div key={group.category} className="mb-1">
                      <div className="px-4 py-1.5 text-[10px] font-semibold text-[#B0A99A] uppercase tracking-widest">
                        {group.category}
                      </div>
                      {group.items.map(item => (
                        <button
                          key={item}
                          onClick={onClose}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F6EFD9] text-left transition-colors group"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-[#D4CBBA] group-hover:text-[#D9B86C] transition-colors shrink-0" />
                          <span className="text-[13px] text-[#232323]">{item}</span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hints */}
              <div className="px-4 py-2.5 border-t border-[#F0EBE0] flex items-center justify-between bg-[#FCFBF7]">
                <div className="flex items-center gap-4 text-[10px] text-[#B0A99A]">
                  <span><kbd className="font-mono mr-1">↑↓</kbd>navigate</span>
                  <span><kbd className="font-mono mr-1">↵</kbd>open</span>
                </div>
                <span className="text-[10px] text-[#D0C9BB]">AeroFlow Search</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/* ─── Left Icon Rail ──────────────────────────────────────────────── */
const LeftRail = ({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (id: string) => void;
}) => {
  const { role, industry } = useAppState();

  const filtered = NAV_ITEMS.filter(item => {
    const roleMatch = item.roles.includes(role);
    const industryMatch = !item.industry || item.industry === industry;
    return roleMatch && industryMatch;
  });
  const mainItems = filtered.filter(i => i.id !== 'settings');
  const settingsItem = filtered.find(i => i.id === 'settings');

  return (
    <div className="hidden lg:flex flex-col w-[60px] h-full bg-white border-r border-[#ECE7DA] shrink-0 z-30">
      {/* Brand */}
      <div className="h-14 flex items-center justify-center border-b border-[#ECE7DA] shrink-0">
        <div className="w-8 h-8 bg-[#D9B86C] rounded-xl flex items-center justify-center shadow-sm">
          <Cpu className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Module icons */}
      <div className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto no-scrollbar">
        {mainItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={cn(
                'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group',
                isActive
                  ? 'bg-[#F3E7BC] text-[#7C6230]'
                  : 'text-[#8B8B8B] hover:bg-[#F8F6EF] hover:text-[#4A4A4A]',
              )}
            >
              <item.icon className="w-[18px] h-[18px]" />
              {isActive && (
                <motion.div
                  layoutId="rail-active"
                  className="absolute right-0 w-0.5 h-5 bg-[#D9B86C] rounded-l-full"
                />
              )}
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-full ml-2.5 whitespace-nowrap rounded-lg bg-[#171717] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Settings + divider */}
      {settingsItem && (
        <div className="flex flex-col items-center gap-1 py-3 border-t border-[#ECE7DA] shrink-0">
          <button
            onClick={() => setActiveTab('settings')}
            title="Settings"
            className={cn(
              'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group',
              activeTab === 'settings'
                ? 'bg-[#F3E7BC] text-[#7C6230]'
                : 'text-[#8B8B8B] hover:bg-[#F8F6EF] hover:text-[#4A4A4A]',
            )}
          >
            <Settings className="w-[18px] h-[18px]" />
            {activeTab === 'settings' && (
              <motion.div
                layoutId="rail-active"
                className="absolute right-0 w-0.5 h-5 bg-[#D9B86C] rounded-l-full"
              />
            )}
            <span className="pointer-events-none absolute left-full ml-2.5 whitespace-nowrap rounded-lg bg-[#171717] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
              Settings
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── Secondary Contextual Nav ────────────────────────────────────── */
const SecondaryNav = ({ activeTab }: { activeTab: string }) => {
  const currentModule = NAV_ITEMS.find(i => i.id === activeTab);
  const subItems = MODULE_SUB_ITEMS[activeTab] ?? [];

  if (subItems.length === 0) return null;

  const contextHints: Record<string, string> = {
    'knowledge-ops':      '12 conflicts pending · Fleet healthy',
    'ai-runtime':         '482 agents active · 1.4s avg latency',
    'operations-center':  '99.9% health · 2 active alerts',
    'release-management': '3 deployments in progress',
    'governance':         '100% policy compliance · A+ score',
    'settings':           'Last updated 2 hours ago',
  };

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 224, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="hidden lg:flex flex-col h-full bg-[#FCFBF7] border-r border-[#ECE7DA] shrink-0 overflow-hidden"
      style={{ width: 224 }}
    >
      {/* Module header */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-[#ECE7DA] shrink-0">
        {currentModule && (
          <>
            <currentModule.icon className="w-4 h-4 text-[#D9B86C] shrink-0" />
            <span className="text-[13px] font-semibold text-[#171717] truncate">{currentModule.label}</span>
          </>
        )}
      </div>

      {/* Sub-items */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2 px-2">
        <div className="space-y-0.5">
          {subItems.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-default group transition-colors hover:bg-[#F6EFD9]"
            >
              <item.icon className="w-3.5 h-3.5 text-[#C0B9AC] group-hover:text-[#D9B86C] transition-colors shrink-0" />
              <span className="flex-1 text-[13px] text-[#6B6B6B] group-hover:text-[#3A3A3A] transition-colors truncate">
                {item.label}
              </span>
              {item.badge != null && (
                <span className="text-[9px] font-bold bg-[#F3E7BC] text-[#A07830] px-1.5 py-0.5 rounded-full leading-none">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI context footer */}
      {contextHints[activeTab] && (
        <div className="p-3 border-t border-[#ECE7DA] shrink-0">
          <div className="p-3 bg-white rounded-xl border border-[#ECE7DA]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3 h-3 text-[#D9B86C]" />
              <span className="text-[9px] font-semibold text-[#8B8B8B] uppercase tracking-wider">AI Context</span>
            </div>
            <p className="text-[11px] text-[#8B8B8B] leading-relaxed">{contextHints[activeTab]}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

/* ─── Minimal Top Bar ─────────────────────────────────────────────── */
const TopBar = ({
  onMenuClick,
  onSearchOpen,
}: {
  onMenuClick: () => void;
  onSearchOpen: () => void;
}) => {
  const { role, setRole, industry, setIndustry, tenant, setTenant, user, isExpertMode, setIsExpertMode } = useAppState();

  return (
    <header className="h-14 bg-white border-b border-[#ECE7DA] px-4 lg:px-5 flex items-center justify-between shrink-0 z-20">
      {/* Left cluster */}
      <div className="flex items-center gap-2.5">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[#6B6B6B] hover:bg-[#F8F6EF] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile brand mark */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-6 h-6 bg-[#D9B86C] rounded-lg flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-semibold text-sm text-[#171717]">AeroFlow</span>
        </div>

        {/* Workspace switcher – desktop */}
        <button className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F8F6EF] hover:bg-[#F3EFE3] rounded-lg border border-[#ECE7DA] transition-colors">
          <Building2 className="w-3.5 h-3.5 text-[#8B8B8B]" />
          <span className="text-xs font-medium text-[#4A4A4A]">{tenant.organization}</span>
          <span className="text-[#D4CBBA] text-xs">/</span>
          <span className="text-xs font-semibold text-[#171717]">{tenant.workspace}</span>
          <ChevronDown className="w-3 h-3 text-[#B0A99A]" />
        </button>

        {/* Environment pills */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {ENVIRONMENTS.map(env => (
            <button
              key={env.id}
              onClick={() => setTenant({ environment: env.id as Environment })}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border shrink-0',
                tenant.environment === env.id
                  ? 'bg-[#F3E7BC] border-[#D9B86C]/40 text-[#7C6230]'
                  : 'bg-transparent border-[#ECE7DA] text-[#8B8B8B] hover:bg-[#F8F6EF] hover:text-[#4A4A4A]',
              )}
            >
              {env.id}
            </button>
          ))}
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2">
        {/* Search trigger */}
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#F8F6EF] hover:bg-[#F3EFE3] rounded-lg border border-[#ECE7DA] text-[#8B8B8B] hover:text-[#4A4A4A] transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-xs">Search...</span>
          <kbd className="hidden lg:inline px-1.5 py-0.5 bg-white border border-[#ECE7DA] rounded text-[10px] font-mono text-[#B0A99A]">⌘K</kbd>
        </button>

        {/* Expert mode */}
        <button
          onClick={() => setIsExpertMode(!isExpertMode)}
          className={cn(
            'hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
            isExpertMode
              ? 'bg-[#F3E7BC] border-[#D9B86C]/40 text-[#7C6230]'
              : 'bg-transparent border-[#ECE7DA] text-[#8B8B8B] hover:bg-[#F8F6EF]',
          )}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Expert</span>
        </button>

        {/* Role switcher – desktop */}
        <div className="hidden md:flex items-center gap-0.5 p-0.5 bg-[#F8F6EF] rounded-lg border border-[#ECE7DA]">
          {ROLES.map(r => (
            <button
              key={r.id}
              onClick={() => setRole(r.id as Role)}
              className={cn(
                'px-2 py-1 rounded-md text-[10px] font-semibold transition-all',
                role === r.id
                  ? 'bg-white text-[#171717] shadow-sm border border-[#ECE7DA]'
                  : 'text-[#8B8B8B] hover:text-[#4A4A4A]',
              )}
            >
              {r.id.replace('_', ' ').split(' ').map((w: string) => w[0]).join('')}
            </button>
          ))}
        </div>

        {/* Bell */}
        <button className="relative w-8 h-8 flex items-center justify-center text-[#6B6B6B] hover:text-[#171717] hover:bg-[#F8F6EF] rounded-lg transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#D9B86C] rounded-full" />
        </button>

        {/* User */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#ECE7DA]">
          <div className="hidden sm:block text-right">
            <div className="text-[11px] font-semibold text-[#171717] leading-none">{user.name}</div>
            <div className="text-[9px] text-[#8B8B8B] mt-0.5">{role.replace(/_/g, ' ')}</div>
          </div>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#D9B86C] to-[#C4A35A] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {user.name?.[0] ?? 'A'}
          </div>
        </div>
      </div>
    </header>
  );
};

/* ─── Mobile Full-Screen Drawer ───────────────────────────────────── */
const MobileDrawer = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (id: string) => void;
}) => {
  const { role, industry, user } = useAppState();

  const filtered = NAV_ITEMS.filter(item => {
    const roleMatch = item.roles.includes(role);
    const industryMatch = !item.industry || item.industry === industry;
    return roleMatch && industryMatch;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="lg:hidden fixed inset-0 bg-black/25 backdrop-blur-sm z-[110]"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white border-r border-[#ECE7DA] z-[120] flex flex-col shadow-xl"
          >
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-[#ECE7DA]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[#D9B86C] rounded-xl flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-display font-semibold text-sm text-[#171717] leading-none">AeroFlow</div>
                  <div className="text-[9px] text-[#8B8B8B] uppercase tracking-wider mt-0.5">Enterprise OS</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-[#6B6B6B] hover:text-[#171717] hover:bg-[#F8F6EF] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nav items */}
            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
              {filtered.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); onClose(); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all',
                    activeTab === item.id
                      ? 'bg-[#F3E7BC] text-[#7C6230]'
                      : 'text-[#6B6B6B] hover:bg-[#F8F6EF] hover:text-[#4A4A4A]',
                  )}
                >
                  <item.icon className={cn('w-4 h-4', activeTab === item.id ? 'text-[#D9B86C]' : 'text-[#B0A99A]')} />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#ECE7DA]">
              <div className="flex items-center gap-3 px-2 py-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D9B86C] to-[#C4A35A] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {user.name?.[0] ?? 'A'}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#171717]">{user.name}</div>
                  <div className="text-[10px] text-[#8B8B8B]">{role.replace(/_/g, ' ')}</div>
                </div>
              </div>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-[#8B8B8B] hover:text-[#4A4A4A] hover:bg-[#F8F6EF] rounded-xl text-xs font-medium transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/* ─── Mobile Bottom Nav ───────────────────────────────────────────── */
const BottomNav = ({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (id: string) => void;
}) => {
  const items = [
    { id: 'dashboard',         label: 'Home',     icon: NAV_ITEMS.find(n => n.id === 'dashboard')?.icon ?? LayoutGrid },
    { id: 'knowledge-ops',     label: 'Knowledge', icon: NAV_ITEMS.find(n => n.id === 'knowledge-ops')?.icon ?? LayoutGrid },
    { id: 'ai-runtime',        label: 'AI',       icon: NAV_ITEMS.find(n => n.id === 'ai-runtime')?.icon ?? LayoutGrid },
    { id: 'governance',        label: 'Govern',   icon: NAV_ITEMS.find(n => n.id === 'governance')?.icon ?? LayoutGrid },
    { id: 'settings',          label: 'Settings', icon: Settings },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#ECE7DA] flex items-center justify-around px-2 z-[100]">
      {items.map(item => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 transition-all px-2 py-1 rounded-xl',
              isActive ? 'text-[#7C6230]' : 'text-[#B0A99A]',
            )}
          >
            <div className={cn(
              'w-8 h-8 flex items-center justify-center rounded-xl transition-all',
              isActive ? 'bg-[#F3E7BC]' : '',
            )}>
              <item.icon className="w-[18px] h-[18px]" />
            </div>
            <span className="text-[9px] font-semibold">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/* ─── AppLayout ───────────────────────────────────────────────────── */
export const AppLayout = ({
  children,
  activeTab,
  setActiveTab,
}: {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (id: string) => void;
}) => {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen]           = useState(false);

  /* Global CMD+K listener */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* Close command palette on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCommandOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const hasSecondaryNav = (MODULE_SUB_ITEMS[activeTab]?.length ?? 0) > 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FCFBF7]">
      {/* Left icon rail */}
      <LeftRail activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Contextual secondary nav */}
      <AnimatePresence mode="wait">
        {hasSecondaryNav && (
          <React.Fragment key={activeTab}>
            <SecondaryNav activeTab={activeTab} />
          </React.Fragment>
        )}
      </AnimatePresence>

      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          onMenuClick={() => setIsMobileDrawerOpen(true)}
          onSearchOpen={() => setIsCommandOpen(true)}
        />
        <main className="flex-1 overflow-y-auto custom-scrollbar pb-20 lg:pb-10 p-4 lg:p-8 bg-[#FCFBF7]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Mobile bottom nav */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Command palette */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
    </div>
  );
};
