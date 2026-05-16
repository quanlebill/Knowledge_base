import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppState } from '../AppStateContext';
import { NAV_ITEMS, ROLES, INDUSTRIES, ENVIRONMENTS } from '../constants';
import { 
  ChevronDown, 
  Search, 
  Bell, 
  Command, 
  LogOut, 
  Cpu, 
  LayoutGrid,
  ChevronRight,
  Terminal,
  User as UserIcon,
  Plus,
  Building2,
  Menu,
  X,
  Home,
  Database,
  Activity,
  ShieldCheck,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Role, Industry, Environment } from '../types';

import { Breadcrumbs } from './shared/Breadcrumbs';

// Mobile Bottom Nav
const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (id: string) => void }) => {
  const { role } = useAppState();
  
  // Choose core items for mobile bottom nav
  const items = [
    { id: 'EXECUTIVE', label: 'Home', icon: Home },
    { id: 'OPERATIONS', label: 'Monitor', icon: Activity },
    { id: 'KNOWLEDGE', label: 'Docs', icon: Database },
    { id: 'GOVERNANCE', label: 'Access', icon: ShieldCheck },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#080808]/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-4 z-[100]">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === item.id ? "text-brand-400" : "text-slate-500"
          )}
        >
          <item.icon className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
          {activeTab === item.id && (
            <motion.div layoutId="bottom-nav-active" className="h-0.5 w-4 bg-brand-400 rounded-full mt-0.5" />
          )}
        </button>
      ))}
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }: { activeTab: string, setActiveTab: (id: string) => void, isOpen: boolean, setIsOpen: (open: boolean) => void }) => {
  const { role, industry } = useAppState();

  const filteredNav = NAV_ITEMS.filter(item => {
    const roleMatch = item.roles.includes(role);
    const industryMatch = !item.industry || item.industry === industry;
    return roleMatch && industryMatch;
  });

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "fixed lg:relative lg:w-68 h-full border-r border-white/5 bg-[#080808] flex flex-col pt-4 overflow-hidden transition-transform duration-300 z-[120]",
        isOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="px-6 mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(2,115,199,0.3)] border border-brand-400/20">
              <Cpu className="text-white w-5 h-5 shadow-inner" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent leading-none">
                AeroFlow
              </span>
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Enterprise OS</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-bold transition-all group relative",
                activeTab === item.id 
                  ? "bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-lg shadow-black/20" 
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              )}
            >
              <item.icon className={cn("w-4.5 h-4.5", activeTab === item.id ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300")} />
              {item.label}
              {activeTab === item.id && (
                <motion.div 
                  layoutId="nav-active"
                  className="absolute left-0 w-1 h-5 bg-brand-500 rounded-r-full"
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-white/5 bg-white/[0.01] space-y-6">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
             <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
               <span>Compute Lease</span>
               <span className="text-brand-400">82%</span>
             </div>
             <div className="h-1 bg-white/10 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: '82%' }}
                 className="h-full bg-brand-500 shadow-[0_0_8px_rgba(2,115,199,0.5)]"
               />
             </div>
          </div>
          
          <button className="w-full flex items-center gap-3 px-2 py-1 text-slate-500 hover:text-red-400 transition-colors text-[11px] font-black uppercase tracking-[0.2em] group">
            <LogOut className="w-4 h-4 opacity-50 group-hover:opacity-100" />
            Terminal Exit
          </button>
        </div>
      </div>
    </>
  );
};

// Header Component
const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { role, setRole, industry, setIndustry, tenant, setTenant, user, isExpertMode, setIsExpertMode } = useAppState();

  return (
    <header className="h-16 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3 lg:gap-4">
        {/* Mobile Menu Trigger */}
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 bg-white/5 rounded-xl border border-white/10 text-slate-300"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Org/Workspace Switcher - Hidden on Mobile */}
        <div className="hidden sm:flex items-center gap-2 p-1 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-300 italic">
            <Building2 className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden md:inline">{tenant.organization}</span>
            <span className="md:hidden">{tenant.organization[0]}</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <button className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-white hover:bg-white/5 rounded transition-colors uppercase tracking-tight">
            {tenant.workspace}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        </div>

        {/* Environment Switcher - Always visible but compact */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
          {ENVIRONMENTS.map(env => (
            <button
              key={env.id}
              onClick={() => setTenant({ environment: env.id as Environment })}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-bold transition-all border shrink-0",
                tenant.environment === env.id 
                  ? "bg-brand-500 border-brand-400 text-white shadow-[0_0_10px_rgba(2,115,199,0.3)]"
                  : "bg-white/5 border-white/5 text-slate-500 hover:text-slate-300"
              )}
            >
              {env.id[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-6">
        {/* Expert Mode Toggle */}
        <button
          onClick={() => setIsExpertMode(!isExpertMode)}
          className={cn(
            "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
            isExpertMode 
              ? "bg-brand-500/10 border-brand-500/30 text-brand-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
              : "bg-white/5 border-white/5 text-slate-500 hover:text-slate-300"
          )}
        >
          <Terminal className="w-3.5 h-3.5" />
          {isExpertMode ? 'Expert Mode ON' : 'Expert Mode'}
        </button>

        {/* Search - Icon only on mobile */}
        <div className="relative group flex items-center">
          <button className="lg:hidden p-2 text-slate-400">
            <Search className="w-5 h-5" />
          </button>
          <div className="hidden lg:block relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search className="w-4 h-4 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Search resources..." 
              className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-brand-500/50 transition-all focus:w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 border-l border-white/10 pl-2 lg:pl-6">
          <button className="relative text-slate-400 hover:text-white transition-colors p-2">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 border-2 border-[#050505] rounded-full" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-[11px] font-bold text-white leading-none uppercase italic">{user.name}</div>
              <div className="text-[9px] text-brand-500 font-black tracking-widest mt-0.5 uppercase opacity-80">{role}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-800 p-[1px] shrink-0">
              <div className="w-full h-full rounded-full bg-[#050505] flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-brand-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export const AppLayout = ({ children, activeTab, setActiveTab }: { children: React.ReactNode, activeTab: string, setActiveTab: (id: string) => void }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-200 bg-[#050505]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-[#050505] custom-scrollbar pb-24 lg:pb-8 p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
};
