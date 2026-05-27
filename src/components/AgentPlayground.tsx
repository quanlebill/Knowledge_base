import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Bug,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  Bot,
  User,
  Layers,
  Search,
  Brain,
  FileOutput,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8001';

/* ─── Types ─────────────────────────────────────────────────── */

interface TraceStep {
  id: string;
  node: string;
  icon: React.ReactNode;
  status: 'success' | 'error' | 'running';
  latencyMs: number;
  tokens: number;
  input: string;
  output: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AgentOption {
  id: string;
  label: string;
  type: 'agent' | 'workflow';
}

/* ─── Mock data ─────────────────────────────────────────────── */

const AGENTS: AgentOption[] = [
  { id: 'rag-agent',        label: 'RAG Agent (Qwen3-4B)',        type: 'agent' },
  { id: 'full-agent',       label: 'Full Agent (Qwen3.6-27B)',    type: 'agent' },
  { id: 'wf-tender',        label: 'Tender Analysis Workflow',    type: 'workflow' },
  { id: 'wf-compliance',    label: 'Compliance Check Workflow',   type: 'workflow' },
];

const MOCK_TRACE: TraceStep[] = [
  {
    id: 'planner',
    node: 'Planner',
    icon: <Brain size={14} />,
    status: 'success',
    latencyMs: 312,
    tokens: 284,
    input: 'User query: "What are the penalty regulations for late tender submissions?"',
    output: 'Plan: [1] Search KB for tender penalty regulations [2] Rerank results [3] Generate answer via Reasoner',
  },
  {
    id: 'kb-search',
    node: 'KB Search',
    icon: <Search size={14} />,
    status: 'success',
    latencyMs: 88,
    tokens: 0,
    input: 'Query vector embedding: "penalty regulations late tender submission"',
    output: '5 chunks retrieved from chroma_kb_tenderbid (cosine sim > 0.78)',
  },
  {
    id: 'reranker',
    node: 'Reranker',
    icon: <Layers size={14} />,
    status: 'success',
    latencyMs: 54,
    tokens: 0,
    input: '5 candidate chunks',
    output: 'Top 3 chunks selected (cross-encoder scores: 0.93, 0.87, 0.81)',
  },
  {
    id: 'reasoner',
    node: 'Reasoner',
    icon: <Brain size={14} />,
    status: 'success',
    latencyMs: 1140,
    tokens: 812,
    input: 'Context: [3 chunks] + User query',
    output: 'According to Article 11, Section 3 of Circular 09/2023/TT-BKHDT, contractors submitting bids after the deadline will be penalized 0.05% of the contract value per day of delay, up to a maximum of 5%.',
  },
  {
    id: 'output',
    node: 'Output',
    icon: <FileOutput size={14} />,
    status: 'success',
    latencyMs: 12,
    tokens: 0,
    input: 'Reasoner response',
    output: 'Formatted response sent to user.',
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Hello! I am the GTEL RAG Agent. Ask me anything about regulations, tender procedures, or compliance requirements.',
    timestamp: '09:14',
  },
  {
    id: '2',
    role: 'user',
    content: 'What are the penalty regulations for late tender submissions?',
    timestamp: '09:15',
  },
  {
    id: '3',
    role: 'assistant',
    content: 'According to **Article 11, Section 3 of Circular 09/2023/TT-BKHDT**, contractors submitting bids after the deadline will be penalized **0.05% of the contract value per day** of delay, up to a maximum of **5%** of the total contract value.\n\nThis applies to all public procurement contracts governed by the Law on Bidding 2023.',
    timestamp: '09:15',
  },
];

/* ─── Sub-components ────────────────────────────────────────── */

function TraceStepCard({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
      >
        <span className={cn(
          'flex items-center justify-center w-5 h-5 rounded-full text-[10px] shrink-0',
          step.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
          step.status === 'error'   ? 'bg-red-500/20 text-red-400' :
                                      'bg-amber-500/20 text-amber-400',
        )}>
          {step.status === 'success' ? <CheckCircle2 size={11} /> :
           step.status === 'error'   ? <AlertCircle size={11} /> :
                                       <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
        </span>

        <span className="flex items-center gap-1.5 text-white/70 shrink-0">
          {step.icon}
          <span className="text-xs font-medium text-white/80">{step.node}</span>
        </span>

        <span className="ml-auto flex items-center gap-3 text-[11px] text-white/40 shrink-0">
          <span className="flex items-center gap-1"><Clock size={10} /> {step.latencyMs}ms</span>
          {step.tokens > 0 && <span className="flex items-center gap-1"><Zap size={10} /> {step.tokens}tk</span>}
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-white/10">
              <div className="mt-2">
                <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Input</p>
                <p className="text-[11px] text-white/60 leading-relaxed font-mono bg-white/[0.03] rounded p-2">{step.input}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Output</p>
                <p className="text-[11px] text-white/60 leading-relaxed font-mono bg-white/[0.03] rounded p-2">{step.output}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}
    >
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-indigo-500/30' : 'bg-white/10',
      )}>
        {isUser ? <User size={13} className="text-indigo-300" /> : <Bot size={13} className="text-white/60" />}
      </div>
      <div className={cn(
        'max-w-[78%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-indigo-600/30 text-white/90 rounded-tr-sm'
          : 'bg-white/[0.07] text-white/75 rounded-tl-sm',
      )}>
        {msg.content.split('\n').map((line, i) => (
          <p key={i} className={i > 0 ? 'mt-1' : ''}>{renderContent(line)}</p>
        ))}
        <p className="text-[10px] text-white/25 mt-1.5">{msg.timestamp}</p>
      </div>
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */

export default function AgentPlayground({ embedded = false }: { embedded?: boolean }) {
  const [debugOn, setDebugOn] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].id);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const totalLatency = MOCK_TRACE.reduce((s, t) => s + t.latencyMs, 0);
  const totalTokens  = MOCK_TRACE.reduce((s, t) => s + t.tokens, 0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: now };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    const placeholderId = (Date.now() + 1).toString();
    const placeholder: Message = { id: placeholderId, role: 'assistant', content: '', timestamp: now };
    setMessages(prev => [...prev, placeholder]);

    try {
      const res = await fetch(`${API_BASE}/api/conversations/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          agent_id: selectedAgent,
          messages: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]' || data.startsWith('[ERROR]')) continue;
          fullText += data;
          setMessages(prev => prev.map(m =>
            m.id === placeholderId ? { ...m, content: fullText } : m,
          ));
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === placeholderId ? { ...m, content: 'Lỗi: không kết nối được backend.' } : m,
      ));
    } finally {
      setSending(false);
    }
  };

  const agentLabel = AGENTS.find(a => a.id === selectedAgent)?.label ?? 'Agent';

  return (
    <div className={cn(
      'flex flex-col',
      embedded
        ? 'h-[calc(100vh-320px)] min-h-[520px] rounded-xl border border-white/10 overflow-hidden bg-[#0D0D0D]'
        : 'h-full bg-[#0A0A0A]',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <MessageSquare size={16} className="text-indigo-400" />
          <span className="text-sm font-semibold text-white/80">Agent Playground</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Agent/Workflow selector — custom dropdown */}
          <div className="relative" ref={selectorRef}>
            <button
              onClick={() => setSelectorOpen(v => !v)}
              className="flex items-center gap-2 bg-white/[0.06] border border-white/10 text-white/70 text-xs rounded-lg pl-3 pr-2.5 py-1.5 hover:border-white/20 transition-colors min-w-[190px]"
            >
              <span className="flex-1 text-left truncate">{AGENTS.find(a => a.id === selectedAgent)?.label}</span>
              <ChevronDown size={12} className={cn('text-white/40 transition-transform shrink-0', selectorOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {selectorOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 w-56 bg-[#1C1C1C] border border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                >
                  <p className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-white/30">Agents</p>
                  {AGENTS.filter(a => a.type === 'agent').map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setSelectedAgent(a.id); setSelectorOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs transition-colors',
                        selectedAgent === a.id
                          ? 'text-indigo-300 bg-indigo-500/15'
                          : 'text-white/60 hover:bg-white/[0.06] hover:text-white/80',
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                  <div className="mx-3 my-1 border-t border-white/10" />
                  <p className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-white/30">Workflows</p>
                  {AGENTS.filter(a => a.type === 'workflow').map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setSelectedAgent(a.id); setSelectorOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs transition-colors',
                        selectedAgent === a.id
                          ? 'text-indigo-300 bg-indigo-500/15'
                          : 'text-white/60 hover:bg-white/[0.06] hover:text-white/80',
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Debug toggle */}
          <button
            onClick={() => setDebugOn(v => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
              debugOn
                ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                : 'border-white/10 bg-white/[0.04] text-white/40 hover:text-white/60',
            )}
          >
            <Bug size={12} />
            Debug {debugOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* ── Chat panel ────────────────────────────────────── */}
        <div className={cn('flex flex-col', debugOn ? 'w-[55%] border-r border-white/10' : 'flex-1')}>
          {/* Chat context badge */}
          <div className="px-4 py-2 border-b border-white/[0.06] shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/40">
              <Bot size={11} />
              {agentLabel}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
            </AnimatePresence>

            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2.5"
              >
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  <Bot size={13} className="text-white/60" />
                </div>
                <div className="bg-white/[0.07] rounded-xl rounded-tl-sm px-4 py-2.5 flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 shrink-0">
            <div className="flex gap-2 items-end bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 focus-within:border-indigo-500/40 transition-colors">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Ask the agent anything… (Enter to send, Shift+Enter for newline)"
                rows={1}
                className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 resize-none focus:outline-none leading-relaxed"
                style={{ maxHeight: 120 }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="shrink-0 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <Send size={13} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Trace panel ───────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {debugOn && (
            <motion.div
              key="trace"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '45%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] shrink-0">
                <span className="text-xs font-medium text-white/50">Trace — last run</span>
                <span className="text-[11px] text-white/30">mock data</span>
              </div>

              {/* Steps */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {MOCK_TRACE.map((step, i) => (
                  <div key={step.id} className="relative">
                    {i < MOCK_TRACE.length - 1 && (
                      <div className="absolute left-[22px] top-[38px] w-px h-[calc(100%-10px)] bg-white/10 z-0" />
                    )}
                    <TraceStepCard step={step} />
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="px-4 py-3 border-t border-white/10 shrink-0 grid grid-cols-3 gap-3">
                <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-white/30 mb-0.5">Total Latency</p>
                  <p className="text-sm font-semibold text-white/80">{totalLatency}ms</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-white/30 mb-0.5">Total Tokens</p>
                  <p className="text-sm font-semibold text-white/80">{totalTokens.toLocaleString()}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-white/30 mb-0.5">Model</p>
                  <p className="text-[11px] font-semibold text-white/80 truncate">Qwen3-4B</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
