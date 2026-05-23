import React, { useState, useCallback, useMemo, useRef, useContext, useEffect } from 'react';
import {
  Save, Play, Layout, Code as CodeIcon, CheckCircle2, Terminal,
  ArrowLeft, ChevronDown, Bot, Database, Activity, Zap, Cpu,
  Search, ShieldCheck, Wrench, Layers, Filter,
  GitBranch, Bell, RefreshCw, GripVertical, X, Copy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Workflow } from '../../types/workflow';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Node,
  type Edge,
  type OnConnect,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateId = 'blank' | 'rag' | 'multi-agent' | 'hitl';

type FlowNodeType =
  | 'trigger' | 'planner' | 'kb_search' | 'mcp_tool'
  | 'rrf_ranking' | 'reranker' | 'reasoner' | 'output'
  | 'human_approval' | 'condition' | 'db_query'
  | 'send_notification' | 'loop';

export interface FlowNodeData extends Record<string, unknown> {
  nodeType: FlowNodeType;
  label: string;
  kbEndpoint?: string;
  kbName?: string;
  mcpServerUrl?: string;
  allowedTools?: string[];
  rerankerModel?: string;
  topN?: number;
  systemPromptName?: string;
  temperature?: number;
  maxTokens?: number;
  approverRole?: string;
}

// ─── Toast Context (shared with custom edge) ──────────────────────────────────

const BuilderToastCtx = React.createContext<(msg: string) => void>(() => {});

// ─── Node Style Map ───────────────────────────────────────────────────────────

const NODE_STYLE: Record<string, { typeLabel: string; Icon: any; color: string }> = {
  trigger:           { typeLabel: 'Trigger',        Icon: Zap,         color: '#6B7280' },
  planner:           { typeLabel: 'Planner',        Icon: Bot,         color: '#3B82F6' },
  kb_search:         { typeLabel: 'KB Search',      Icon: Database,    color: '#10B981' },
  mcp_tool:          { typeLabel: 'MCP Tool',       Icon: Wrench,      color: '#F59E0B' },
  rrf_ranking:       { typeLabel: 'RRF Ranking',    Icon: Layers,      color: '#8B5CF6' },
  reranker:          { typeLabel: 'Reranker',       Icon: Filter,      color: '#8B5CF6' },
  reasoner:          { typeLabel: 'Reasoner',       Icon: Cpu,         color: '#3B82F6' },
  output:            { typeLabel: 'Output',         Icon: Activity,    color: '#6B7280' },
  human_approval:    { typeLabel: 'Human Approval', Icon: ShieldCheck, color: '#D9B86C' },
  condition:         { typeLabel: 'Condition',      Icon: GitBranch,   color: '#6B7280' },
  db_query:          { typeLabel: 'DB Query',       Icon: Database,    color: '#10B981' },
  send_notification: { typeLabel: 'Notification',   Icon: Bell,        color: '#EF4444' },
  loop:              { typeLabel: 'Loop',           Icon: RefreshCw,   color: '#3B82F6' },
};

// ─── Custom Node ──────────────────────────────────────────────────────────────

