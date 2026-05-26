import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Rocket, History, RotateCcw, CheckCircle2, XCircle,
  Clock, Search, AlertTriangle, Activity
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppState } from '../AppStateContext';
import { MOCK_DEPLOYMENTS } from '../constants/deploymentMock';

type Tab = 'DEPLOYMENTS' | 'HISTORY' | 'ROLLBACK';

const RELEASE_HISTORY = [
  { id: 'REL-2841', name: 'GlobalCorp_Agent v2.5',      env: 'PROD',    status: 'SUCCESS',     by: 'longth',  at: '2026-05-25 14:22', duration: '4m 12s', version: 'v2.5.0' },
  { id: 'REL-2840', name: 'refund_policy_index v3.1',   env: 'PROD',    status: 'SUCCESS',     by: 'nguyenk', at: '2026-05-24 09:45', duration: '1m 58s', version: 'v3.1.0' },
  { id: 'REL-2839', name: 'onboarding_workflow v1.8',   env: 'UAT',     status: 'FAILED',      by: 'thaon',   at: '2026-05-23 16:30', duration: '2m 11s', version: 'v1.8.0' },
  { id: 'REL-2838', name: 'GlobalCorp_Agent v2.4',      env: 'PROD',    status: 'ROLLED_BACK', by: 'longth',  at: '2026-05-22 11:15', duration: '6m 40s', version: 'v2.4.0' },
  { id: 'REL-2837', name: 'pricing_engine v1.2',        env: 'STAGING', status: 'SUCCESS',     by: 'minhp',   at: '2026-05-21 13:00', duration: '3m 22s', version: 'v1.2.0' },
  { id: 'REL-2836', name: 'auth_policy v4.0',           env: 'PROD',    status: 'SUCCESS',     by: 'longth',  at: '2026-05-20 08:55', duration: '2m 05s', version: 'v4.0.0' },
];

const ROLLBACK_TARGETS = [
  { id: 'REL-2841', name: 'GlobalCorp_Agent',     current: 'v2.5.0', previous: 'v2.4.0', env: 'PROD'    },
  { id: 'REL-2840', name: 'refund_policy_index',  current: 'v3.1.0', previous: 'v3.0.2', env: 'PROD'    },
  { id: 'REL-2837', name: 'pricing_engine',       current: 'v1.2.0', previous: 'v1.1.5', env: 'STAGING' },
];

