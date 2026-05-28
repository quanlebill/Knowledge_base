import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, RefreshCw, AlertTriangle, Info, AlertCircle, ScrollText, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

/* ─── Types ─────────────────────────────────────────────── */
type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  eventType: string;
  message: string;
  detail?: string;
  stackTrace?: string;
  traceId?: string;
  durationMs?: number;
}

/* ─── Mock data ──────────────────────────────────────────── */
const MOCK_LOGS: LogEntry[] = [
  {
    id: 'log-001', timestamp: '2026-05-22 11:42:18.203',
    level: 'ERROR', service: 'responder', eventType: 'INFERENCE_FAILED',
    message: 'Model timeout after 30000ms — request aborted',
    detail: 'Request ID: req-7d2a9f · Model: Qwen3.6-27B · Token budget: 4096 · Session: conv-3c9d',
    stackTrace: `TimeoutError: Inference timed out after 30000ms
  at InferenceEngine.run (/app/responder/engine.ts:142:18)
  at async ResponderService.handle (/app/responder/service.ts:87:12)
  at async RequestHandler.process (/app/gateway/handler.ts:54:8)`,
    traceId: 'trace-4bc2', durationMs: 30001,
  },
  {
    id: 'log-002', timestamp: '2026-05-22 11:41:55.110',
    level: 'WARN', service: 'kb-search', eventType: 'SIMILARITY_LOW',
    message: 'Query returned 0 results above threshold (0.75)',
    detail: 'Query: "procurement exemption framework" · Collection: chroma_kb_tenderbid · Fallback: BM25 activated',
    traceId: 'trace-3a9f',
  },
  {
    id: 'log-003', timestamp: '2026-05-22 11:40:02.445',
    level: 'INFO', service: 'planner-service', eventType: 'PLAN_GENERATED',
    message: 'Execution plan created: 4 steps',
    detail: 'Steps: [kb_search, rerank, responder, output] · Estimated tokens: 1200 · Trace: trace-2e8d',
    traceId: 'trace-2e8d', durationMs: 312,
  },
  {
    id: 'log-004', timestamp: '2026-05-22 11:38:44.889',
    level: 'INFO', service: 'mcp-gateway', eventType: 'TOOL_CALLED',
    message: 'Tool "query_dashboard" invoked successfully',
    detail: 'Tool: query_dashboard · Args: { vendor_id: "VND-2026-112" } · Result size: 284B',
    traceId: 'trace-1c7b', durationMs: 88,
  },
  {
    id: 'log-005', timestamp: '2026-05-22 11:37:10.002',
    level: 'WARN', service: 'api-gateway', eventType: 'RATE_LIMIT',
    message: 'Client 192.168.1.45 approaching rate limit (87/100 req/min)',
    detail: 'Client IP: 192.168.1.45 · Current: 87/100 req/min · Window: 60s',
  },
  {
    id: 'log-006', timestamp: '2026-05-22 11:35:28.771',
    level: 'INFO', service: 'responder', eventType: 'INFERENCE_COMPLETE',
    message: 'Response generated in 1540ms (812 tokens)',
    detail: 'Model: Qwen3-4B · Input: 620tk · Output: 192tk · KV cache hit: true',
    traceId: 'trace-9f3c', durationMs: 1540,
  },
  {
    id: 'log-007', timestamp: '2026-05-22 11:34:05.330',
    level: 'ERROR', service: 'mcp-gateway', eventType: 'TOOL_ERROR',
    message: 'Tool "tra_cuu_phat_nguoi" returned HTTP 503',
    detail: 'Tool: tra_cuu_phat_nguoi · Upstream status: 503 · Retries: 3/3 exhausted',
    stackTrace: `ServiceUnavailableError: Upstream returned HTTP 503
  at MCPClient.call (/app/mcp/client.ts:78:14)
  at async ToolRegistry.invoke (/app/mcp/registry.ts:44:9)
  at async PlanExecutor.runStep (/app/planner/executor.ts:119:22)`,
    traceId: 'trace-8e1a', durationMs: 15003,
  },
  {
    id: 'log-008', timestamp: '2026-05-22 11:32:50.008',
    level: 'INFO', service: 'kb-search', eventType: 'QUERY_COMPLETE',
    message: '5 chunks retrieved in 88ms (cosine similarity)',
    detail: 'Collection: chroma_kb_tenderbid · Results: 5 · Threshold: 0.75 · Top score: 0.93',
    traceId: 'trace-7d4b', durationMs: 88,
  },
  {
    id: 'log-009', timestamp: '2026-05-22 11:30:14.556',
    level: 'WARN', service: 'responder', eventType: 'CONTEXT_OVERFLOW',
    message: 'Context window 92% full — truncating older turns',
    detail: 'Model: Qwen3.6-27B · Context: 14746/16000 tokens · Turns dropped: 2',
  },
  {
    id: 'log-010', timestamp: '2026-05-22 11:28:40.112',
    level: 'INFO', service: 'api-gateway', eventType: 'REQUEST',
    message: 'POST /api/v1/agent/run — 200 OK in 1623ms',
    detail: 'User: tran.b@gtel.vn · Agent: rag-agent · Session: conv-3c9d',
    durationMs: 1623,
  },
  {
    id: 'log-011', timestamp: '2026-05-22 11:25:03.998',
    level: 'ERROR', service: 'planner-service', eventType: 'PARSE_FAILED',
    message: 'LLM output could not be parsed as valid plan JSON',
    detail: 'Raw output length: 2048 chars · Error at position: 142 · Retrying with simplified prompt',
    stackTrace: `JSONParseError: Unexpected token '}'
  at PlanParser.parse (/app/planner/parser.ts:33:11)
  at PlannerService.plan (/app/planner/service.ts:61:24)
  at async RequestHandler.process (/app/gateway/handler.ts:54:8)`,
    traceId: 'trace-5c2e',
  },
  {
    id: 'log-012', timestamp: '2026-05-22 11:22:18.440',
    level: 'INFO', service: 'mcp-gateway', eventType: 'TOOL_REGISTERED',
    message: 'Tool "kb_search_v2" registered from mcp://kb-service:8080',
    detail: 'Total tools: 7 · New: kb_search_v2 · Timeout: 10000ms · Schema validated: OK',
  },
  {
    id: 'log-013', timestamp: '2026-05-22 11:20:05.001',
    level: 'WARN', service: 'api-gateway', eventType: 'AUTH_RETRY',
    message: 'JWT verification failed — retrying with refresh token',
    detail: 'User: le.c@gtel.vn · Error: TokenExpiredError · Retry: 1/1 · Outcome: success',
  },
  {
    id: 'log-014', timestamp: '2026-05-22 11:18:30.778',
    level: 'INFO', service: 'kb-search', eventType: 'INDEX_REBUILT',
    message: 'Embedding index rebuilt for collection "chroma_kb_legal"',
    detail: 'Vectors: 12,400 · Rebuild duration: 45s · Embedding model: text-embedding-3-small',
    durationMs: 45000,
  },
  {
    id: 'log-015', timestamp: '2026-05-22 11:15:00.000',
    level: 'INFO', service: 'planner-service', eventType: 'HEALTH_CHECK',
    message: 'Planner service healthy — all 4 workers responding',
    detail: 'Workers: 4/4 · Queue depth: 2 · p99 latency: 340ms',
    durationMs: 4,
  },
];