const CustomFlowNode = (props: NodeProps) => {
  const data      = props.data as FlowNodeData;
  const { selected, id } = props;
  const cfg       = NODE_STYLE[data.nodeType] || NODE_STYLE.trigger;
  const hasInput  = data.nodeType !== 'trigger';
  const hasOutput = data.nodeType !== 'output';
  const [hovered, setHovered] = useState(false);

  const { setNodes, setEdges } = useReactFlow();
  const addToast = useContext(BuilderToastCtx);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(ed => ed.source !== id && ed.target !== id));
    addToast(`Node removed: ${data.label}`);
  }, [id, setNodes, setEdges, addToast, data.label]);

  return (
    <div
      style={{
        position: 'relative',
        background: selected ? `${cfg.color}22` : '#1e293b',
        border: `2px solid ${selected ? cfg.color : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 14,
        padding: '11px 16px',
        minWidth: 178,
        boxShadow: selected
          ? `0 0 0 3px ${cfg.color}20, 0 4px 24px rgba(0,0,0,0.5)`
          : '0 4px 16px rgba(0,0,0,0.4)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: 'default',
        userSelect: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* X delete button — shows on hover or select */}
      {(hovered || selected) && (
        <button
          onClick={handleDelete}
          title="Remove node"
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#EF4444',
            border: '2px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            padding: 0,
          }}
        >
          <X size={9} color="white" />
        </button>
      )}

      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: cfg.color, border: '2px solid #1e293b', width: 10, height: 10 }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <div style={{
          background: `${cfg.color}22`, borderRadius: 7, padding: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <cfg.Icon size={12} color={cfg.color} />
        </div>
        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: cfg.color, opacity: 0.85,
        }}>
          {cfg.typeLabel}
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.3 }}>
        {data.label}
      </div>

      {hasOutput && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: cfg.color, border: '2px solid #1e293b', width: 10, height: 10 }}
        />
      )}
    </div>
  );
};

// ─── Custom Edge with Delete Button ──────────────────────────────────────────

const EdgeWithDelete = (props: EdgeProps) => {
  const {
    id, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    style = {}, markerEnd, label, labelStyle,
    selected,
  } = props;

  const { setEdges }  = useReactFlow();
  const addToast      = useContext(BuilderToastCtx);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const onDeleteEdge = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges(eds => eds.filter(ed => ed.id !== id));
    addToast('Edge removed');
  }, [id, setEdges, addToast]);

  const xBtnY = label ? labelY - 18 : labelY;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style as React.CSSProperties} />
      {/* Wider invisible stroke for easier click-to-select */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        className="react-flow__edge-interaction"
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none"
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <span
              style={{
                ...(labelStyle as React.CSSProperties || {}),
                background: '#1e293b',
                padding: '2px 6px',
                borderRadius: 4,
                display: 'inline-block',
                fontSize: 9,
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
            >
              {label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}

      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${xBtnY}px)`,
              pointerEvents: 'all',
            }}
          >
            <button
              onClick={onDeleteEdge}
              title="Remove edge"
              className="w-5 h-5 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center border border-red-400/40 transition-all shadow-lg"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const nodeTypes = { flowNode: CustomFlowNode };
const edgeTypes = { wfEdge: EdgeWithDelete };

// ─── Edge Helpers (all use type 'wfEdge') ─────────────────────────────────────

const solidEdge = (id: string, src: string, tgt: string, color = '#ffffff22'): Edge => ({
  id, source: src, target: tgt,
  type: 'wfEdge', animated: true,
  style: { stroke: color, strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color },
});

const labeledSolid = (id: string, src: string, tgt: string, label: string, color: string): Edge => ({
  ...solidEdge(id, src, tgt, color),
  label,
  labelStyle: { fill: color, fontSize: 9, fontWeight: 700, fontFamily: 'monospace' },
});

const dashedEdge = (id: string, src: string, tgt: string, label: string, color: string): Edge => ({
  id, source: src, target: tgt,
  type: 'wfEdge', animated: false,
  style: { stroke: color, strokeWidth: 2, strokeDasharray: '6,3' },
  markerEnd: { type: MarkerType.ArrowClosed, color },
  label,
  labelStyle: { fill: color, fontSize: 9, fontWeight: 700, fontFamily: 'monospace' },
});

// ─── Node Factory ─────────────────────────────────────────────────────────────

const mkNode = (
  id: string, nodeType: FlowNodeType, label: string,
  x: number, y: number, extra: Partial<FlowNodeData> = {},
): Node<FlowNodeData> => ({
  id, type: 'flowNode', position: { x, y },
  data: { nodeType, label, ...extra },
});

// ─── Template Flows ───────────────────────────────────────────────────────────

const TEMPLATE_FLOWS: Record<TemplateId, { nodes: Node<FlowNodeData>[]; edges: Edge[] }> = {

  blank: {
    nodes: [mkNode('trigger', 'trigger', 'Start', 300, 200)],
    edges: [],
  },

  rag: {
    nodes: [
      mkNode('trigger',     'trigger',     'User Input',  360, 0),
      mkNode('planner',     'planner',     'Planner',     360, 110),
      mkNode('kb_search',   'kb_search',   'KB Search',   360, 220, { kbEndpoint: 'http://knowledge-space/api/kb/', kbName: 'kb_a05_violations' }),
      mkNode('rrf_ranking', 'rrf_ranking', 'RRF Ranking', 360, 330),
      mkNode('reranker',    'reranker',    'Reranker',    360, 440, { rerankerModel: 'BGE-Reranker-v2-m3', topN: 5 }),
      mkNode('reasoner',    'reasoner',    'Reasoner',    360, 550, { systemPromptName: 'prompt_default', temperature: 0.2, maxTokens: 1000 }),
      mkNode('output',      'output',      'Response',    360, 660),
    ],
    edges: [
      solidEdge('e1', 'trigger',     'planner',     '#6B728066'),
      solidEdge('e2', 'planner',     'kb_search',   '#3B82F666'),
      solidEdge('e3', 'kb_search',   'rrf_ranking', '#10B98166'),
      solidEdge('e4', 'rrf_ranking', 'reranker',    '#8B5CF666'),
      solidEdge('e5', 'reranker',    'reasoner',    '#8B5CF666'),
      solidEdge('e6', 'reasoner',    'output',      '#3B82F666'),
    ],
  },

  'multi-agent': {
    nodes: [
      mkNode('trigger',     'trigger',     'User Input',  360, 0),
      mkNode('planner',     'planner',     'Planner',     360, 110),
      mkNode('kb_search',   'kb_search',   'KB Search',   160, 240, { kbEndpoint: 'http://knowledge-space/api/kb/', kbName: 'kb_a05_violations' }),
      mkNode('mcp_tool',    'mcp_tool',    'MCP Tool',    560, 240, { mcpServerUrl: 'http://mcp.tenant.gov.vn/sse', allowedTools: ['tra_cuu_phat_nguoi', 'query_dashboard'] }),
      mkNode('rrf_ranking', 'rrf_ranking', 'RRF Ranking', 360, 380),
      mkNode('reranker',    'reranker',    'Reranker',    360, 490, { rerankerModel: 'BGE-Reranker-v2-m3', topN: 5 }),
      mkNode('reasoner',    'reasoner',    'Reasoner',    360, 600, { systemPromptName: 'prompt_default', temperature: 0.2, maxTokens: 1000 }),
      mkNode('output',      'output',      'Response',    360, 710),
    ],
    edges: [
      solidEdge   ('e1', 'trigger',     'planner',     '#6B728066'),
      labeledSolid('e2', 'planner',     'kb_search',   'always',        '#10B98199'),
      dashedEdge  ('e3', 'planner',     'mcp_tool',    'if tool_calls', '#F59E0B99'),
      solidEdge   ('e4', 'kb_search',   'rrf_ranking', '#10B98166'),
      solidEdge   ('e5', 'mcp_tool',    'rrf_ranking', '#F59E0B66'),
      solidEdge   ('e6', 'rrf_ranking', 'reranker',    '#8B5CF666'),
      solidEdge   ('e7', 'reranker',    'reasoner',    '#8B5CF666'),
      solidEdge   ('e8', 'reasoner',    'output',      '#3B82F666'),
    ],
  },

  hitl: {
    nodes: [
      mkNode('trigger',        'trigger',        'User Input',   360, 0),
      mkNode('planner',        'planner',        'Planner',      360, 110),
      mkNode('kb_search',      'kb_search',      'KB Search',    160, 240, { kbEndpoint: 'http://knowledge-space/api/kb/', kbName: 'kb_a05_violations' }),
      mkNode('mcp_tool',       'mcp_tool',       'MCP Tool',     560, 240, { mcpServerUrl: 'http://mcp.tenant.gov.vn/sse', allowedTools: ['tra_cuu_phat_nguoi', 'query_dashboard'] }),
      mkNode('rrf_ranking',    'rrf_ranking',    'RRF Ranking',  360, 380),
      mkNode('reranker',       'reranker',       'Reranker',     360, 490, { rerankerModel: 'BGE-Reranker-v2-m3', topN: 5 }),
      mkNode('reasoner',       'reasoner',       'Reasoner',     360, 600, { systemPromptName: 'prompt_default', temperature: 0.2, maxTokens: 1000 }),
      mkNode('human_approval', 'human_approval', 'Human Review', 360, 710, { approverRole: 'MANAGER' }),
      mkNode('output',         'output',         'Response',     360, 820),
    ],
    edges: [
      solidEdge   ('e1', 'trigger',        'planner',        '#6B728066'),
      labeledSolid('e2', 'planner',        'kb_search',      'always',        '#10B98199'),
      dashedEdge  ('e3', 'planner',        'mcp_tool',       'if tool_calls', '#F59E0B99'),
      solidEdge   ('e4', 'kb_search',      'rrf_ranking',    '#10B98166'),
      solidEdge   ('e5', 'mcp_tool',       'rrf_ranking',    '#F59E0B66'),
      solidEdge   ('e6', 'rrf_ranking',    'reranker',       '#8B5CF666'),
      solidEdge   ('e7', 'reranker',       'reasoner',       '#8B5CF666'),
      solidEdge   ('e8', 'reasoner',       'human_approval', '#3B82F666'),
      solidEdge   ('e9', 'human_approval', 'output',         '#D9B86C66'),
    ],
  },
};

// ─── Config Panel Sub-components ──────────────────────────────────────────────

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">
      {label}
    </label>
    {children}
  </div>
);

