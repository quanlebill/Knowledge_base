import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  GitMerge,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  History,
  Code,
  Settings2,
  Rocket,
  LayoutGrid,
  List,
  Copy,
  Bot,
  ShieldCheck,
  Activity,
  ArrowRight,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkflowStatus, WorkflowType, Workflow } from '../../types/workflow';
import WorkflowBuilder, { type TemplateId } from './Builder';
import ExecutionCenter from './ExecutionCenter';
import WorkflowTemplates from './Templates';
import SchedulingCenter from './SchedulingCenter';
import WorkflowObservability from './Observability';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Multi-Agent Banking Support',
    type: WorkflowType.MULTI_AGENT,
    tenant: 'Global-Finance',
    project: 'Retail-Banking-AI',
    version: 'v2.4.0',
    status: WorkflowStatus.PUBLISHED,
    lastDeployment: '2h ago',
    lastExecution: '5m ago',
    successRate: 98.2,
    avgDuration: '42s',
    owner: 'Linh Nguyen',
    tags: ['Customer Support', 'Critical', 'Secure'],
    nodes: [],
    edges: [],
  },
  {
    id: 'wf-2',
    name: 'GraphRAG Intelligence Sync',
    type: WorkflowType.KB_PIPELINE,
    tenant: 'Smart-City-Nexus',
    project: 'Public-Safety',
    version: 'v1.1.2',
    status: WorkflowStatus.PUBLISHED,
    lastDeployment: '1d ago',
    lastExecution: '12h ago',
    successRate: 99.5,
    avgDuration: '12m',
    owner: 'Sarah Chen',
    tags: ['Knowledge', 'GraphRAG', 'Sync'],
    nodes: [],
    edges: [],
  },
  {
    id: 'wf-3',
    name: 'Gov-Compliance Review',
    type: WorkflowType.HUMAN_APPROVAL,
    tenant: 'Gov-Tech-Hanoi',
    project: 'Digital-Identity',
    version: 'v3.0.1-rc',
    status: WorkflowStatus.DORMANT,
    lastDeployment: '5d ago',
    lastExecution: '2d ago',
    successRate: 100,
    avgDuration: '4h',
    owner: 'Dr. Pham',
    tags: ['Legal', 'Human-in-the-loop', 'Privacy'],
    nodes: [],
    edges: [],
  },
];

// ─── Template Definitions ─────────────────────────────────────────────────────

const TEMPLATES: Array<{
  id: TemplateId;
  name: string;
  desc: string;
  nodeCount: number;
  Icon: React.ElementType;
  color: string;
  isDefault?: boolean;
}> = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    desc: 'Flow trống, chỉ có Trigger node.',
    nodeCount: 1,
    Icon: LayoutGrid,
    color: '#64748b',
  },
  {
    id: 'multi-agent',
    name: 'Full Agent',
    desc: 'Flow chuẩn đầy đủ — KB Search + MCP Tool song song.',
    nodeCount: 8,
    Icon: Bot,
    color: '#3b82f6',
    isDefault: true,
  },
  {
    id: 'hitl',
    name: 'Human-in-the-loop',
    desc: 'Cần người review trước khi trả lời.',
    nodeCount: 9,
    Icon: ShieldCheck,
    color: '#f97316',
  },
];

// ─── Template Modal ────────────────────────────────────────────────────────────

interface TemplateModalProps {
  onSelect: (t: TemplateId) => void;
  onClose: () => void;
}

const TemplateModal = ({ onSelect, onClose }: TemplateModalProps) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="relative z-10 bg-slate-900 border border-white/10 rounded-[28px] p-8 w-[740px] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Choose a Template</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Select a starting point — you can customise everything in the canvas.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template Cards */}
        <div className="grid grid-cols-3 gap-4">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="group text-left p-5 rounded-2xl transition-all relative bg-white/[0.02] border border-transparent hover:border-white/20 hover:bg-white/[0.05]"
            >
              {t.isDefault && (
                <span
                  className="absolute top-3 right-3 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: `${t.color}25`, color: t.color }}
                >
                  Default
                </span>
              )}
              <div className="flex items-center justify-between mb-4">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: `${t.color}20`, border: `1px solid ${t.color}30` }}
                >
                  <t.Icon size={18} style={{ color: t.color }} />
                </div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-6">
                  {t.nodeCount} {t.nodeCount === 1 ? 'node' : 'nodes'}
                </span>
              </div>
              <div className="text-sm font-bold text-white mb-1.5">
                {t.name}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {t.desc}
              </p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
  );
};

// ─── Workflow Engine ──────────────────────────────────────────────────────────

type ActiveTab = 'REGISTRY' | 'BUILDER' | 'EXECUTIONS' | 'TEMPLATES' | 'SCHEDULING' | 'OBSERVABILITY';