const SERVICES = ['All services', 'planner-service', 'kb-search', 'mcp-gateway', 'responder', 'api-gateway'];
const LEVELS: Array<'all' | LogLevel> = ['all', 'INFO', 'WARN', 'ERROR'];

/* ─── Helpers ─────────────────────────────────────────────── */
const LEVEL_STYLE: Record<LogLevel, string> = {
  INFO:  'bg-blue-50 text-blue-700 border border-blue-200',
  WARN:  'bg-amber-50 text-amber-700 border border-amber-200',
  ERROR: 'bg-red-50   text-red-700   border border-red-200',
};
const LEVEL_ROW: Record<LogLevel, string> = {
  INFO:  '',
  WARN:  'bg-amber-50/30',
  ERROR: 'bg-red-50/40',
};
const LevelIcon = ({ level }: { level: LogLevel }) => {
  if (level === 'ERROR') return <AlertCircle size={12} className="text-red-500" />;
  if (level === 'WARN')  return <AlertTriangle size={12} className="text-amber-500" />;
  return <Info size={12} className="text-blue-500" />;
};

/* ─── Log detail drawer ───────────────────────────────────── */
function LogDrawer({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copyTrace = () => {
    if (log.stackTrace) navigator.clipboard.writeText(log.stackTrace);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="fixed top-0 right-0 h-full w-[520px] bg-[#FCFBF7] border-l border-[#BFA66A] flex flex-col z-50 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#BFA66A]/50 bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <LevelIcon level={log.level} />
          <div>
            <p className="text-sm font-semibold text-[#111111]">{log.eventType}</p>
            <p className="text-[11px] text-[#5A5A5A]">{log.service} · {log.timestamp}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3E2A7] text-[#5A5A5A] hover:text-[#111111] transition-colors border border-transparent hover:border-[#BFA66A]">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Level + IDs */}
        <div className="flex flex-wrap gap-2">
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', LEVEL_STYLE[log.level])}>
            <LevelIcon level={log.level} /> {log.level}
          </span>
          {log.traceId && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[#F3E2A7] text-[#7C5A0E] border border-[#BFA66A]/50 font-mono">
              {log.traceId}
            </span>
          )}
          {log.durationMs != null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#F0F0F0] text-[#5A5A5A] border border-gray-200">
              {log.durationMs}ms
            </span>
          )}
        </div>

        {/* Message */}
        <div>
          <p className="text-[10px] text-[#5A5A5A] uppercase tracking-wider mb-1.5 font-semibold">Message</p>
          <p className="text-sm text-[#111111] leading-relaxed">{log.message}</p>
        </div>

        {/* Detail */}
        {log.detail && (
          <div>
            <p className="text-[10px] text-[#5A5A5A] uppercase tracking-wider mb-1.5 font-semibold">Detail</p>
            <p className="text-xs text-[#2A2A2A] leading-relaxed bg-white border border-[#BFA66A]/30 rounded-lg p-3">{log.detail}</p>
          </div>
        )}

        {/* Stack trace (ERROR only) */}
        {log.stackTrace && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-red-600 uppercase tracking-wider font-semibold">Stack Trace</p>
              <button onClick={copyTrace} className="flex items-center gap-1 text-[10px] text-[#5A5A5A] hover:text-[#111111] transition-colors">
                <Copy size={10} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
              {log.stackTrace}
            </pre>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main ────────────────────────────────────────────────── */
export default function SystemLogs() {
  const [search, setSearch]         = useState('');
  const [levelFilter, setLevel]     = useState<'all' | LogLevel>('all');
  const [serviceFilter, setService] = useState('All services');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeLog, setActiveLog]   = useState<LogEntry | null>(null);
  const [tick, setTick]             = useState(0);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const filtered = MOCK_LOGS.filter(l => {
    const matchSearch  = l.message.toLowerCase().includes(search.toLowerCase()) || l.service.includes(search) || l.eventType.includes(search.toUpperCase());
    const matchLevel   = levelFilter === 'all' || l.level === levelFilter;
    const matchService = serviceFilter === 'All services' || l.service === serviceFilter;
    return matchSearch && matchLevel && matchService;
  });

  const counts = { INFO: 0, WARN: 0, ERROR: 0 };
  MOCK_LOGS.forEach(l => counts[l.level]++);

  return (
    <div className="space-y-5">
      {/* Summary badges */}
      <div className="flex items-center gap-3">
        {(['INFO', 'WARN', 'ERROR'] as LogLevel[]).map(lvl => (
          <button
            key={lvl}
            onClick={() => setLevel(l => l === lvl ? 'all' : lvl)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
              levelFilter === lvl ? LEVEL_STYLE[lvl] : 'bg-white border-[#BFA66A]/40 text-[#5A5A5A] hover:border-[#BFA66A]',
            )}
          >
            <LevelIcon level={lvl} />
            {lvl} <span className="font-mono">{counts[lvl]}</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-[#5A5A5A]">{filtered.length} entries</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A7A]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search message, service, event…"
            className="pl-9 pr-3 py-2 bg-white border border-[#BFA66A]/60 rounded-lg text-xs text-[#111111] placeholder-[#8A8A7A] focus:outline-none focus:border-[#8A5A00] w-64"
          />
        </div>
        <select
          value={serviceFilter} onChange={e => setService(e.target.value)}
          className="bg-white border border-[#BFA66A]/60 text-xs text-[#2A2A2A] rounded-lg px-3 py-2 focus:outline-none focus:border-[#8A5A00] cursor-pointer"
        >
          {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh(v => !v)}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ml-auto',
            autoRefresh
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-white border-[#BFA66A]/60 text-[#5A5A5A] hover:border-[#BFA66A]',
          )}
        >
          <RefreshCw size={12} className={cn(autoRefresh && 'animate-spin')} />
          Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Table */}
      <div className="warm-panel rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#BFA66A]/40 bg-[#FFF9E8]">
              {['Timestamp', 'Level', 'Service', 'Event Type', 'Message', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[#5A5A5A] font-semibold uppercase tracking-wider text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((log, i) => (
              <tr
                key={log.id}
                className={cn(
                  'border-b border-[#BFA66A]/15 hover:bg-[#FFF9E8] cursor-pointer transition-colors',
                  LEVEL_ROW[log.level],
                  i === filtered.length - 1 && 'border-b-0',
                )}
                onClick={() => setActiveLog(log)}
              >
                <td className="px-4 py-3 font-mono text-[10px] text-[#5A5A5A] whitespace-nowrap">{log.timestamp}</td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold', LEVEL_STYLE[log.level])}>
                    <LevelIcon level={log.level} /> {log.level}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-[#7C5A0E]">{log.service}</td>
                <td className="px-4 py-3 text-[#2A2A2A] font-medium">{log.eventType}</td>
                <td className="px-4 py-3 text-[#5A5A5A] max-w-xs truncate">{log.message}</td>
                <td className="px-4 py-3">
                  <button
                    className="text-[11px] text-[#8A5A00] hover:underline font-semibold"
                    onClick={e => { e.stopPropagation(); setActiveLog(log); }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer overlay */}
      <AnimatePresence>
        {activeLog && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setActiveLog(null)}
            />
            <LogDrawer log={activeLog} onClose={() => setActiveLog(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