const TextInput = ({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <input
    type="text"
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20 placeholder:text-slate-700"
  />
);

const Readonly = ({ value }: { value: string }) => (
  <div className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 text-xs font-mono text-slate-400">
    {value}
  </div>
);

const Sel = ({
  value, options, onChange,
}: { value: string; options: string[]; onChange: (v: string) => void }) => (
  <div className="relative">
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white appearance-none focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
    >
      {options.map(o => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" />
  </div>
);

const Slider = ({
  label, value, min, max, step, onChange, color = '#8B5CF6',
}: {
  label: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; color?: string;
}) => (
  <div>
    <div className="flex justify-between items-center mb-1.5">
      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{label}</label>
      <span className="text-[10px] font-mono" style={{ color }}>{value}</span>
    </div>
    <input
      type="range"
      min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/10"
      style={{ accentColor: color }}
    />
    <div className="flex justify-between text-[8px] text-slate-700 mt-1">
      <span>{min}</span><span>{max}</span>
    </div>
  </div>
);

const InfoNote = ({ text }: { text: string }) => (
  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
    <p className="text-[11px] text-slate-500 italic leading-relaxed">{text}</p>
  </div>
);

const MCP_TOOLS = ['tra_cuu_phat_nguoi', 'query_dashboard', 'send_alert', 'export_report'];

// ─── Config Panel ─────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  node: Node<FlowNodeData> | null;
  onClose: () => void;
  onUpdate: (id: string, key: string, value: unknown) => void;
}

const ConfigPanel = ({ node, onClose, onUpdate }: ConfigPanelProps) => {
  if (!node) return null;
  const d   = node.data as FlowNodeData;
  const cfg = NODE_STYLE[d.nodeType] || NODE_STYLE.trigger;
  const upd = (key: string, value: unknown) => onUpdate(node.id, key, value);

  return (
    <motion.div
      key={node.id}
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      className="w-80 border-l border-white/10 bg-[#111827] flex flex-col shrink-0"
    >
      <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div style={{ background: `${cfg.color}20`, borderRadius: 8, padding: 6, display: 'flex' }}>
            <cfg.Icon size={14} color={cfg.color} />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">{d.label}</div>
            <div className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{ color: cfg.color }}>
              {cfg.typeLabel}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all text-xs">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-5 space-y-5">
        {d.nodeType === 'trigger' && (
          <InfoNote text="Nhận tất cả loại input từ user" />
        )}

        {d.nodeType === 'planner' && (
          <>
            <Field label="Model"><Readonly value="Qwen3-9B (hardcoded)" /></Field>
            <InfoNote text="Tự động đọc allowed_tools từ MCP Tool node" />
          </>
        )}

        {d.nodeType === 'kb_search' && (
          <>
            <Field label="KB Endpoint">
              <TextInput value={(d.kbEndpoint as string) || ''} onChange={v => upd('kbEndpoint', v)} placeholder="http://knowledge-space/api/kb/" />
            </Field>
            <Field label="KB Name">
              <TextInput value={(d.kbName as string) || ''} onChange={v => upd('kbName', v)} placeholder="kb_a05_violations" />
            </Field>
            <InfoNote text="Knowledge Space API tự biết search mode" />
          </>
        )}

        {d.nodeType === 'mcp_tool' && (
          <>
            <Field label="MCP Server URL">
              <TextInput value={(d.mcpServerUrl as string) || ''} onChange={v => upd('mcpServerUrl', v)} placeholder="http://mcp.tenant.gov.vn/sse" />
            </Field>
            <Field label="Allowed Tools">
              <div className="space-y-2 mt-0.5">
                {MCP_TOOLS.map(tool => {
                  const tools   = (d.allowedTools as string[]) || [];
                  const checked = tools.includes(tool);
                  return (
                    <label key={tool} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => upd('allowedTools', checked ? tools.filter(t => t !== tool) : [...tools, tool])}
                        className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-slate-400 group-hover:text-white transition-colors">{tool}</span>
                    </label>
                  );
                })}
              </div>
            </Field>
            <InfoNote text="Planner đọc danh sách này để quyết định" />
          </>
        )}

        {d.nodeType === 'rrf_ranking' && (
          <InfoNote text="k=60 (hardcoded)" />
        )}

        {d.nodeType === 'reranker' && (
          <>
            <Field label="Model">
              <Sel value={(d.rerankerModel as string) || 'BGE-Reranker-v2-m3'} options={['BGE-Reranker-v2-m3', 'bge-reranker-large']} onChange={v => upd('rerankerModel', v)} />
            </Field>
            <Slider label="Top-N" value={Number(d.topN ?? 5)} min={1} max={10} step={1} onChange={v => upd('topN', v)} color="#8B5CF6" />
          </>
        )}

        {d.nodeType === 'reasoner' && (
          <>
            <Field label="Model"><Readonly value="Qwen3-35B (local)" /></Field>
            <Field label="System Prompt">
              <Sel value={(d.systemPromptName as string) || 'prompt_default'} options={['prompt_default', 'prompt_phat_nguoi_v2', 'prompt_dashboard']} onChange={v => upd('systemPromptName', v)} />
            </Field>
            <Slider label="Temperature" value={Number(d.temperature ?? 0.2)} min={0} max={1} step={0.05} onChange={v => upd('temperature', v)} color="#3B82F6" />
            <Field label="Max Tokens">
              <input
                type="number"
                value={Number(d.maxTokens ?? 1000)}
                onChange={e => upd('maxTokens', parseInt(e.target.value, 10))}
                min={100} max={8000} step={100}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </Field>
          </>
        )}

        {d.nodeType === 'output' && (
          <InfoNote text="Trả structured data về Chat UI" />
        )}

        {d.nodeType === 'human_approval' && (
          <Field label="Approver Role">
            <Sel value={(d.approverRole as string) || 'MANAGER'} options={['MANAGER', 'EXECUTIVE', 'LEGAL', 'CUSTOM']} onChange={v => upd('approverRole', v)} />
          </Field>
        )}

        {['condition', 'db_query', 'send_notification', 'loop'].includes(d.nodeType) && (
          <InfoNote text="Node này chưa có config. Kéo vào canvas và kết nối với các node khác." />
        )}
      </div>
    </motion.div>
  );
};