const WorkflowEngine = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('REGISTRY');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('multi-agent');

  const handleNewWorkflow = () => setShowTemplateModal(true);

  const handleTemplateSelect = (t: TemplateId) => {
    setSelectedTemplate(t);
    setSelectedWorkflow(null);
    setShowTemplateModal(false);
    setActiveTab('BUILDER');
  };

  const handleEditWorkflow = (wf: Workflow) => {
    setSelectedWorkflow(wf);
    setActiveTab('BUILDER');
  };

  const handleBuilderClose = () => {
    setSelectedWorkflow(null);
    setActiveTab('REGISTRY');
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'BUILDER':
        return (
          <WorkflowBuilder
            onClose={handleBuilderClose}
            workflow={selectedWorkflow}
            template={selectedTemplate}
          />
        );
      case 'EXECUTIONS':
        return <ExecutionCenter />;
      case 'TEMPLATES':
        return <WorkflowTemplates onUse={() => { setSelectedWorkflow(null); setActiveTab('BUILDER'); }} />;
      case 'SCHEDULING':
        return <SchedulingCenter />;
      case 'OBSERVABILITY':
        return <WorkflowObservability />;
      default:
        return renderRegistry();
    }
  };

  const renderRegistry = () => (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden relative">

      {/* Template selection modal */}
      {showTemplateModal && (
        <TemplateModal
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {/* Registry Header */}
      <div className="p-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-brand-500/10 rounded-xl">
                <GitMerge className="w-6 h-6 text-brand-400" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Workflow Registry</h1>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl">
              Control plane for enterprise AI orchestration. Manage distributed agents, retrieval pipelines, and human-in-the-loop approval flows.
            </p>
          </div>
          <button
            onClick={handleNewWorkflow}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
            <input
              type="text"
              placeholder="Search workflows by name, tenant, or tags..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 transition-all uppercase text-[10px] font-black tracking-widest">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button className="p-2 bg-brand-500 text-white rounded-lg"><LayoutGrid className="w-4 h-4" /></button>
            <button className="p-2 text-slate-500 hover:text-slate-300 transition-colors"><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Registry Table */}
      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        <table className="w-full border-separate border-spacing-y-4">
          <thead>
            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              <th className="px-6 pb-2 text-left">Workflow / Type</th>
              <th className="px-6 pb-2 text-left">Tenant & Environment</th>
              <th className="px-6 pb-2 text-left">Status / Version</th>
              <th className="px-6 pb-2 text-left">Performance</th>
              <th className="px-6 pb-2 text-left">Last Activity</th>
              <th className="px-6 pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_WORKFLOWS.map((wf) => (
              <motion.tr
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={wf.id}
                className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl transition-all"
              >
                <td className="px-6 py-5 first:rounded-l-2xl border-y border-l border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-slate-800 border border-white/10 ${
                      wf.type === WorkflowType.MULTI_AGENT ? 'text-brand-400' :
                      wf.type === WorkflowType.KB_PIPELINE ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      <GitMerge className="w-5 h-5" />
                    </div>
                    <div>
                      <div
                        className="text-white font-bold mb-1 hover:text-brand-400 transition-colors cursor-pointer"
                        onClick={() => handleEditWorkflow(wf)}
                      >
                        {wf.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          {wf.type.replace(/_/g, ' ')}
                        </span>
                        {wf.tags.slice(0, 1).map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-brand-500/10 text-brand-400 rounded-md border border-brand-500/20">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-5 border-y border-white/5">
                  <div className="text-slate-300 font-medium text-sm">{wf.tenant}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{wf.project}</div>
                </td>

                <td className="px-6 py-5 border-y border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      wf.status === WorkflowStatus.PUBLISHED
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                        : wf.status === WorkflowStatus.ERROR ? 'bg-red-500' : 'bg-slate-500'
                    }`} />
                    <span className="text-xs font-bold text-white uppercase tracking-tight">{wf.status}</span>
                  </div>
                  <div className="text-xs text-brand-400 font-mono tracking-tighter">{wf.version}</div>
                </td>

                <td className="px-6 py-5 border-y border-white/5">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-xs font-bold text-white">{wf.successRate}%</div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Success</div>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div>
                      <div className="text-xs font-bold text-white">{wf.avgDuration}</div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Avg Dur</div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-5 border-y border-white/5">
                  <div className="text-xs text-slate-300 font-medium italic">Deployed {wf.lastDeployment}</div>
                  <div className="text-[10px] text-slate-500 font-bold">Executed {wf.lastExecution}</div>
                </td>

                <td className="px-6 py-5 last:rounded-r-2xl border-y border-r border-white/5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleEditWorkflow(wf)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-emerald-400"
                      title="Run"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-brand-400"
                      title="History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-slate-200"
                      title="YAML"
                    >
                      <Code className="w-4 h-4" />
                    </button>
                    {/* Clone in 3-dot menu */}
                    <div className="w-px h-4 bg-white/10 mx-0.5" />
                    <div className="relative group/menu">
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-36 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden opacity-0 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:pointer-events-auto transition-all z-20">
                        <button
                          onClick={() => handleEditWorkflow(wf)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold text-slate-300 hover:bg-white/10 transition-all"
                        >
                          <Settings2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold text-slate-300 hover:bg-white/10 transition-all">
                          <Copy className="w-3.5 h-3.5" /> Clone
                        </button>
                        <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold text-slate-300 hover:bg-white/10 transition-all">
                          <ArrowRight className="w-3.5 h-3.5" /> Deploy
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tab Switcher */}
      <div className="p-4 border-t border-white/5 bg-slate-900/50 backdrop-blur-md flex justify-center">
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 shadow-2xl">
          {([
            { id: 'REGISTRY',    label: 'Registry',     Icon: List },
            { id: 'BUILDER',     label: 'Builder',      Icon: GitMerge },
            { id: 'EXECUTIONS',  label: 'Executions',   Icon: History },
            { id: 'TEMPLATES',   label: 'Templates',    Icon: Rocket },
            { id: 'SCHEDULING',  label: 'Scheduling',   Icon: Clock },
            { id: 'OBSERVABILITY', label: 'Observability', Icon: Settings2 },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => {
                if (id === 'BUILDER') { handleNewWorkflow(); return; }
                setActiveTab(id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === id
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return renderTab();
};

export default WorkflowEngine;
