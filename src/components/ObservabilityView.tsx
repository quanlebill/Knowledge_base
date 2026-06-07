import React, { useState } from 'react';
import {
  Activity, Search, Terminal, Cpu, Zap, Clock,
  AlertCircle, CheckCircle2, Maximize2, Brain, Code2,
  Info, ShieldCheck, Download, MessageSquare, Ban, TrendingUp
} from 'lucide-react';
import { cn } from '../lib/utils';
import { DetailDrawer } from './shared/DetailDrawer';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

const QUERY_LOGS = [
  { id: 'Q-4821', query: 'What is the refund policy for EMEA customers?', model: 'Gemini 1.5 Flash', status: 'OK', latency: 420, latencyStr: '420ms', tokens: 840, timestamp: '12:04:22', user: 'u/3829' },
  { id: 'Q-4822', query: 'Summarize Q4 sales report for the executive team', model: 'Gemini 1.5 Pro', status: 'ERROR', latency: 2400, latencyStr: '2.4s', tokens: 0, timestamp: '12:04:25', user: 'u/7712' },
  { id: 'Q-4823', query: 'Find all contracts expiring in the next 30 days', model: 'Gemini 1.5 Flash', status: 'OK', latency: 180, latencyStr: '180ms', tokens: 320, timestamp: '12:04:28', user: 'u/1042' },
  { id: 'Q-4824', query: 'Who has access to the financial records vault?', model: 'Gemini 1.5 Pro', status: 'BLOCKED', latency: 90, latencyStr: '90ms', tokens: 0, timestamp: '12:04:30', user: 'u/5588' },
  { id: 'Q-4825', query: 'Generate onboarding email for new enterprise client', model: 'Gemini 1.5 Flash', status: 'OK', latency: 560, latencyStr: '560ms', tokens: 1240, timestamp: '12:04:33', user: 'u/2201' },
  { id: 'Q-4826', query: 'Compare pricing models between vendor A and vendor B', model: 'Gemini 1.5 Pro', status: 'OK', latency: 380, latencyStr: '380ms', tokens: 720, timestamp: '12:04:38', user: 'u/9901' },
];

const CHART_DATA = [
  { t: '12:00', latency: 280, load: 42 },
  { t: '12:10', latency: 340, load: 55 },
  { t: '12:20', latency: 580, load: 89 },
  { t: '12:30', latency: 420, load: 67 },
  { t: '12:40', latency: 290, load: 48 },
  { t: '12:50', latency: 310, load: 52 },
  { t: '13:00', latency: 260, load: 38 },
];