// ─── All Library Nodes (all non-trigger types — 12 items) ─────────────────────

const ALL_LIBRARY_NODES: Array<{
  nodeType: FlowNodeType; label: string; color: string; Icon: any;
}> = [
  { nodeType: 'planner',           label: 'Planner',           color: '#3B82F6', Icon: Bot        },
  { nodeType: 'kb_search',         label: 'KB Search',         color: '#10B981', Icon: Database   },
  { nodeType: 'mcp_tool',          label: 'MCP Tool',          color: '#F59E0B', Icon: Wrench     },
  { nodeType: 'rrf_ranking',       label: 'RRF Ranking',       color: '#8B5CF6', Icon: Layers     },
  { nodeType: 'reranker',          label: 'Reranker',          color: '#8B5CF6', Icon: Filter     },
  { nodeType: 'reasoner',          label: 'Reasoner',          color: '#3B82F6', Icon: Cpu        },
  { nodeType: 'output',            label: 'Output',            color: '#6B7280', Icon: Activity   },
  { nodeType: 'human_approval',    label: 'Human Approval',    color: '#D9B86C', Icon: ShieldCheck },
  { nodeType: 'condition',         label: 'Condition',         color: '#6B7280', Icon: GitBranch  },
  { nodeType: 'send_notification', label: 'Send Notification', color: '#EF4444', Icon: Bell       },
  { nodeType: 'loop',              label: 'Loop',              color: '#3B82F6', Icon: RefreshCw  },
];

