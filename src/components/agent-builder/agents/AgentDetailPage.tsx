import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, GitMerge, Plus, Settings2, Trash2, Upload,
  CheckCircle2, Clock, Edit3, Save, X, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WorkflowBuilder from '../workflow/Builder';
import { TEMPLATE_FLOWS } from '../workflow/BuilderTemplates';
import type { TemplateId } from '../workflow/Builder';

const FLOW_BUILDER_URL     = (import.meta as any).env?.VITE_FLOW_BUILDER_URL     ?? 'http://localhost:8002';
const WORKFLOW_RUNTIME_URL = (import.meta as any).env?.VITE_WORKFLOW_RUNTIME_URL ?? 'http://localhost:8001';

interface ApiWorkflow {
  id: string;
  name: string;
  draft_version_id: string | null;
  published_version_id: string | null;
  created_at: string;
}

interface ApiAgent {
  id: string;
  name: string;
  description: string;
  published_version_id: string | null;
  draft_version_id: string | null;
  created_at: string;
  active_workflow_id: string | null;
  active_workflow_name: string | null;
  workflows?: ApiWorkflow[];
}

interface LLMProvider { id: string; name: string; model_id: string; type: string; }
interface SystemPrompt { id: string; name: string; }

const TEMPLATE_OPTIONS: { id: TemplateId; label: string; desc: string }[] = [
  { id: 'blank',       label: 'Blank',          desc: 'Bắt đầu từ đầu' },
  { id: 'rag',         label: 'RAG',            desc: 'Planner → KB Search → Reranker → Responder' },
  { id: 'multi-agent', label: 'Multi-Agent',    desc: 'RAG + MCP Tool song song' },
  { id: 'hitl',        label: 'Human Approval', desc: 'RAG + MCP + Human review' },
];

type DetailTab = 'WORKFLOWS' | 'SETTINGS';
type BuilderState = { workflowVersionId: string; workflowName: string } | null;

interface Props {
  agentId: string;
  onBack: () => void;
}

