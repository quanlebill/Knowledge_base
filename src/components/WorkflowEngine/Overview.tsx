import React, { useState, useEffect, useCallback } from 'react';
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
  LayoutGrid,
  List,
  Copy,
  Bot,
  ShieldCheck,
  Activity,
  ArrowRight,
  X,
  Database,
  Zap,
  Trash2,
  FileCode,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactDOM from 'react-dom';
import { WorkflowStatus, WorkflowType, Workflow } from '../../types/workflow';
import WorkflowBuilder, { type TemplateId } from './Builder';
import ExecutionCenter from './ExecutionCenter';
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

type TemplateCategory = 'ALL' | 'RAG' | 'MULTI_AGENT' | 'HITL' | 'AUTOMATION' | 'KNOWLEDGE';

const TEMPLATE_LIBRARY: Array<{
  builderTemplate: TemplateId;
  name: string;
  desc: string;
  nodeCount: number;
  Icon: React.ElementType;
  color: string;
  category: TemplateCategory;
  isPopular?: boolean;
}> = [
  { builderTemplate: 'blank',        name: 'Blank Canvas',             desc: 'Bắt đầu từ canvas trống — chỉ có Trigger node.',                       nodeCount: 1,  Icon: LayoutGrid, color: '#64748b', category: 'AUTOMATION' },
  { builderTemplate: 'multi-agent',  name: 'Full RAG Agent',           desc: 'KB Search + Reranker + Reasoner — flow chuẩn cho hỏi đáp tài liệu.',    nodeCount: 8,  Icon: Bot,        color: '#3b82f6', category: 'RAG',        isPopular: true },
  { builderTemplate: 'hitl',         name: 'Human-in-the-Loop',        desc: 'Cần người review và phê duyệt trước khi trả kết quả.',                   nodeCount: 9,  Icon: ShieldCheck, color: '#f97316', category: 'HITL',       isPopular: true },
  { builderTemplate: 'multi-agent',  name: 'GraphRAG Pipeline',        desc: 'Kết hợp vector search và knowledge graph để trả lời phức tạp.',          nodeCount: 12, Icon: Activity,   color: '#10b981', category: 'KNOWLEDGE',  isPopular: true },
  { builderTemplate: 'multi-agent',  name: 'Multi-Agent Triage',       desc: 'Planner phân loại câu hỏi và điều phối sang agent chuyên biệt.',         nodeCount: 10, Icon: Bot,        color: '#8b5cf6', category: 'MULTI_AGENT' },
  { builderTemplate: 'blank',        name: 'Document Processing',      desc: 'Extract, chunk, embed và index tài liệu vào knowledge base.',            nodeCount: 7,  Icon: Code,       color: '#6366f1', category: 'RAG' },
  { builderTemplate: 'blank',        name: 'Scheduled KB Sync',        desc: 'Tự động cập nhật knowledge base theo lịch CRON.',                       nodeCount: 6,  Icon: Clock,      color: '#06b6d4', category: 'AUTOMATION' },
  { builderTemplate: 'hitl',         name: 'Compliance Review Bot',    desc: 'Review tài liệu pháp lý với Human-in-the-Loop và audit trail đầy đủ.',   nodeCount: 11, Icon: ShieldCheck, color: '#ef4444', category: 'HITL' },
  { builderTemplate: 'multi-agent',  name: 'Customer Support',         desc: 'Bot hỗ trợ khách hàng — tích hợp CRM, KB và escalation tự động.',       nodeCount: 9,  Icon: Bot,        color: '#22c55e', category: 'MULTI_AGENT' },
  { builderTemplate: 'multi-agent',  name: 'Code Review Agent',        desc: 'Phân tích code, kiểm tra security và đề xuất refactor.',                 nodeCount: 8,  Icon: Code,       color: '#a855f7', category: 'MULTI_AGENT' },
  { builderTemplate: 'blank',        name: 'Data Extraction Pipeline', desc: 'Trích xuất dữ liệu có cấu trúc từ tài liệu phi cấu trúc.',              nodeCount: 5,  Icon: Database,   color: '#f59e0b', category: 'RAG' },
  { builderTemplate: 'blank',        name: 'Event-Driven Orchestrator',desc: 'Trigger workflow từ webhook, message queue hoặc database event.',        nodeCount: 7,  Icon: Zap,        color: '#ec4899', category: 'AUTOMATION' },
];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  ALL: 'Tất cả', RAG: 'RAG', MULTI_AGENT: 'Multi-Agent',
  HITL: 'Human-in-Loop', AUTOMATION: 'Automation', KNOWLEDGE: 'Knowledge',
};

