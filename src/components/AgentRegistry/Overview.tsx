import React from 'react';
import {
  Bot, Cpu, Plus, Terminal, Search, Filter, Zap,
  MoreHorizontal, Database, Network, Wrench, GitBranch,
  ShieldAlert, Activity, BarChart3,
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
  onSelectAgent,
}) => {
  const stats = {
    total:     MOCK_AGENTS.length,
    active:    MOCK_AGENTS.filter(a => a.status === 'ACTIVE').length,
    failed:    MOCK_AGENTS.filter(a => a.status === 'FAILED').length,
    totalCost: MOCK_AGENTS.reduce((acc, c) => acc + c.cost, 0).toFixed(2),
  };

  const getStatusStyle = (status: AgentStatus) => {
    switch (status) {
      case 'ACTIVE':           return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'BUSY':             return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'FAILED':           return 'bg-red-100 text-red-700 border-red-200';
      case 'IDLE':             return 'bg-gray-100 text-gray-500 border-gray-200';
      case 'WAITING_APPROVAL': return 'bg-purple-100 text-purple-700 border-purple-200';
      default:                 return 'bg-gray-50 text-gray-400 border-gray-100';
    }
  };

  const getTypeIcon = (type: AgentType) => {
    switch (type) {
      case 'RAG':      return <Database className="w-4 h-4" />;
      case 'GRAPHRAG': return <Network className="w-4 h-4" />;
      case 'TOOL_USE': return <Wrench className="w-4 h-4" />;
      case 'WORKFLOW': return <GitBranch className="w-4 h-4" />;
      default:         return <Bot className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#B88719] text-[10px] font-bold font-mono tracking-widest uppercase mb-1.5">
            <Cpu className="w-3.5 h-3.5" />
            Control Plane / Registry
          </div>
          <h2 className="text-xl font-display font-bold text-[#111111]">Agent Inventory</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={onOpenCLI} className="btn-secondary text-[10px]">
            <Terminal className="w-3.5 h-3.5" /> CLI Tooling
          </button>
          <button onClick={onNewAgent} className="btn-primary">
            <Plus className="w-4 h-4" /> New Autonomous Unit
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Agents',     val: stats.total,          icon: Bot,        color: 'text-[#B88719]' },
          { label: 'Active Runtimes',  val: stats.active,         icon: Activity,   color: 'text-emerald-600' },
          { label: 'Critical Failures',val: stats.failed,         icon: ShieldAlert,color: 'text-red-600' },
          { label: 'Platform Health',  val: '94%',                icon: Zap,        color: 'text-amber-600' },
          { label: 'Daily Accrual',    val: `$${stats.totalCost}`, icon: BarChart3,  color: 'text-purple-600', span: true },
        ].map((s) => (
          <div key={s.label} className={cn('warm-card rounded-xl p-4', s.span && 'col-span-2 lg:col-span-1')}>
            <div className="flex justify-between items-start mb-3">
              <s.icon className={cn('w-5 h-5', s.color)} />
              <span className="text-[8px] font-bold text-[#8A8A7A] uppercase tracking-widest">Live</span>
            </div>
            <div className="text-2xl font-display font-bold text-[#111111]">{s.val}</div>
            <div className="text-[9px] text-[#5A5A5A] mt-1 font-semibold uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table container */}
      <div className="warm-panel rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-[#BFA66A]/40 bg-[#FFF9E8] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8A7A]" />
              <input
                type="text"
                placeholder="Query agents..."
                className="w-56 bg-white border border-[#BFA66A]/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#111111] placeholder-[#8A8A7A] focus:outline-none focus:border-[#8A5A00]"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#BFA66A]/60 rounded-lg text-[10px] font-semibold text-[#5A5A5A] hover:border-[#8A5A00] transition-colors">
              <Filter className="w-3 h-3" /> Filter Environments
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onOpenProvision} className="btn-secondary text-[10px] py-1.5">
              <Zap className="w-3.5 h-3.5" /> Quick Provision
            </button>
            <button className="p-1.5 bg-white border border-[#BFA66A]/60 rounded-lg hover:border-[#8A5A00] transition-colors">
              <MoreHorizontal className="w-4 h-4 text-[#5A5A5A]" />
            </button>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden xl:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#BFA66A]/30 bg-white">
                {['Agent Identity', 'Environment', 'KB Connection', 'Performance', 'Status', 'Ops'].map((h, i) => (
                  <th key={h} className={cn('px-5 py-3 text-[10px] font-bold text-[#5A5A5A] uppercase tracking-widest', i === 5 && 'text-right')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#BFA66A]/15">
              {MOCK_AGENTS.map(agent => (
                <tr
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                  className="hover:bg-[#FFF9E8] transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center border shrink-0', getStatusStyle(agent.status))}>
                        {getTypeIcon(agent.type)}
                      </div>
                      <div>
                        <div className="font-semibold text-[#111111] text-sm">{agent.name}</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#5A5A5A] mt-0.5">
                          <span className="text-[#B88719] font-semibold">{agent.id}</span>
                          <span className="opacity-40">·</span>
                          <span>{agent.version}</span>
                          <span className="opacity-40">·</span>
                          <span className="italic">{agent.tenant}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-semibold text-[#2A2A2A]">{agent.project}</div>
                    <div className="text-[9px] font-bold text-[#8A8A7A] uppercase tracking-wide mt-0.5">{agent.environment}</div>
                  </td>
                  <td className="px-5 py-4 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-[#B88719] shrink-0" />
                      <span className="text-[11px] text-[#2A2A2A]">{agent.kbConnection}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[9px] text-[#8A8A7A] font-bold uppercase">Err:</span>
                      <span className={cn('font-semibold', agent.errorRate > 5 ? 'text-red-600' : 'text-emerald-600')}>
                        {agent.errorRate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide border', getStatusStyle(agent.status))}>
                      {agent.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <MoreHorizontal className="w-4 h-4 text-[#8A8A7A] inline-block hover:text-[#111111] transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile/Tablet card list */}
        <div className="xl:hidden divide-y divide-[#BFA66A]/20">
          {MOCK_AGENTS.map(agent => (
            <div
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className="p-5 hover:bg-[#FFF9E8] transition-colors cursor-pointer space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-xl border', getStatusStyle(agent.status))}>
                    {getTypeIcon(agent.type)}
                  </div>
                  <div>
                    <div className="font-semibold text-[#111111]">{agent.name}</div>
                    <div className="text-[10px] text-[#5A5A5A] font-mono">{agent.id} · {agent.environment}</div>
                  </div>
                </div>
                <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border', getStatusStyle(agent.status))}>
                  {agent.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-[#F8F5EE] rounded-lg border border-[#BFA66A]/30">
                  <div className="text-[8px] font-bold text-[#8A8A7A] uppercase tracking-widest mb-1">KB Connection</div>
                  <div className="text-[10px] font-mono text-[#2A2A2A] truncate">{agent.kbConnection}</div>
                </div>
                <div className="p-2.5 bg-[#F8F5EE] rounded-lg border border-[#BFA66A]/30">
                  <div className="text-[8px] font-bold text-[#8A8A7A] uppercase tracking-widest mb-1">Performance</div>
                  <div className="text-[10px] font-mono text-[#2A2A2A]">{agent.latency} / {agent.errorRate}% err</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