export const AgentDetailPage: React.FC<Props> = ({ agentId, onBack }) => {
  const [agent, setAgent]           = useState<ApiAgent | null>(null);
  const [activeTab, setActiveTab]   = useState<DetailTab>('WORKFLOWS');
  const [builder, setBuilder]       = useState<BuilderState>(null);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast]           = useState<string | null>(null);

  // Create workflow modal
  const [showCreateWf, setShowCreateWf]   = useState(false);
  const [newWfName, setNewWfName]         = useState('');
  const [newWfTemplate, setNewWfTemplate] = useState<TemplateId>('rag');
  const [creating, setCreating]           = useState(false);

  // Settings state
  const [llmProviders, setLlmProviders]   = useState<LLMProvider[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [settingsEdit, setSettingsEdit]   = useState(false);
  const [settingsForm, setSettingsForm]   = useState({
    name: '', description: '',
    responder_model_id: '', system_prompt_id: '', memory_enabled: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAgent = useCallback(async () => {
    const res = await fetch(`${FLOW_BUILDER_URL}/api/agents/${agentId}`);
    const data: ApiAgent = await res.json();
    setAgent(data);
    setSettingsForm(f => ({
      ...f,
      name: data.name,
      description: data.description || '',
    }));
  }, [agentId]);

  useEffect(() => { fetchAgent(); }, [fetchAgent]);

  useEffect(() => {
    fetch(`${WORKFLOW_RUNTIME_URL}/api/llm-providers`)
      .then(r => r.json()).then(setLlmProviders).catch(() => {});
    fetch(`${WORKFLOW_RUNTIME_URL}/api/system-prompts`)
      .then(r => r.json()).then(setSystemPrompts).catch(() => {});
  }, []);

  const handlePublish = async () => {
    if (!agent?.workflows?.length) { showToast('Chưa có workflow để publish'); return; }
    setPublishing(true);
    try {
      await fetch(`${FLOW_BUILDER_URL}/api/agents/${agentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id: agent.workflows[0].id }),
      });
      showToast('✓ Published thành công');
      fetchAgent();
    } catch { showToast('Publish thất bại'); }
    finally { setPublishing(false); }
  };

  const handleCreateWorkflow = async () => {
    if (!newWfName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${FLOW_BUILDER_URL}/api/agents/${agentId}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWfName.trim(), description: '' }),
      });
      const data = await res.json();
      const wvId: string = data.workflow_version_id;

      // Save template canvas to MongoDB
      const tpl = TEMPLATE_FLOWS[newWfTemplate];
      if (tpl && wvId) {
        await fetch(`${FLOW_BUILDER_URL}/api/workflow-versions/${wvId}/canvas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodes: tpl.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
            edges: tpl.edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type, label: e.label })),
          }),
        });
      }

      setShowCreateWf(false);
      setNewWfName('');
      await fetchAgent();
      // Open builder
      setBuilder({ workflowVersionId: wvId, workflowName: newWfName.trim() });
    } catch { showToast('Tạo workflow thất bại'); }
    finally { setCreating(false); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch(`${FLOW_BUILDER_URL}/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      showToast('✓ Đã lưu settings');
      setSettingsEdit(false);
      fetchAgent();
    } catch { showToast('Lưu thất bại'); }
    finally { setSavingSettings(false); }
  };

  // Open Builder
  if (builder) {
    return (
      <WorkflowBuilder
        onClose={() => { setBuilder(null); fetchAgent(); }}
        workflow={null}
        agentId={agentId}
        workflowVersionId={builder.workflowVersionId}
      />
    );
  }

  if (!agent) return <div className="p-8 text-slate-400 text-sm">Đang tải...</div>;

  const isPublished = !!agent.published_version_id;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE7DA] bg-[#FAFAF5] shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#F3E2A7] rounded-lg transition-colors text-[#8A8A7A]">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#111111]">{agent.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className="text-[10px] font-bold text-[#8A8A7A] uppercase tracking-wider">
                {isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#ECE7DA] px-6 shrink-0 bg-white">
        {(['WORKFLOWS', 'SETTINGS'] as DetailTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-[#B88719] text-[#B88719]'
                : 'border-transparent text-[#8A8A7A] hover:text-[#111111]'
            }`}
          >
            {tab === 'WORKFLOWS' ? 'Workflows' : 'Settings'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">

        {/* ── Workflows tab ── */}
        {activeTab === 'WORKFLOWS' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-[#2A2A2A]">
                {agent.workflows?.length ?? 0} workflow
              </span>
              <button
                onClick={() => { setNewWfName(''); setNewWfTemplate('rag'); setShowCreateWf(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B88719] hover:bg-[#9A7015] text-white rounded-lg text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New Workflow
              </button>
            </div>

            <div className="space-y-3">
              {(agent.workflows ?? []).map(wf => (
                <div key={wf.id} className="warm-panel rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
                      <GitMerge className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#111111]">{wf.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {agent.active_workflow_id === wf.id && (
                          <span className="flex items-center gap-1 text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                            <Zap className="w-2.5 h-2.5" /> Active
                          </span>
                        )}
                        {wf.published_version_id && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Published
                          </span>
                        )}
                        {wf.draft_version_id && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                            <Clock className="w-2.5 h-2.5" /> Draft
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {wf.draft_version_id && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch(`${FLOW_BUILDER_URL}/api/workflow-versions/${wf.draft_version_id}/publish`, { method: 'POST' });
                            showToast(`✓ "${wf.name}" published`);
                            fetchAgent();
                          } catch { showToast('Publish thất bại'); }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Upload className="w-3 h-3" /> Publish
                      </button>
                    )}
                    {wf.published_version_id && !wf.draft_version_id && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch(`${FLOW_BUILDER_URL}/api/workflow-versions/${wf.published_version_id}/unpublish`, { method: 'POST' });
                            showToast(`"${wf.name}" đã unpublish — có thể edit lại`);
                            fetchAgent();
                          } catch { showToast('Unpublish thất bại'); }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <X className="w-3 h-3" /> Unpublish
                      </button>
                    )}
                    <button
                      onClick={() => wf.draft_version_id && setBuilder({ workflowVersionId: wf.draft_version_id, workflowName: wf.name })}
                      disabled={!wf.draft_version_id}
                      title={!wf.draft_version_id ? 'Unpublish để edit lại' : 'Edit Canvas'}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-[#BFA66A]/50 hover:bg-[#F3E2A7] text-[#5A5A5A] rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Edit3 className="w-3 h-3" /> Edit Canvas
                    </button>
                  </div>
                </div>
              ))}

              {(!agent.workflows || agent.workflows.length === 0) && (
                <div className="text-center py-12 text-[#8A8A7A] text-sm">
                  Chưa có workflow. Bấm "+ New Workflow" để tạo.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Settings tab ── */}
        {activeTab === 'SETTINGS' && (
          <div className="max-w-lg space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111111]">Agent Config</h3>
              {!settingsEdit ? (
                <button onClick={() => setSettingsEdit(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#BFA66A]/50 hover:bg-[#F3E2A7] text-[#5A5A5A] rounded-lg text-xs font-semibold">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setSettingsEdit(false)} className="px-3 py-1.5 border border-[#ECE7DA] text-[#8A8A7A] rounded-lg text-xs font-semibold hover:bg-[#F3E2A7]">
                    <X className="w-3 h-3" />
                  </button>
                  <button onClick={handleSaveSettings} disabled={savingSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B88719] text-white rounded-lg text-xs font-bold disabled:opacity-50">
                    <Save className="w-3 h-3" /> {savingSettings ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {[
              { label: 'Name', key: 'name', type: 'text' },
              { label: 'Description', key: 'description', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-[10px] font-bold text-[#8A8A7A] uppercase tracking-widest mb-1.5 block">{label}</label>
                {settingsEdit ? (
                  <input
                    type={type}
                    value={(settingsForm as any)[key]}
                    onChange={e => setSettingsForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-[#FAFAF5] border border-[#ECE7DA] rounded-xl py-2 px-3 text-sm text-[#111111] focus:outline-none focus:border-[#BFA66A]"
                  />
                ) : (
                  <div className="text-sm text-[#2A2A2A] py-2 px-3 bg-[#FAFAF5] rounded-xl border border-[#ECE7DA]">
                    {(agent as any)[key] || '—'}
                  </div>
                )}
              </div>
            ))}

            {/* Responder Model */}
            <div>
              <label className="text-[10px] font-bold text-[#8A8A7A] uppercase tracking-widest mb-1.5 block">Responder Model</label>
              {settingsEdit ? (
                <select
                  value={settingsForm.responder_model_id}
                  onChange={e => setSettingsForm(f => ({ ...f, responder_model_id: e.target.value }))}
                  className="w-full bg-[#FAFAF5] border border-[#ECE7DA] rounded-xl py-2 px-3 text-sm text-[#111111] focus:outline-none focus:border-[#BFA66A]"
                >
                  <option value="">— Chọn model —</option>
                  {llmProviders.filter(p => p.type === 'chat').map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.model_id})</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-[#2A2A2A] py-2 px-3 bg-[#FAFAF5] rounded-xl border border-[#ECE7DA]">
                  {llmProviders.find(p => p.id === settingsForm.responder_model_id)?.name || '—'}
                </div>
              )}
            </div>

            {/* System Prompt */}
            <div>
              <label className="text-[10px] font-bold text-[#8A8A7A] uppercase tracking-widest mb-1.5 block">System Prompt</label>
              {settingsEdit ? (
                <select
                  value={settingsForm.system_prompt_id}
                  onChange={e => setSettingsForm(f => ({ ...f, system_prompt_id: e.target.value }))}
                  className="w-full bg-[#FAFAF5] border border-[#ECE7DA] rounded-xl py-2 px-3 text-sm text-[#111111] focus:outline-none focus:border-[#BFA66A]"
                >
                  <option value="">— Chọn prompt —</option>
                  {systemPrompts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-[#2A2A2A] py-2 px-3 bg-[#FAFAF5] rounded-xl border border-[#ECE7DA]">
                  {systemPrompts.find(p => p.id === settingsForm.system_prompt_id)?.name || '—'}
                </div>
              )}
            </div>

            {/* Memory */}
            <div className="flex items-center justify-between py-2 px-3 bg-[#FAFAF5] rounded-xl border border-[#ECE7DA]">
              <div>
                <div className="text-sm font-semibold text-[#2A2A2A]">Memory</div>
                <div className="text-[10px] text-[#8A8A7A]">Bật memory middleware</div>
              </div>
              <button
                onClick={() => settingsEdit && setSettingsForm(f => ({ ...f, memory_enabled: !f.memory_enabled }))}
                className={`w-10 h-5 rounded-full transition-colors ${settingsForm.memory_enabled ? 'bg-emerald-500' : 'bg-gray-300'} ${!settingsEdit ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${settingsForm.memory_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Workflow Modal */}
      <AnimatePresence>
        {showCreateWf && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowCreateWf(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white border border-[#ECE7DA] rounded-2xl shadow-2xl p-6 w-[480px]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#111111]">New Workflow</h3>
                <button onClick={() => setShowCreateWf(false)} className="p-1.5 hover:bg-[#F3E2A7] rounded-lg text-[#8A8A7A]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4">
                <label className="text-[10px] font-bold text-[#8A8A7A] uppercase tracking-widest mb-1.5 block">Tên Workflow</label>
                <input
                  autoFocus
                  type="text"
                  value={newWfName}
                  onChange={e => setNewWfName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateWorkflow(); }}
                  placeholder="VD: Workflow tra cứu biển số"
                  className="w-full bg-[#FAFAF5] border border-[#ECE7DA] rounded-xl py-2.5 px-4 text-sm text-[#111111] focus:outline-none focus:border-[#BFA66A]"
                />
              </div>

              <div className="mb-5">
                <label className="text-[10px] font-bold text-[#8A8A7A] uppercase tracking-widest mb-2 block">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_OPTIONS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setNewWfTemplate(t.id)}
                      className={`text-left p-3 rounded-xl border transition-colors ${
                        newWfTemplate === t.id
                          ? 'border-[#B88719] bg-[#FFF9E8]'
                          : 'border-[#ECE7DA] hover:border-[#BFA66A]/50 hover:bg-[#FAFAF5]'
                      }`}
                    >
                      <div className="text-xs font-bold text-[#111111]">{t.label}</div>
                      <div className="text-[10px] text-[#8A8A7A] mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateWf(false)} className="px-4 py-2 text-xs font-semibold text-[#8A8A7A] hover:bg-[#F3E2A7] rounded-xl">Huỷ</button>
                <button
                  onClick={handleCreateWorkflow}
                  disabled={!newWfName.trim() || creating}
                  className="px-4 py-2 text-xs font-bold bg-[#B88719] hover:bg-[#9A7015] text-white rounded-xl disabled:opacity-50"
                >
                  {creating ? 'Đang tạo…' : 'Tạo & Mở Builder'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[9999] bg-[#1e293b] text-white px-4 py-2.5 rounded-xl text-sm shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentDetailPage;