// ─── Template Picker (full-page) ──────────────────────────────────────────────

interface TemplatePickerProps {
  onSelect: (t: TemplateId) => void;
  onClose: () => void;
}

const TemplatePicker = ({ onSelect, onClose }: TemplatePickerProps) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('ALL');

  const filtered = TEMPLATE_LIBRARY.filter(t => {
    const matchCat = category === 'ALL' || t.category === category;
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="bg-white border border-[#ECE7DA] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F3E2A7] rounded-xl border border-[#ECE7DA] transition-colors text-[#5A5A5A]"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
            <div>
              <h2 className="text-lg font-display font-bold text-[#111111]">Chọn Template</h2>
              <p className="text-xs text-[#8A8A7A] mt-0.5">Bắt đầu từ template có sẵn hoặc tạo workflow trống</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A7A]" />
            <input
              type="text"
              placeholder="Tìm template..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-56 bg-[#FAFAF5] border border-[#ECE7DA] rounded-xl py-2 pl-10 pr-4 text-sm text-[#111111] placeholder-[#8A8A7A] focus:outline-none focus:border-[#BFA66A]"
            />
          </div>
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border ${
                category === cat
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#5A5A5A] border-[#ECE7DA] hover:border-[#BFA66A] hover:text-[#2A2A2A]'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((t, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect(t.builderTemplate)}
            className="group text-left bg-white border border-[#ECE7DA] rounded-2xl p-5 hover:border-[#BFA66A] hover:shadow-md transition-all relative"
          >
            {t.isPopular && (
              <span className="absolute top-3 right-3 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#F3E2A7] text-[#7C5A0E] border border-[#BFA66A]/40">
                Popular
              </span>
            )}
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl" style={{ background: `${t.color}15`, border: `1px solid ${t.color}30` }}>
                <t.Icon size={18} style={{ color: t.color }} />
              </div>
              <span className="text-[9px] font-bold text-[#8A8A7A] uppercase tracking-widest">
                {t.nodeCount} nodes
              </span>
            </div>
            <div className="text-sm font-bold text-[#111111] mb-1.5 group-hover:text-[#B88719] transition-colors">
              {t.name}
            </div>
            <p className="text-[11px] text-[#8A8A7A] leading-relaxed line-clamp-2">{t.desc}</p>
            <div className="mt-4 pt-3 border-t border-[#ECE7DA] flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${t.color}10`, color: t.color }}>
                {CATEGORY_LABELS[t.category]}
              </span>
              <span className="text-[10px] font-semibold text-[#B88719] opacity-0 group-hover:opacity-100 transition-opacity">
                Dùng template →
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

// ─── Workflow Engine ──────────────────────────────────────────────────────────

type ActiveTab = 'REGISTRY' | 'BUILDER' | 'TEMPLATE_PICKER' | 'EXECUTIONS' | 'SCHEDULING' | 'OBSERVABILITY';

const WorkflowEngine = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('REGISTRY');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('multi-agent');
  const [builderSource, setBuilderSource] = useState<'REGISTRY' | 'TEMPLATE_PICKER'>('REGISTRY');
  const [filterWorkflowName, setFilterWorkflowName] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [cloneTarget, setCloneTarget] = useState<Workflow | null>(null);
  const [cloneModalName, setCloneModalName] = useState('');

  const handleMenuOpen = useCallback((e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenuId(id);
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenuId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!cloneTarget) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCloneTarget(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cloneTarget]);

  const handleRunWorkflow = (wf: Workflow) => {
    setFilterWorkflowName(wf.name);
    setToast(`✓ "${wf.name}" triggered`);
    setActiveTab('EXECUTIONS');
  };

  const handleNewWorkflow = () => setActiveTab('TEMPLATE_PICKER');

  const handleTemplateSelect = (t: TemplateId) => {
    setSelectedTemplate(t);
    setSelectedWorkflow(null);
    setBuilderSource('TEMPLATE_PICKER');
    setActiveTab('BUILDER');
  };

  const handleEditWorkflow = (wf: Workflow) => {
    setSelectedWorkflow(wf);
    setBuilderSource('REGISTRY');
    setActiveTab('BUILDER');
  };

  const handleBuilderClose = () => {
    setSelectedWorkflow(null);
    setActiveTab(builderSource);
  };

  const WORKFLOW_TABS = [
    { id: 'REGISTRY',      label: 'Registry',      Icon: List     },
    { id: 'EXECUTIONS',    label: 'Executions',    Icon: History  },
    { id: 'SCHEDULING',    label: 'Scheduling',    Icon: Clock    },
    { id: 'OBSERVABILITY', label: 'Observability', Icon: Activity },
  ] as const;

  const renderRegistry = () => (
    <div className="flex flex-col relative">

      {/* Registry Table */}
      <div className="warm-panel rounded-xl mb-5 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#BFA66A]/30 bg-[#FFF9E8]">
              {['Workflow / Type', 'Tenant & Environment', 'Status / Version', 'Performance', 'Last Activity', 'Actions'].map((h, i) => (
                <th key={h} className={`px-5 py-3 text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider ${i === 5 ? 'text-right' : ''} ${i === 0 ? 'rounded-tl-xl' : ''} ${i === 5 ? 'rounded-tr-xl' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#BFA66A]/15">
            {MOCK_WORKFLOWS.map((wf) => (
              <motion.tr
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                key={wf.id}
                className="hover:bg-[#FFF9E8] transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      wf.type === WorkflowType.MULTI_AGENT ? 'bg-blue-50 border-blue-200 text-blue-600' :
                      wf.type === WorkflowType.KB_PIPELINE ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                                                              'bg-amber-50 border-amber-200 text-amber-600'
                    }`}>
                      <GitMerge className="w-4 h-4" />
                    </div>
                    <div>
                      <div
                        className="text-[#111111] font-semibold text-sm mb-0.5 hover:text-[#B88719] transition-colors cursor-pointer"
                        onClick={() => handleEditWorkflow(wf)}
                      >
                        {wf.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-[#8A8A7A] uppercase tracking-wider">
                          {wf.type.replace(/_/g, ' ')}
                        </span>
                        {wf.tags.slice(0, 1).map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-[#F3E2A7] text-[#7C5A0E] rounded border border-[#BFA66A]/40">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <div className="text-sm font-semibold text-[#2A2A2A]">{wf.tenant}</div>
                  <div className="text-[10px] text-[#8A8A7A] font-semibold uppercase tracking-tight mt-0.5">{wf.project}</div>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      wf.status === WorkflowStatus.PUBLISHED ? 'bg-emerald-500' :
                      wf.status === WorkflowStatus.ERROR     ? 'bg-red-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-xs font-bold text-[#111111] uppercase tracking-tight">{wf.status}</span>
                  </div>
                  <div className="text-xs text-[#B88719] font-mono">{wf.version}</div>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm font-bold text-[#111111]">{wf.successRate}%</div>
                      <div className="text-[9px] text-[#8A8A7A] uppercase font-semibold tracking-widest">Success</div>
                    </div>
                    <div className="w-px h-5 bg-[#BFA66A]/30" />
                    <div>
                      <div className="text-sm font-bold text-[#111111]">{wf.avgDuration}</div>
                      <div className="text-[9px] text-[#8A8A7A] uppercase font-semibold tracking-widest">Avg Dur</div>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <div className="text-xs text-[#2A2A2A] font-medium italic">Deployed {wf.lastDeployment}</div>
                  <div className="text-[10px] text-[#8A8A7A] font-semibold mt-0.5">Executed {wf.lastExecution}</div>
                </td>

                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleRunWorkflow(wf)}
                      className="p-1.5 hover:bg-[#F3E2A7] rounded-lg transition-colors text-[#5A5A5A] hover:text-emerald-700"
                      title="Run"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-[#F3E2A7] rounded-lg transition-colors text-[#5A5A5A] hover:text-[#B88719]" title="History">
                      <History className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-[#F3E2A7] rounded-lg transition-colors text-[#5A5A5A]" title="YAML">
                      <Code className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-[#BFA66A]/30 mx-0.5" />
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, wf.id); }}
                      className="p-1.5 hover:bg-[#F3E2A7] rounded-lg transition-colors text-[#5A5A5A] hover:text-[#111111]"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Portal dropdown — rendered outside overflow containers */}
      {openMenuId && ReactDOM.createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-44 bg-white border border-[#BFA66A]/50 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100"
        >
          {MOCK_WORKFLOWS.filter(w => w.id === openMenuId).map(wf => (
            <React.Fragment key={wf.id}>
              <button
                onClick={() => { setOpenMenuId(null); handleEditWorkflow(wf); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-semibold text-[#2A2A2A] hover:bg-[#FFF9E8] transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5 text-[#8A8A7A]" /> Edit
              </button>
              <button
                onClick={() => { setOpenMenuId(null); setCloneModalName(`Copy of ${wf.name}`); setCloneTarget(wf); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-semibold text-[#2A2A2A] hover:bg-[#FFF9E8] transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-[#8A8A7A]" /> Clone
              </button>
              <button
                onClick={() => setOpenMenuId(null)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-semibold text-[#2A2A2A] hover:bg-[#FFF9E8] transition-colors"
              >
                <FileCode className="w-3.5 h-3.5 text-[#8A8A7A]" /> Export YAML
              </button>
              <div className="h-px bg-[#ECE7DA] mx-3" />
              <button
                onClick={() => setOpenMenuId(null)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </React.Fragment>
          ))}
        </div>,
        document.body
      )}

    </div>
  );

  if (activeTab === 'BUILDER') {
    return (
      <WorkflowBuilder
        onClose={handleBuilderClose}
        workflow={selectedWorkflow}
        template={selectedTemplate}
      />
    );
  }

  if (activeTab === 'TEMPLATE_PICKER') {
    return (
      <TemplatePicker
        onSelect={handleTemplateSelect}
        onClose={() => setActiveTab('REGISTRY')}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'EXECUTIONS':    return <ExecutionCenter key={filterWorkflowName ?? 'all'} initialSearch={filterWorkflowName} />;
      case 'SCHEDULING':    return <SchedulingCenter />;
      case 'OBSERVABILITY': return <WorkflowObservability />;
      default:              return renderRegistry();
    }
  };

  return (
    <div className="space-y-4">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 bg-[#111111] text-white text-[12px] font-semibold rounded-xl shadow-xl"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified header panel */}
      <div className="bg-white border border-[#ECE7DA] rounded-2xl overflow-hidden">

        {/* Tab bar + action in one row */}
        <div className="flex items-center border-b border-[#ECE7DA] px-6">
          <div className="flex items-center flex-1 overflow-x-auto">
            {WORKFLOW_TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { if (id !== 'EXECUTIONS') setFilterWorkflowName(undefined); setActiveTab(id); }}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-[#B88719] text-[#B88719]'
                    : 'border-transparent text-[#8A8A7A] hover:text-[#2A2A2A] hover:border-[#D4CBBA]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="pl-4 py-2 shrink-0">
            <button onClick={handleNewWorkflow} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Workflow
            </button>
          </div>
        </div>

        {/* Search + filters — Registry only */}
        {activeTab === 'REGISTRY' && (
          <div className="px-6 pt-4 pb-4 flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A7A]" />
              <input
                type="text"
                placeholder="Search workflows by name, tenant, or tags..."
                className="w-full bg-[#FAFAF5] border border-[#ECE7DA] rounded-xl py-2 pl-10 pr-4 text-sm text-[#111111] placeholder-[#8A8A7A] focus:outline-none focus:border-[#BFA66A]"
              />
            </div>
            <button className="btn-secondary text-[10px]">
              <Filter className="w-4 h-4" /> Filters
            </button>
            <div className="flex bg-[#F4E8C3] p-1 rounded-xl border border-[#BFA66A]">
              <button className="p-1.5 bg-[#111111] text-white rounded-lg"><LayoutGrid className="w-4 h-4" /></button>
              <button className="p-1.5 text-[#5A5A5A] hover:text-[#111111] transition-colors"><List className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {renderContent()}
      </motion.div>

      {/* Clone Workflow Modal */}
      <AnimatePresence>
        {cloneTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-white border border-[#ECE7DA] rounded-2xl shadow-2xl p-6 w-[420px]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#111111]">Clone Workflow</h3>
                <button onClick={() => setCloneTarget(null)} className="p-1.5 hover:bg-[#F3E2A7] rounded-lg transition-colors text-[#8A8A7A]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[#8A8A7A] mb-4">Nhập tên cho workflow mới được clone từ <span className="font-semibold text-[#2A2A2A]">{cloneTarget.name}</span></p>
              <input
                autoFocus
                type="text"
                value={cloneModalName}
                onChange={(e) => setCloneModalName(e.target.value)}
                className="w-full bg-[#FAFAF5] border border-[#ECE7DA] rounded-xl py-2.5 px-4 text-sm text-[#111111] focus:outline-none focus:border-[#BFA66A] mb-5"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setCloneTarget(null)} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => {
                    setToast(`✓ Workflow "${cloneModalName}" cloned successfully`);
                    setCloneTarget(null);
                  }}
                  disabled={!cloneModalName.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="w-4 h-4" /> Clone
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkflowEngine;
