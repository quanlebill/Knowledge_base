import React from 'react';
import { 
  Bot, 
  Cpu, 
  Plus, 
  Terminal, 
  Search, 
  Filter, 
  Zap, 
  MoreHorizontal, 
  Play, 
  History as HistoryIcon, 
  Settings, 
  Database, 
  Network, 
  Wrench, 
  GitBranch, 
  ShieldAlert, 
  Activity, 
  BarChart3 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Agent, AgentType, AgentStatus } from '../../types/agent';
import { MOCK_AGENTS } from '../../constants/agentMock';

interface OverviewProps {
  onNewAgent: () => void;
  onOpenCLI: () => void;
  onOpenProvision: () => void;
  onSelectAgent: (id: string) => void;
}

export const AgentRegistryOverview: React.FC<OverviewProps> = ({ 
  onNewAgent, 
  onOpenCLI, 
  onOpenProvision,
  onSelectAgent 
}) => {
  const stats = {
    total: MOCK_AGENTS.length,
    active: MOCK_AGENTS.filter(a => a.status === 'ACTIVE').length,
    failed: MOCK_AGENTS.filter(a => a.status === 'FAILED').length,
    unhealthy: MOCK_AGENTS.filter(a => a.healthScore < 60).length,
    totalCost: MOCK_AGENTS.reduce((acc, curr) => acc + curr.cost, 0).toFixed(2)
  };

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'BUSY': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'FAILED': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'IDLE': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'WAITING_APPROVAL': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-white/5 text-white/40 border-white/10';
    }
  };

  const getTypeIcon = (type: AgentType) => {
    switch (type) {
      case 'RAG': return <Database className="w-4 h-4" />;
      case 'GRAPHRAG': return <Network className="w-4 h-4" />;
      case 'TOOL_USE': return <Wrench className="w-4 h-4" />;
      case 'WORKFLOW': return <GitBranch className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-brand-400 text-xs font-black font-mono tracking-widest uppercase mb-3 text-glow-blue">
            <Cpu className="w-4 h-4" />
            Control Plane / Registry
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-medium tracking-tight text-white leading-tight">Agent Inventory</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={onOpenCLI}
            className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <Terminal className="w-4 h-4" /> CLI Tooling
          </button>
          <button 
            onClick={onNewAgent}
            className="px-6 py-2.5 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/20 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> New Autonomous Unit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
        {[
          { id: 'total-agents', label: 'Total Agents', val: stats.total, icon: Bot, color: 'text-brand-400' },
          { id: 'active-runtimes', label: 'Active Runtimes', val: stats.active, icon: Activity, color: 'text-green-500' },
          { id: 'critical-failures', label: 'Critical Failures', val: stats.failed, icon: ShieldAlert, color: 'text-red-500' },
          { id: 'platform-health', label: 'Platform Health', val: '94%', icon: Zap, color: 'text-amber-500' },
          { id: 'daily-accrual', label: 'Daily Accrual', val: `$${stats.totalCost}`, icon: BarChart3, color: 'text-purple-400', className: 'col-span-2 lg:col-span-1' },
        ].map((stat) => (
          <div key={stat.id} className={cn("glass-panel p-6 rounded-[2rem] border-white/5 bg-white/[0.01]", stat.className)}>
            <div className="flex justify-between items-start mb-4">
              <stat.icon className={cn("w-5 h-5", stat.color)} />
              <div className="hidden sm:block text-[8px] font-black text-slate-600 uppercase tracking-widest">Live Metrics</div>
            </div>
            <div className="text-2xl sm:text-3xl font-display font-medium text-white">{stat.val}</div>
            <div className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-tight">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-[2.5rem] overflow-hidden border-white/5 bg-white/[0.01]">
        <div className="px-6 lg:px-8 py-6 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/[0.02]">
           <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="relative group flex-1 sm:flex-none">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Query agents..." 
                  className="w-full sm:w-64 bg-black/20 border border-white/5 rounded-2xl pl-12 pr-6 py-2.5 text-xs focus:outline-none focus:border-brand-500/50 transition-all font-mono"
                />
              </div>
              <button className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-bold text-slate-400 flex items-center justify-center gap-2 border border-white/5">
                <Filter className="w-3.5 h-3.5" /> Filter Environments
              </button>
           </div>
           <div className="flex items-center gap-2">
              <button 
                onClick={onOpenProvision}
                className="flex-1 lg:flex-none px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-slate-300 hover:bg-white/10 flex items-center justify-center gap-2"
              >
                <Zap className="w-3.5 h-3.5" /> Quick Provision
              </button>
              <button className="p-2 bg-white/5 rounded-xl border border-white/5"><MoreHorizontal className="w-4 h-4 text-slate-500" /></button>
           </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden xl:block">
          <table className="w-full text-left">
             <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                   <th className="px-8 py-5">Agent Identity</th>
                   <th className="px-6 py-5">Environment</th>
                   <th className="px-6 py-5">KB Connection</th>
                   <th className="px-6 py-5">Performance</th>
                   <th className="px-6 py-5">Status</th>
                   <th className="px-8 py-5 text-right w-16">Ops</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
                {MOCK_AGENTS.map(agent => (
                  <tr 
                    key={agent.id} 
                    onClick={() => onSelectAgent(agent.id)}
                    className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border", getStatusColor(agent.status))}>
                             {getTypeIcon(agent.type)}
                           </div>
                           <div>
                              <div className="font-bold text-white mb-0.5">{agent.name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                 <span className="text-brand-400">{agent.id}</span>
                                 <span className="opacity-30">•</span>
                                 <span>{agent.version}</span>
                                 <span className="opacity-30">•</span>
                                 <span className="italic">{agent.tenant}</span>
                              </div>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-300">{agent.project}</span>
                          <span className="text-[9px] font-black text-slate-600 uppercase mt-1 tracking-tighter">{agent.environment}</span>
                        </div>
                     </td>
                     <td className="px-6 py-6 font-mono text-xs">
                        <div className="flex items-center gap-2">
                           <Database className="w-3.5 h-3.5 text-brand-400" />
                           <span className="text-[11px] underline decoration-brand-400/30">{agent.kbConnection}</span>
                        </div>
                     </td>
                     <td className="px-6 py-6 font-mono text-xs">
                        <div className="flex items-center gap-3">
                           <div className="text-[9px] uppercase text-slate-600 font-black">Err:</div>
                           <span className={cn(agent.errorRate > 5 ? "text-red-500" : "text-green-500")}>{agent.errorRate}%</span>
                        </div>
                     </td>
                     <td className="px-6 py-6">
                        <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", getStatusColor(agent.status))}>
                          {agent.status.replace('_', ' ')}
                        </span>
                     </td>
                     <td className="px-8 py-6 text-right">
                        <MoreHorizontal className="w-4 h-4 text-slate-600 group-hover:text-slate-300" />
                     </td>
                  </tr>
                ))}
             </tbody>
          </table>
        </div>

        {/* Mobile/Tablet Card List */}
        <div className="xl:hidden divide-y divide-white/5">
          {MOCK_AGENTS.map(agent => (
            <div 
              key={agent.id} 
              onClick={() => onSelectAgent(agent.id)}
              className="p-6 hover:bg-white/[0.02] active:bg-white/5 transition-colors cursor-pointer space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl border", getStatusColor(agent.status))}>
                    {getTypeIcon(agent.type)}
                  </div>
                  <div>
                    <div className="font-bold text-white text-base">{agent.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{agent.id} • {agent.environment}</div>
                  </div>
                </div>
                <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border", getStatusColor(agent.status))}>
                  {agent.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">KB Connection</div>
                  <div className="text-[10px] font-mono text-slate-300 truncate">{agent.kbConnection}</div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Performance</div>
                  <div className="text-[10px] font-mono text-slate-300">{agent.latency} / {agent.errorRate}% err</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