const STATUS_CONFIG = {
  OK:      { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  ERROR:   { color: 'text-red-700',     bg: 'bg-red-50 border-red-200',         icon: AlertCircle  },
  BLOCKED: { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     icon: Ban          },
};

const DRAWER_TABS = [
  { id: 'OVERVIEW',  label: 'Overview',    icon: Info   },
  { id: 'REASONING', label: 'AI Trace',    icon: Brain  },
  { id: 'PAYLOAD',   label: 'Raw Payload', icon: Code2  },
];

export const ObservabilityView = () => {
  const [selectedLog, setSelectedLog] = useState<(typeof QUERY_LOGS)[0] | null>(null);
  const [activeTab, setActiveTab]     = useState('OVERVIEW');
  const [search, setSearch]           = useState('');

  const filtered = QUERY_LOGS.filter(q =>
    q.query.toLowerCase().includes(search.toLowerCase()) ||
    q.id.toLowerCase().includes(search.toLowerCase())
  );

  const currentLoad = 67;
  const isHighLoad  = currentLoad >= 75;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[#B88719] text-[10px] font-bold font-mono tracking-widest uppercase mb-2">
          <Activity className="w-3.5 h-3.5" />
          AI Runtime · System Log
        </div>
        <h1 className="text-3xl font-display font-medium tracking-tight text-[#111111]">Query Logs</h1>
        <p className="text-[#5A5A5A] mt-1 text-sm">Real-time AI query activity, latency tracking, and system load.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Queries Today', value: '4,821', sub: '+12% vs yesterday',   icon: MessageSquare, alert: false },
          { label: 'Avg Latency',   value: '328ms', sub: 'P50 response time',   icon: Clock,        alert: false },
          { label: 'P95 Latency',   value: '580ms', sub: 'Peak at 12:20',       icon: TrendingUp,   alert: false },
          { label: 'System Load',   value: `${currentLoad}%`, sub: isHighLoad ? '⚠ Above threshold' : 'Normal', icon: Cpu, alert: isHighLoad },
        ].map(s => (
          <div
            key={s.label}
            className={cn(
              'glass-panel p-5 rounded-2xl',
              s.alert && 'border-amber-400 bg-amber-50'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <s.icon className={cn('w-4 h-4', s.alert ? 'text-amber-600' : 'text-[#B88719]')} />
              {s.alert && (
                <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-300">
                  High
                </span>
              )}
            </div>
            <div className="text-2xl font-display font-medium text-[#111111]">{s.value}</div>
            <div className="text-[10px] text-[#5A5A5A] font-bold uppercase tracking-widest mt-1">{s.label}</div>
            <div className="text-[9px] text-[#777] mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Latency + Load Chart */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#111111] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#B88719]" />
              Latency & System Load — last 60 min
            </h3>
            <p className="text-[10px] text-[#777] mt-0.5">Dashed line = 500ms latency alert threshold</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-[#5A5A5A] font-bold shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#B88719] inline-block rounded" />
              Latency (ms)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-red-500 inline-block rounded" />
              Load (%)
            </span>
          </div>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CHART_DATA} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#B88719" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#B88719" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8DFC8" />
              <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fill: '#777', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#777', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #BFA66A', borderRadius: '8px', fontSize: '11px' }}
                itemStyle={{ color: '#111111' }}
              />
              <ReferenceLine y={500} stroke="#B88719" strokeDasharray="5 4" strokeOpacity={0.45} />
              <Area type="monotone" dataKey="latency" stroke="#B88719" strokeWidth={2}   fillOpacity={1} fill="url(#latGrad)"  name="Latency (ms)" />
              <Area type="monotone" dataKey="load"    stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#loadGrad)" name="Load (%)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Query Log Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#FDFAF2] border-b border-[#E8DFC8] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h3 className="text-sm font-bold text-[#111111] flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#B88719]" />
            AI Query Log
          </h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#777]" />
            <input
              type="text"
              placeholder="Search queries..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white border border-[#BFA66A] pl-8 pr-4 py-1.5 rounded-lg text-[11px] w-full sm:w-52 focus:outline-none focus:border-[#8A5A00] font-mono transition-colors"
            />
          </div>
        </div>

        {/* Desktop */}
        <table className="hidden lg:table w-full text-left">
          <thead className="bg-[#FDFAF2] border-b border-[#E8DFC8] text-[10px] font-bold text-[#777] uppercase tracking-[0.1em]">
            <tr>
              <th className="px-5 py-3">Time</th>
              <th className="px-4 py-3">User Query</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3 text-right">Latency</th>
              <th className="px-4 py-3 text-right">Tokens</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-5 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0E8D4]">
            {filtered.map(log => {
              const sc = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG];
              return (
                <tr
                  key={log.id}
                  onClick={() => { setSelectedLog(log); setActiveTab('OVERVIEW'); }}
                  className="group hover:bg-[#FFF9E8] transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5 text-[10px] font-mono text-[#777] whitespace-nowrap">{log.timestamp}</td>
                  <td className="px-4 py-3.5 max-w-xs">
                    <div className="text-xs font-medium text-[#111111] truncate">{log.query}</div>
                    <div className="text-[9px] text-[#777] font-mono mt-0.5">{log.id} · {log.user}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 bg-[#F4E8C3] border border-[#BFA66A] rounded text-[9px] font-bold text-[#5A5A5A] whitespace-nowrap">
                      {log.model}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={cn('text-xs font-mono font-bold', log.latency > 500 ? 'text-amber-600' : 'text-[#5A5A5A]')}>
                      {log.latencyStr}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[11px] font-mono text-[#777]">
                    {log.tokens || '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border', sc.bg, sc.color)}>
                      <sc.icon className="w-3 h-3" />
                      {log.status}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <button className="p-1.5 rounded-lg hover:bg-[#F4E8C3] opacity-0 group-hover:opacity-100 transition-all">
                      <Maximize2 className="w-3.5 h-3.5 text-[#B88719]" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile */}
        <div className="lg:hidden divide-y divide-[#F0E8D4]">
          {filtered.map(log => {
            const sc = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG];
            return (
              <div
                key={log.id}
                onClick={() => { setSelectedLog(log); setActiveTab('OVERVIEW'); }}
                className="p-4 space-y-2 hover:bg-[#FFF9E8] cursor-pointer"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="text-xs font-medium text-[#111111] leading-snug flex-1 min-w-0 truncate">
                    {log.query}
                  </div>
                  <div className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0', sc.bg, sc.color)}>
                    {log.status}
                  </div>
                </div>
                <div className="flex gap-3 text-[10px] font-mono text-[#777]">
                  <span>{log.timestamp}</span>
                  <span className={cn(log.latency > 500 ? 'text-amber-600 font-bold' : '')}>{log.latencyStr}</span>
                  <span>{log.tokens ? `${log.tokens} tok` : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Log ${selectedLog?.id ?? ''}`}
        subtitle={selectedLog ? (selectedLog.query.length > 55 ? selectedLog.query.slice(0, 55) + '…' : selectedLog.query) : ''}
        size="lg"
        tabs={DRAWER_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div className="p-6 space-y-5">

          {/* Overview Tab */}
          {activeTab === 'OVERVIEW' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Latency',  val: selectedLog?.latencyStr,      icon: Clock      },
                  { label: 'Tokens',   val: selectedLog?.tokens || '—',   icon: Cpu        },
                  { label: 'Model',    val: selectedLog?.model,            icon: Brain      },
                  { label: 'Status',   val: selectedLog?.status,           icon: ShieldCheck },
                ].map(s => (
                  <div key={s.label} className="p-4 bg-[#FDFAF2] border border-[#E8DFC8] rounded-xl">
                    <s.icon className="w-3.5 h-3.5 text-[#B88719] mb-2" />
                    <div className="text-base font-display font-bold text-[#111111]">{s.val}</div>
                    <div className="text-[9px] text-[#777] mt-0.5 uppercase font-bold tracking-widest">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-[#FDFAF2] border border-[#E8DFC8] rounded-xl">
                <div className="text-[10px] font-bold text-[#777] uppercase tracking-widest mb-2">User Query</div>
                <p className="text-sm text-[#111111] leading-relaxed">{selectedLog?.query}</p>
                <div className="text-[9px] font-mono text-[#777] mt-2">
                  {selectedLog?.id} · {selectedLog?.user} · {selectedLog?.timestamp}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold text-[#777] uppercase tracking-widest mb-1">Pipeline Trace</div>
                {[
                  { step: '01', label: 'Auth Gateway',       dur: '12ms',               ok: true },
                  { step: '02', label: 'Semantic Retrieval', dur: '184ms',              ok: true },
                  { step: '03', label: 'Graph Merge',        dur: '24ms',               ok: true },
                  { step: '04', label: 'Inference',          dur: selectedLog?.latencyStr ?? '—', ok: selectedLog?.status === 'OK' },
                ].map(s => (
                  <div
                    key={s.step}
                    className="flex items-center justify-between px-4 py-2.5 bg-white border border-[#E8DFC8] rounded-xl hover:border-[#BFA66A] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-[#B88719] font-mono w-5">{s.step}</span>
                      <span className="text-xs font-medium text-[#111111]">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-[#5A5A5A]">{s.dur}</span>
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full border',
                        s.ok
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      )}>
                        {s.ok ? 'OK' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* AI Trace Tab */}
          {activeTab === 'REASONING' && (
            <div className="space-y-4">
              <div className="p-5 bg-[#111111] border border-[#2a2a2a] rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-4 h-4 text-[#D9B86C]" />
                  <h4 className="text-sm font-bold text-white italic">AI Reasoning Trace</h4>
                </div>
                <div className="space-y-2 font-mono text-[11px] text-[#aaa] leading-relaxed">
                  <p className="text-[9px] text-[#555] uppercase font-black border-b border-white/10 pb-2">Internal Monologue:</p>
                  <p>1. Parsing intent: "{selectedLog?.query.slice(0, 45)}…"</p>
                  <p>2. Fetching relevant knowledge nodes from graph.</p>
                  <p>3. Applying regional context and trust heuristics.</p>
                  <p>4. Composing response with safety guardrail pass.</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-[#777] uppercase tracking-widest">Safety Guardrails</div>
                {['Hate / Toxicity', 'PII Disclosure', 'Data Exfiltration'].map(g => (
                  <div
                    key={g}
                    className="flex justify-between items-center px-4 py-2.5 bg-[#FDFAF2] border border-[#E8DFC8] rounded-xl text-xs"
                  >
                    <span className="text-[#5A5A5A]">{g}</span>
                    <span className="text-emerald-700 font-bold">PASS</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Payload Tab */}
          {activeTab === 'PAYLOAD' && (
            <div className="space-y-3">
              <div className="p-5 bg-[#111111] rounded-xl border border-[#2a2a2a] font-mono text-[11px] overflow-auto max-h-96">
                <pre className="text-[#D9B86C] leading-relaxed">
                  {JSON.stringify({
                    id:         selectedLog?.id,
                    timestamp:  selectedLog?.timestamp,
                    user:       selectedLog?.user,
                    model:      selectedLog?.model,
                    query:      selectedLog?.query,
                    latency_ms: selectedLog?.latency,
                    tokens:     selectedLog?.tokens,
                    status:     selectedLog?.status,
                  }, null, 2)}
                </pre>
              </div>
              <button className="w-full py-2.5 bg-white border border-[#BFA66A] rounded-xl text-[11px] font-bold text-[#5A5A5A] hover:bg-[#FFF9E8] hover:text-[#111111] transition-all flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Export JSON
              </button>
            </div>
          )}

        </div>
      </DetailDrawer>
    </div>
  );
};
