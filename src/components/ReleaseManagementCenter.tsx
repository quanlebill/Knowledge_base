import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, GitBranch, ShieldCheck, History, Search, Filter, Plus, Ship, Rocket, RefreshCcw, AlertTriangle, Package, Settings2, CheckCircle2, XCircle, Database, Lock, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';
import { DeploymentOverview as DeploymentCenter } from './DeploymentCenter/Overview';
import { DetailDrawer } from './shared/DetailDrawer';

import { useAppState } from '../AppStateContext';
import { Placeholder } from './shared/Placeholder';

type ReleaseSubTab = 'OVERVIEW' | 'PIPELINE' | 'PACKAGE' | 'ENV' | 'VALIDATION' | 'ROLLBACK' | 'HISTORY' | 'DRIFT';

const ReleaseManagementCenter = () => {
  const { subTab, setSubTab } = useAppState();
  const activeSubTab = (subTab['release-management'] as ReleaseSubTab) ?? 'PIPELINE';
  const setActiveSubTab = (id: ReleaseSubTab) => setSubTab('release-management', id);

  /* PACKAGE & DRIFT secondary-nav items drive the drawers */
  const showPackageBuilder = activeSubTab === 'PACKAGE';
  const showDriftManager   = activeSubTab === 'DRIFT';
  const setShowPackageBuilder = (v: boolean) => setActiveSubTab(v ? 'PACKAGE' : 'PIPELINE');
  const setShowDriftManager   = (v: boolean) => setActiveSubTab(v ? 'DRIFT' : 'PIPELINE');

  const mainMetrics = [
    { label: 'Active Pipelines', value: '18', trend: 'OPTIMAL', trendType: 'NEUTRAL' as const, icon: Rocket, color: 'brand' as const },
    { label: 'Last Release', value: '14m ago', icon: History, color: 'blue' as const },
    { label: 'Validation Score', value: '98%', trend: '+2%', trendType: 'UP' as const, icon: ShieldCheck, color: 'emerald' as const },
    { label: 'Open Drift Alerts', value: '0', trend: 'SECURE', trendType: 'NEUTRAL' as const, icon: AlertTriangle, color: 'amber' as const },
  ];

  const subTabs = [
    { id: 'OVERVIEW',   label: 'Overview',     icon: GitBranch },
    { id: 'PIPELINE',   label: 'Pipeline',     icon: Rocket },
    { id: 'PACKAGE',    label: 'Package',      icon: Package },
    { id: 'ENV',        label: 'Environments', icon: Settings2 },
    { id: 'VALIDATION', label: 'Validation',   icon: ShieldCheck },
    { id: 'ROLLBACK',   label: 'Rollback',     icon: RefreshCcw },
    { id: 'HISTORY',    label: 'History',      icon: History },
    { id: 'DRIFT',      label: 'Drift',        icon: AlertTriangle },
  ];

  return (
    <div className="space-y-8">
      <DetailDrawer
        isOpen={showPackageBuilder}
        onClose={() => setShowPackageBuilder(false)}
        title="Deployment Package Builder"
        subtitle="Bundle Agent Configs, KB Snapshots & Workflow Logic"
        icon={Package}
        size="wide"
        persistKey="release-package-builder"
      >
        <div className="p-6 space-y-6">
           <div className="drawer-section-card">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#5A5A5A] mb-4">Select Baseline Artifacts</h4>
              <div className="space-y-2">
                 {['GlobalCorp_Agent_v2.4', 'refund_policy_gold_index', 'onboarding_workflow_final'].map(a => (
                   <button key={a} className="w-full flex justify-between items-center px-4 py-3 bg-white rounded-xl border-2 border-[#BFA66A] hover:border-[#8A5A00] hover:bg-[#FFF9E8] cursor-pointer transition-all text-left">
                      <span className="text-sm text-[#111111] font-medium">{a}</span>
                      <Plus className="w-4 h-4 text-[#8A5A00]" />
                   </button>
                 ))}
              </div>
           </div>
           <div className="ai-insight-block">
              <h4 className="insight-label text-xs font-bold uppercase tracking-widest mb-2">Validation Pipeline</h4>
              <p className="insight-body text-sm">Automatic red-teaming will begin upon package assembly.</p>
           </div>
        </div>
      </DetailDrawer>

      <DetailDrawer
        isOpen={showDriftManager}
        onClose={() => setShowDriftManager(false)}
        title="Environment Alignment"
        subtitle="Reconcile Configuration Discrepancies across Infrastructure"
        icon={Settings2}
        size="standard"
        persistKey="release-drift"
      >
        <div className="p-6">
           <div className="space-y-3">
              {[
                { key: 'MODEL_TEMP', prod: '0.7', uat: '0.8', status: 'MISMATCH' },
                { key: 'EMBED_DIM',  prod: '1536', uat: '1536', status: 'MATCH' },
                { key: 'MAX_TOKENS', prod: '4096', uat: '1024', status: 'CRITICAL_DRIFT' },
              ].map(drift => (
                <div key={drift.key} className="drawer-section-card flex items-center justify-between">
                   <div>
                      <div className="text-[11px] font-bold text-[#5A5A5A] uppercase tracking-wide">{drift.key}</div>
                      <div className="flex gap-4 mt-1.5 text-[13px]">
                         <span className="text-[#5A5A5A]">PROD: <span className="text-[#111111] font-bold">{drift.prod}</span></span>
                         <span className="text-[#5A5A5A]">UAT: <span className="text-[#111111] font-bold">{drift.uat}</span></span>
                      </div>
                   </div>
                   <div className={cn(
                     'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                     drift.status === 'MATCH'    ? 'badge-healthy' :
                     drift.status === 'MISMATCH' ? 'badge-warning' : 'badge-failed'
                   )}>{drift.status}</div>
                </div>
              ))}
           </div>
        </div>
      </DetailDrawer>

      <OperationalHeader 
        title="Release Management"
        subtitle="Continuous Deployment, Model Versioning & Automated Model Promotion"
        breadcrumbs={[{ label: 'Release' }, { label: 'Management' }]}
        status={<StatusBadge status="STABLE" size="lg" />}
        actions={
          <div className="flex gap-3">
              <button
                onClick={() => setShowPackageBuilder(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                CREATE RELEASE
              </button>
          </div>
        }
      />

      <StandardMetricsGrid metrics={mainMetrics} />

      {/* Sub-Navigation */}
      <div className="sub-tab-bar max-w-full">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn('sub-tab', activeSubTab === tab.id && 'active')}
          >
            <tab.icon className="tab-icon w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {(activeSubTab === 'OVERVIEW' || activeSubTab === 'PIPELINE') && (
          <DeploymentCenter
            onNewDeployment={() => setShowPackageBuilder(true)}
            onOpenApprovals={() => {}}
            onOpenDrift={() => setShowDriftManager(true)}
          />
        )}
        {activeSubTab === 'ENV' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { env: 'Dev', store: 'PostgreSQL self-hosted', gate: 'Auto-promote when tests pass', secret: '—', color: 'bg-[#E3F2FD]', text: 'text-[#0D47A1]', border: 'border-[#BBDEFB]' },
                { env: 'Staging / UAT', store: 'PostgreSQL self-hosted', gate: 'Manual approval via UI dashboard', secret: '—', color: 'bg-[#FFF3E0]', text: 'text-[#E65100]', border: 'border-[#FFE0B2]' },
                { env: 'Production', store: 'PostgreSQL self-hosted + OpenBao', gate: 'Dual approval + validation score ≥ 95%', secret: 'OpenBao', color: 'bg-[#E8F5E9]', text: 'text-[#1B5E20]', border: 'border-[#C8E6C9]' },
              ].map((e, i) => (
                <div key={i} className={cn('p-5 rounded-2xl border', e.color, e.border)}>
                  <div className={cn('text-lg font-black mb-3', e.text)}>{e.env}</div>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex gap-2"><span className="font-bold text-[#5A5A5A] w-20 shrink-0">Config Store</span><span className="text-[#111111] font-mono">{e.store}</span></div>
                    <div className="flex gap-2"><span className="font-bold text-[#5A5A5A] w-20 shrink-0">Promotion</span><span className="text-[#111111]">{e.gate}</span></div>
                    {e.secret !== '—' && <div className="flex gap-2"><span className="font-bold text-[#5A5A5A] w-20 shrink-0">Secrets</span><span className="text-[#111111]">{e.secret}</span></div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border border-[#E8DFC8] rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-[#B88719]" />
                <h4 className="text-sm font-bold text-[#111111]">Config Store — PostgreSQL self-hosted (all envs)</h4>
              </div>
              <p className="text-[11px] text-[#777]">
                AWS Redis replaced in Dev — Redis loses all data on restart, unsuitable for environment config.
                All environments now use PostgreSQL self-hosted for durable, queryable configuration storage.
              </p>
            </div>

            <div className="p-4 bg-white border border-[#E8DFC8] rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-[#B88719]" />
                <h4 className="text-sm font-bold text-[#111111]">Manual Approval — UI Dashboard</h4>
              </div>
              <p className="text-[11px] text-[#777]">
                Reviewer receives Slack/email notification → opens UI dashboard → reviews config diff → clicks Approve / Reject.
                Kong Admin API is only the backend of the approval flow; approval actions are driven from the dashboard UI.
              </p>
            </div>
          </div>
        )}
        {activeSubTab === 'VALIDATION' && (
          <div className="space-y-6">
            <div className="p-4 bg-[#FDFAF2] border border-[#E8DFC8] rounded-2xl">
              <h4 className="text-sm font-bold text-[#111111] mb-1">Security Gate — runs before every promote</h4>
              <p className="text-[11px] text-[#777]">All three scans must pass before artifact is promoted to Staging or Production. Results stored in MongoDB package manifest.</p>
            </div>

            <div className="space-y-3">
              {[
                { tool: 'Trivy', type: 'Container image CVE scan', fail: 'Any critical/high CVE', status: 'PASS', color: 'emerald' },
                { tool: 'Bandit', type: 'SAST — Python source code', fail: 'High severity issue', status: 'PASS', color: 'emerald' },
                { tool: 'pip-audit', type: 'Dependency vulnerability', fail: 'Known CVE in dependencies', status: 'PASS', color: 'emerald' },
              ].map((scan, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white border border-[#E8DFC8] rounded-2xl">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-[#111111]">{scan.tool} <span className="text-[10px] font-normal text-[#777]">— {scan.type}</span></div>
                      <div className="text-[10px] text-[#999]">Fail condition: {scan.fail}</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{scan.status}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border border-[#E8DFC8] rounded-2xl">
              <h4 className="text-sm font-bold text-[#111111] mb-3">Pipeline Flow</h4>
              <div className="flex flex-col gap-1 text-[11px] font-mono text-[#555]">
                {['Build artifact', 'Security Scan (Trivy + Bandit + pip-audit)', 'FAIL → Pipeline blocked, alert team', 'PASS → Scan result written to Package manifest (MongoDB)', 'Promote to Staging / Production'].map((step, i) => (
                  <div key={i} className={cn('px-3 py-1.5 rounded-lg', i === 2 ? 'bg-red-50 text-red-700' : i === 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F8F5EC]')}>{step}</div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeSubTab === 'ROLLBACK' && (
          <div className="space-y-6">
            <div className="p-4 bg-[#FDFAF2] border border-[#E8DFC8] rounded-2xl">
              <h4 className="text-sm font-bold text-[#111111] mb-1">Compensating Transaction Pattern</h4>
              <p className="text-[11px] text-[#777]">Each rollback step has an undo action. If any step fails, rollback stops immediately and records <code className="font-mono bg-[#F4E8C3] px-1 rounded">PARTIAL_ROLLBACK</code> state — never leaves system in inconsistent state.</p>
            </div>

            <div className="border border-[#E8DFC8] rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FDFAF2] border-b border-[#E8DFC8]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#777] uppercase tracking-wide">Step</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#777] uppercase tracking-wide">Action</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#777] uppercase tracking-wide">Compensating Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E8D4]">
                  {[
                    { step: 1, action: 'Update release pointer — PostgreSQL', undo: 'Revert pointer to previous version' },
                    { step: 2, action: 'Reroute Kong upstream', undo: 'Restore Kong route to previous upstream' },
                    { step: 3, action: 'Redeploy snapshot from MinIO', undo: '—' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-[#FDFAF2]">
                      <td className="px-4 py-3 text-xs font-black text-[#B88719]">{row.step}</td>
                      <td className="px-4 py-3 text-xs text-[#111111]">{row.action}</td>
                      <td className="px-4 py-3 text-xs text-[#777] font-mono">{row.undo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-[#E8DFC8] rounded-2xl">
                <div className="text-sm font-bold text-[#111111] mb-1">Storage</div>
                <div className="text-[11px] text-[#777]">Immutable snapshots in MinIO (version-tagged). Release pointer tracked in PostgreSQL.</div>
              </div>
              <div className="p-4 bg-white border border-[#E8DFC8] rounded-2xl">
                <div className="text-sm font-bold text-[#111111] mb-1">On Partial Failure</div>
                <div className="text-[11px] text-[#777]">Halt immediately → write <code className="font-mono bg-[#F4E8C3] px-1 rounded">PARTIAL_ROLLBACK</code> to PostgreSQL → send alert to Release Manager.</div>
              </div>
            </div>
          </div>
        )}
        {activeSubTab === 'HISTORY' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Primary Store', value: 'PostgreSQL (self-hosted)', sub: 'Structured, queryable, immutable rows' },
                { label: 'Full-text Search', value: 'Elasticsearch', sub: 'Filter by env, status, agent, date' },
                { label: 'Archival', value: 'Records > 12 months → MinIO/S3', sub: 'Cold storage, query performance preserved' },
              ].map((c, i) => (
                <div key={i} className="p-4 bg-white border border-[#E8DFC8] rounded-2xl">
                  <div className="text-[10px] font-bold text-[#777] uppercase tracking-wide mb-1">{c.label}</div>
                  <div className="text-sm font-bold text-[#111111]">{c.value}</div>
                  <div className="text-[10px] text-[#777] mt-0.5">{c.sub}</div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border border-[#E8DFC8] rounded-2xl">
              <h4 className="text-sm font-bold text-[#111111] mb-3">PostgreSQL Table Partitioning</h4>
              <pre className="p-3 bg-[#111111] text-[#D9B86C] rounded-xl text-[10px] font-mono leading-relaxed overflow-x-auto">{`CREATE TABLE audit_log (
  id          BIGSERIAL,
  event_time  TIMESTAMPTZ NOT NULL,
  event_type  TEXT,
  user_id     TEXT,
  payload     JSONB
) PARTITION BY RANGE (event_time);

-- New partition each month
CREATE TABLE audit_log_2026_05
  PARTITION OF audit_log
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');`}</pre>
              <p className="text-[10px] text-[#777] mt-2">Partition by month (RANGE). Records older than 12 months archived to MinIO/S3 cold storage. Keeps query performance at scale.</p>
            </div>
          </div>
        )}
        {activeSubTab === 'DRIFT' && (
          <div className="space-y-6">
            <div className="space-y-3">
              {[
                { key: 'MODEL_TEMP', prod: '0.7', uat: '0.8', status: 'MISMATCH' },
                { key: 'EMBED_DIM',  prod: '1536', uat: '1536', status: 'MATCH' },
                { key: 'MAX_TOKENS', prod: '4096', uat: '1024', status: 'CRITICAL_DRIFT' },
              ].map(drift => (
                <div key={drift.key} className="flex items-center justify-between p-4 bg-white border border-[#E8DFC8] rounded-2xl">
                  <div>
                    <div className="text-[11px] font-bold text-[#5A5A5A] uppercase tracking-wide">{drift.key}</div>
                    <div className="flex gap-4 mt-1.5 text-[13px]">
                      <span className="text-[#5A5A5A]">PROD: <span className="text-[#111111] font-bold">{drift.prod}</span></span>
                      <span className="text-[#5A5A5A]">UAT: <span className="text-[#111111] font-bold">{drift.uat}</span></span>
                    </div>
                  </div>
                  <div className={cn(
                    'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                    drift.status === 'MATCH'    ? 'badge-healthy' :
                    drift.status === 'MISMATCH' ? 'badge-warning' : 'badge-failed',
                  )}>{drift.status}</div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border border-[#E8DFC8] rounded-2xl">
              <h4 className="text-sm font-bold text-[#111111] mb-3">Drift Action Plan</h4>
              <div className="space-y-2">
                {[
                  { step: '1', label: 'Alert', desc: 'release.drift.detected → Notification Service → Slack/email to Lead Dev + Release Manager' },
                  { step: '2', label: 'Block', desc: 'Auto-promotion to Production blocked until drift is resolved' },
                  { step: '3', label: 'Resolve', desc: 'Reviewer confirms diff is intentional → approve, or triggers sync from UAT snapshot' },
                ].map((s, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-[#FDFAF2] rounded-xl border border-[#E8DFC8]">
                    <div className="w-6 h-6 rounded-full bg-[#F4E8C3] border border-[#BFA66A] flex items-center justify-center text-xs font-black text-[#8A5A00] shrink-0">{s.step}</div>
                    <div>
                      <span className="text-xs font-bold text-[#111111]">{s.label} — </span>
                      <span className="text-[11px] text-[#777]">{s.desc}</span>
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