const HISTORY_STATUS: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  SUCCESS:     { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  FAILED:      { color: 'text-red-700',     bg: 'bg-red-50 border-red-200',         icon: XCircle      },
  ROLLED_BACK: { color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',       icon: RotateCcw    },
};

const DEPLOY_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  SUCCESS:          { label: 'Success',     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200'  },
  FAILED:           { label: 'Failed',      color: 'text-red-700',     bg: 'bg-red-50 border-red-200'          },
  VALIDATING:       { label: 'Validating',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200'      },
  PROMOTING:        { label: 'Promoting',   color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200'      },
  BUILDING:         { label: 'Building',    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200'        },
  WAITING_APPROVAL: { label: 'Approval',    color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200'    },
  ROLLED_BACK:      { label: 'Rolled Back', color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200'      },
  QUEUED:           { label: 'Queued',      color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200'      },
};

const ReleaseManagementCenter = () => {
  const { subTab, setSubTab }       = useAppState();
  const [search, setSearch]         = useState('');
  const [confirmId, setConfirmId]   = useState<string | null>(null);

  const activeTab    = (subTab['release-management'] as Tab) ?? 'DEPLOYMENTS';
  const setActiveTab = (id: Tab) => setSubTab('release-management', id);

  const tabs = [
    { id: 'DEPLOYMENTS', label: 'Deployments',    icon: Rocket   },
    { id: 'HISTORY',     label: 'Release History', icon: History  },
    { id: 'ROLLBACK',    label: 'Rollback Center', icon: RotateCcw },
  ];

  const activeCount      = MOCK_DEPLOYMENTS.filter(d =>
    ['BUILDING', 'VALIDATING', 'PROMOTING', 'WAITING_APPROVAL'].includes(d.status)
  ).length;

  const filteredHistory  = RELEASE_HISTORY.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[#B88719] text-[10px] font-bold font-mono tracking-widest uppercase mb-2">
          <Rocket className="w-3.5 h-3.5" />
          Control Plane · Release
        </div>
        <h1 className="text-3xl font-display font-medium tracking-tight text-[#111111]">Release Management</h1>
        <p className="text-[#5A5A5A] mt-1 text-sm">Deployment pipeline, release history, and rollback operations.</p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Deployments', value: String(activeCount), icon: Rocket,       color: 'text-[#B88719]' },
          { label: 'Last Release',       value: '14m ago',           icon: Clock,        color: 'text-blue-600'  },
          { label: 'Success Rate (7d)',  value: '94%',               icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Rollbacks (30d)',    value: '1',                 icon: RotateCcw,    color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="glass-panel p-5 rounded-2xl">
            <s.icon className={cn('w-4 h-4 mb-3', s.color)} />
            <div className="text-2xl font-display font-medium text-[#111111]">{s.value}</div>
            <div className="text-[10px] text-[#5A5A5A] font-bold uppercase tracking-widest mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="sub-tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn('sub-tab', activeTab === tab.id && 'active')}
          >
            <tab.icon className="tab-icon w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >

        {/* ── DEPLOYMENTS ─────────────────────────────────── */}
        {activeTab === 'DEPLOYMENTS' && (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#FDFAF2] border-b border-[#E8DFC8] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111111] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#B88719]" />
                Active & Recent Deployments
              </h3>
              <span className="text-[10px] font-mono text-[#777]">{activeCount} active</span>
            </div>

            {/* Desktop */}
            <table className="hidden lg:table w-full text-left">
              <thead className="bg-[#FDFAF2] border-b border-[#E8DFC8] text-[10px] font-bold text-[#777] uppercase tracking-[0.1em]">
                <tr>
                  <th className="px-5 py-3">Package</th>
                  <th className="px-4 py-3">Env</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3 text-center">Risk</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E8D4]">
                {MOCK_DEPLOYMENTS.map(dep => {
                  const sc = DEPLOY_STATUS[dep.status] ?? DEPLOY_STATUS['QUEUED'];
                  return (
                    <tr key={dep.id} className="hover:bg-[#FFF9E8] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="text-xs font-bold text-[#111111] uppercase">{dep.name}</div>
                        <div className="text-[9px] font-mono text-[#777] mt-0.5">{dep.id} · {dep.version}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 bg-[#F4E8C3] border border-[#BFA66A] rounded text-[9px] font-bold text-[#5A5A5A]">
                          {dep.env}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] font-mono text-[#5A5A5A]">{dep.owner}</td>
                      <td className="px-4 py-3.5 text-[10px] font-mono text-[#777]">{dep.startedAt}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn('text-xs font-bold', dep.riskScore > 30 ? 'text-red-600' : 'text-emerald-600')}>
                          {dep.riskScore}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', sc.bg, sc.color)}>
                          {sc.label}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-[#F0E8D4]">
              {MOCK_DEPLOYMENTS.map(dep => {
                const sc = DEPLOY_STATUS[dep.status] ?? DEPLOY_STATUS['QUEUED'];
                return (
                  <div key={dep.id} className="p-4 space-y-2 hover:bg-[#FFF9E8]">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-[#111111] uppercase">{dep.name}</div>
                        <div className="text-[9px] font-mono text-[#777]">{dep.id}</div>
                      </div>
                      <div className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border', sc.bg, sc.color)}>
                        {sc.label}
                      </div>
                    </div>
                    <div className="flex gap-3 text-[10px] font-mono text-[#777]">
                      <span>{dep.env}</span>
                      <span>{dep.owner}</span>
                      <span>{dep.startedAt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HISTORY ─────────────────────────────────────── */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#777]" />
                <input
                  type="text"
                  placeholder="Search releases..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-white border border-[#BFA66A] pl-8 pr-4 py-1.5 rounded-lg text-[11px] w-52 focus:outline-none focus:border-[#8A5A00] font-mono transition-colors"
                />
              </div>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden">
              {/* Desktop */}
              <table className="hidden lg:table w-full text-left">
                <thead className="bg-[#FDFAF2] border-b border-[#E8DFC8] text-[10px] font-bold text-[#777] uppercase tracking-[0.1em]">
                  <tr>
                    <th className="px-5 py-3">Release</th>
                    <th className="px-4 py-3">Env</th>
                    <th className="px-4 py-3">By</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E8D4]">
                  {filteredHistory.map(r => {
                    const sc = HISTORY_STATUS[r.status] ?? HISTORY_STATUS['SUCCESS'];
                    const Icon = sc.icon;
                    return (
                      <tr key={r.id} className="hover:bg-[#FFF9E8] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="text-xs font-bold text-[#111111] uppercase">{r.name}</div>
                          <div className="text-[9px] font-mono text-[#777] mt-0.5">{r.id} · {r.version}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 bg-[#F4E8C3] border border-[#BFA66A] rounded text-[9px] font-bold text-[#5A5A5A]">
                            {r.env}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[11px] font-mono text-[#5A5A5A]">{r.by}</td>
                        <td className="px-4 py-3.5 text-[10px] font-mono text-[#777]">{r.at}</td>
                        <td className="px-4 py-3.5 text-[10px] font-mono text-[#777]">{r.duration}</td>
                        <td className="px-4 py-3.5">
                          <div className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border', sc.bg, sc.color)}>
                            <Icon className="w-3 h-3" />
                            {r.status.replace('_', ' ')}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile */}
              <div className="lg:hidden divide-y divide-[#F0E8D4]">
                {filteredHistory.map(r => {
                  const sc = HISTORY_STATUS[r.status] ?? HISTORY_STATUS['SUCCESS'];
                  return (
                    <div key={r.id} className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-bold text-[#111111]">{r.name}</div>
                          <div className="text-[9px] font-mono text-[#777]">{r.id} · {r.version}</div>
                        </div>
                        <div className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border', sc.bg, sc.color)}>
                          {r.status}
                        </div>
                      </div>
                      <div className="flex gap-3 text-[10px] font-mono text-[#777]">
                        <span>{r.env}</span>
                        <span>{r.by}</span>
                        <span>{r.at}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── ROLLBACK ─────────────────────────────────────── */}
        {activeTab === 'ROLLBACK' && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#5A5A5A] leading-relaxed">
                Rollback uses a{' '}
                <span className="font-bold text-[#111111]">compensating transaction pattern</span>.
                If any step fails, the operation halts and records{' '}
                <code className="bg-amber-100 border border-amber-200 px-1 rounded font-mono text-amber-700 text-[10px]">
                  PARTIAL_ROLLBACK
                </code>{' '}
                — the release manager is notified immediately.
              </p>
            </div>

            {/* Rollback targets */}
            <div className="space-y-3">
              {ROLLBACK_TARGETS.map(target => (
                <div key={target.id} className="glass-panel p-5 rounded-2xl flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#111111] uppercase">{target.name}</div>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono">
                      <span className="text-[#B88719] font-bold">{target.current}</span>
                      <span className="text-[#777]">→ revert to</span>
                      <span className="text-[#5A5A5A]">{target.previous}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-[#F4E8C3] border border-[#BFA66A] rounded text-[9px] font-bold text-[#5A5A5A] shrink-0">
                    {target.env}
                  </span>
                  <button
                    onClick={() => setConfirmId(confirmId === target.id ? null : target.id)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all shrink-0',
                      confirmId === target.id
                        ? 'bg-amber-500 text-white border border-amber-600 shadow-md'
                        : 'bg-white border border-[#BFA66A] text-[#5A5A5A] hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50'
                    )}
                  >
                    {confirmId === target.id ? 'Confirm?' : 'Rollback'}
                  </button>
                </div>
              ))}
            </div>

            {/* Rollback procedure */}
            <div className="glass-panel p-5 rounded-2xl">
              <h4 className="text-[10px] font-black text-[#777] uppercase tracking-widest mb-4">
                Rollback Procedure
              </h4>
              <div className="space-y-2">
                {[
                  { step: '01', label: 'Revert PostgreSQL release pointer', sub: 'Update version reference to previous release' },
                  { step: '02', label: 'Restore Kong upstream route',       sub: 'Re-route traffic to previous deployment'      },
                  { step: '03', label: 'Redeploy artifact from MinIO',      sub: 'Restore immutable version snapshot'           },
                ].map(s => (
                  <div
                    key={s.step}
                    className="flex items-center gap-4 px-4 py-3 bg-[#FDFAF2] border border-[#E8DFC8] rounded-xl"
                  >
                    <span className="text-[10px] font-black text-[#B88719] font-mono w-6 shrink-0">{s.step}</span>
                    <div>
                      <div className="text-[11px] font-bold text-[#111111]">{s.label}</div>
                      <div className="text-[9px] text-[#777] mt-0.5">{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
};

export default ReleaseManagementCenter;