// ─── Node Library ─────────────────────────────────────────────────────────────

interface NodeLibraryProps {
  usedTypes: Set<FlowNodeType>;
}

const NodeLibrary = ({ usedTypes }: NodeLibraryProps) => {
  const [query, setQuery] = useState('');

  const available = ALL_LIBRARY_NODES.filter(n =>
    !usedTypes.has(n.nodeType) &&
    n.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="w-52 border-r border-white/10 bg-[#111827] flex flex-col shrink-0">
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-700" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find node…"
            className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-white/10 text-slate-400 placeholder:text-slate-700"
          />
        </div>
      </div>

      <div className="px-4 pt-3 pb-1">
        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
          Add to canvas
        </span>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-2 space-y-1">
        {available.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[10px] text-slate-700 italic">All nodes on canvas</p>
          </div>
        ) : (
          available.map(item => (
            <div
              key={item.nodeType}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('nodeType', item.nodeType);
                e.dataTransfer.effectAllowed = 'move';
              }}
              className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-grab active:cursor-grabbing border border-transparent hover:border-white/10 transition-all"
            >
              <GripVertical className="w-3 h-3 text-slate-700 group-hover:text-slate-500 shrink-0 transition-colors" />
              <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${item.color}20` }}>
                <item.Icon size={11} color={item.color} />
              </div>
              <span className="text-[11px] font-medium text-slate-500 group-hover:text-white transition-colors truncate">
                {item.label}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-white/10">
        <p className="text-[9px] text-slate-700 leading-relaxed">
          Kéo node vào canvas để thêm vào workflow
        </p>
      </div>
    </div>
  );
};

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface CtxMenuState { x: number; y: number; node: Node<FlowNodeData> }

const ContextMenu = ({
  menu, onConfigure, onDuplicate, onDelete, onClose,
}: {
  menu: CtxMenuState;
  onConfigure: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) => (
  <div
    className="fixed z-[200] min-w-[148px] bg-[#1e293b] border border-white/15 rounded-xl shadow-2xl overflow-hidden"
    style={{ left: menu.x, top: menu.y }}
    onClick={e => e.stopPropagation()}
  >
    <button
      onClick={() => { onConfigure(); onClose(); }}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold text-slate-300 hover:bg-white/10 transition-all text-left"
    >
      Configure
    </button>
    <button
      onClick={() => { onDuplicate(); onClose(); }}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold text-slate-300 hover:bg-white/10 transition-all text-left"
    >
      <Copy className="w-3 h-3" /> Duplicate
    </button>
    <div className="h-px bg-white/10" />
    <button
      onClick={() => { onDelete(); onClose(); }}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-all text-left"
    >
      Delete
    </button>
  </div>
);

// ─── Confirm Exit Dialog ──────────────────────────────────────────────────────

const ConfirmExitModal = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="relative z-10 bg-[#1e293b] border border-white/15 rounded-2xl p-7 w-[380px] shadow-2xl"
    >
      <h3 className="text-base font-bold text-white mb-2">Leave without saving?</h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">
        Unsaved changes will be lost. Are you sure you want to leave?
      </p>
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
        >
          Stay
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-xs font-bold text-white bg-red-500/80 hover:bg-red-500 rounded-xl transition-all"
        >
          Leave
        </button>
      </div>
    </motion.div>
  </div>
);

// ─── Main Builder ─────────────────────────────────────────────────────────────

export interface BuilderProps {
  onClose: () => void;
  workflow: Workflow | null;
  template?: TemplateId;
}

const WorkflowBuilder = ({ onClose, workflow, template = 'multi-agent' }: BuilderProps) => {
  const [viewMode, setViewMode]         = useState<'VISUAL' | 'CODE'>('VISUAL');
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [ctxMenu, setCtxMenu]           = useState<CtxMenuState | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const rfInstance                       = useRef<any>(null);

  const requestExit = useCallback(() => setShowExitConfirm(true), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showExitConfirm) setShowExitConfirm(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showExitConfirm]);

  // ── Toasts ───────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const addToast = useCallback((msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  // ── Flow state ────────────────────────────────────────────────────────────────
  const initFlow = useMemo(
    () => TEMPLATE_FLOWS[template] ?? TEMPLATE_FLOWS['multi-agent'],
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initFlow.edges);

  // Types currently on canvas → drives library visibility
  const usedTypes = useMemo(
    () => new Set(nodes.map(n => (n.data as FlowNodeData).nodeType)),
    [nodes],
  );

  // ── Connect ───────────────────────────────────────────────────────────────────
  const onConnect = useCallback<OnConnect>(
    conn => setEdges(eds => addEdge(
      {
        ...conn,
        type: 'wfEdge',
        animated: true,
        style: { stroke: '#ffffff22', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff44' },
      },
      eds,
    )),
    [setEdges],
  );

  // ── Drag & drop ───────────────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType') as FlowNodeType;
    if (!nodeType || !rfInstance.current) return;
    const pos = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const cfg = NODE_STYLE[nodeType];
    if (!cfg) return;
    const id = `${nodeType}-${Date.now()}`;
    setNodes(nds => [...nds, mkNode(id, nodeType, cfg.typeLabel, pos.x - 89, pos.y - 35)]);
    addToast(`Added: ${cfg.typeLabel}`);
  }, [setNodes, addToast]);

  // ── Node interactions ─────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<FlowNodeData>);
    setCtxMenu(null);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setCtxMenu(null);
  }, []);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, node: node as Node<FlowNodeData> });
  }, []);

  // ── Config update ─────────────────────────────────────────────────────────────
  const updateNodeConfig = useCallback((id: string, key: string, value: unknown) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n));
    setSelectedNode(prev =>
      prev?.id === id ? { ...prev, data: { ...prev.data, [key]: value } } as Node<FlowNodeData> : prev,
    );
  }, [setNodes]);

  // ── Delete node (context menu) ────────────────────────────────────────────────
  const deleteNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) addToast(`Node removed: ${(node.data as FlowNodeData).label}`);
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  }, [nodes, setNodes, setEdges, selectedNode, addToast]);

  // ── Delete node (Delete key — fired by React Flow's onNodesDelete) ────────────
  const onNodesDelete = useCallback((deleted: Node[]) => {
    deleted.forEach(n => addToast(`Node removed: ${(n.data as FlowNodeData).label}`));
  }, [addToast]);

  // ── Delete edge (Delete key) ───────────────────────────────────────────────────
  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    if (deleted.length > 0) addToast(`Edge${deleted.length > 1 ? 's' : ''} removed`);
  }, [addToast]);

  // ── Duplicate node (context menu) ────────────────────────────────────────────
  const duplicateNode = useCallback((node: Node<FlowNodeData>) => {
    const id   = `${node.data.nodeType}-${Date.now()}`;
    const copy = mkNode(id, node.data.nodeType, node.data.label, node.position.x + 40, node.position.y + 40, { ...node.data });
    setNodes(nds => [...nds, copy]);
    addToast(`Duplicated: ${node.data.label}`);
  }, [setNodes, addToast]);

  // ── YAML preview ──────────────────────────────────────────────────────────────
  const yamlPreview = `name: "${workflow?.name ?? 'New Workflow'}"
version: "${workflow?.version ?? 'v1.0.0-draft'}"
template: "${template}"

nodes:
${nodes.map(n => {
  const d = n.data as FlowNodeData;
  return `  - id: "${n.id}"
    type: "${d.nodeType}"
    label: "${d.label}"`;
}).join('\n')}

edges:
${edges.map(e => `  - from: "${e.source}"  to: "${e.target}"`).join('\n')}`;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <BuilderToastCtx.Provider value={addToast}>
      <div
        className="fixed inset-0 z-[100] flex flex-col bg-[#0d1117] text-slate-200"
        onClick={() => setCtxMenu(null)}
      >
        {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
        <div className="h-14 border-b border-white/10 bg-[#0d1117] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={requestExit}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white group"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest max-w-0 overflow-hidden group-hover:max-w-[3rem] transition-all duration-200 whitespace-nowrap">
                Back
              </span>
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div>
              <div className="text-sm font-bold text-white leading-none">
                {workflow?.name ?? 'New Workflow'}
              </div>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                {workflow?.version ?? 'v1.0.0-draft'} · {nodes.length} nodes · {edges.length} edges
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              {([['VISUAL', Layout, 'Visual'], ['CODE', CodeIcon, 'YAML']] as const).map(([mode, Icon, lbl]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    viewMode === mode ? 'bg-white/10 text-white' : 'text-slate-600 hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {lbl}
                </button>
              ))}
            </div>

            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              <Play className="w-3 h-3" />
              Dry Run
            </button>

            <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20">
              <Save className="w-3 h-3" />
              Save
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          <NodeLibrary usedTypes={usedTypes} />

          {/* Canvas drop zone */}
          <div
            className="flex-1 relative overflow-hidden"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <AnimatePresence mode="wait">
              {viewMode === 'VISUAL' ? (
                <motion.div
                  key="visual"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="absolute inset-0"
                >
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={handleNodeClick}
                    onPaneClick={handlePaneClick}
                    onNodeContextMenu={handleNodeContextMenu}
                    onNodesDelete={onNodesDelete}
                    onEdgesDelete={onEdgesDelete}
                    onInit={inst => { rfInstance.current = inst; }}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    style={{ background: '#0f172a' }}
                    connectionLineStyle={{ stroke: '#ffffff44', strokeWidth: 2 }}
                    deleteKeyCode="Delete"
                  >
                    <Background
                      variant={BackgroundVariant.Dots}
                      color="rgba(255,255,255,0.08)"
                      gap={24}
                      size={1.5}
                    />
                    <Controls
                      style={{
                        background: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 10,
                        overflow: 'hidden',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                      }}
                    />
                  </ReactFlow>
                </motion.div>
              ) : (
                <motion.div
                  key="yaml"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.12 }}
                  className="absolute inset-0 bg-[#111827] p-8 overflow-auto custom-scrollbar"
                >
                  <pre className="font-mono text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {yamlPreview}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {selectedNode && (
              <ConfigPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onUpdate={updateNodeConfig}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── Status Bar ───────────────────────────────────────────────────────── */}
        <div className="h-9 bg-[#111827] border-t border-white/10 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">DAG Valid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                {nodes.length} nodes · {edges.length} edges
              </span>
            </div>
          </div>
          <button className="flex items-center gap-1.5 text-slate-700 hover:text-slate-400 transition-colors">
            <Terminal className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">Runtime Logs</span>
          </button>
        </div>

        {/* ── Exit Confirm ─────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showExitConfirm && (
            <ConfirmExitModal
              onConfirm={onClose}
              onCancel={() => setShowExitConfirm(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Context Menu ─────────────────────────────────────────────────────── */}
        {ctxMenu && (
          <ContextMenu
            menu={ctxMenu}
            onConfigure={() => setSelectedNode(ctxMenu.node)}
            onDuplicate={() => duplicateNode(ctxMenu.node)}
            onDelete={() => deleteNode(ctxMenu.node.id)}
            onClose={() => setCtxMenu(null)}
          />
        )}

        {/* ── Toasts ───────────────────────────────────────────────────────────── */}
        <div className="fixed bottom-12 right-4 z-[300] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 20, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.92 }}
                transition={{ duration: 0.16 }}
                className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-300 shadow-xl"
              >
                {t.msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </div>
    </BuilderToastCtx.Provider>
  );
};

export default WorkflowBuilder;
