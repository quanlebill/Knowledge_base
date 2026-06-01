import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User, 
  Activity, 
  ArrowRight,
  ChevronRight,
  Scale,
  GitBranch,
  Shield,
  FileText,
  History,
  MoreVertical,
  Zap,
  Info,
  BarChart2,
  Code2
} from 'lucide-react';
import { DataTable } from './shared/DataTable';
import { StatusBadge } from './shared/StatusBadge';
import { DetailDrawer } from './shared/DetailDrawer';
import { cn } from '../lib/utils';
import { useAppState } from '../AppStateContext';

const POLICIES = [
  { id: 'POL-001', name: 'PII Redaction Policy', scope: 'Global', status: 'ACTIVE', lastUpdated: '2h ago', risk: 'HIGH', coverage: '98%', enforcedOn: 'Cloud Fleet A' },
  { id: 'POL-002', name: 'Model Hallucination Guard', scope: 'Production', status: 'ACTIVE', lastUpdated: '1d ago', risk: 'CRITICAL', coverage: '100%', enforcedOn: 'Inference Engine' },
  { id: 'POL-003', name: 'Cross-Tenant Isolation', scope: 'Network', status: 'ACTIVE', lastUpdated: '5d ago', risk: 'CRITICAL', coverage: '100%', enforcedOn: 'Gateway Proxy' },
  { id: 'POL-004', name: 'API Rate Limiting', scope: 'Regional', status: 'MONITORING', lastUpdated: '4h ago', risk: 'LOW', coverage: 'N/A', enforcedOn: 'Public API' },
];

export const GovernanceView = () => {
  const { isExpertMode } = useAppState();
  const [selectedPolicy, setSelectedPolicy] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('OVERVIEW');

  const columns = [
    { header: 'Policy ID', accessor: 'id' as const, className: 'font-mono text-slate-500 text-[10px]' },
    { header: 'Policy Name', accessor: (p: any) => (
      <div className="flex flex-col">
        <span className="font-bold text-white uppercase italic text-xs tracking-tight">{p.name}</span>
        <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">SCOPE: {p.scope}</span>
      </div>
    ) },
    { header: 'Compliance Target', accessor: (p: any) => (
      <span className="text-[10px] font-mono text-slate-400">{p.enforcedOn}</span>
    )},
    { header: 'Health', accessor: (p: any) => (
       <div className="flex items-center gap-2">
         <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
           <div className={cn("h-full", p.status === 'ACTIVE' ? 'bg-green-500' : 'bg-amber-500')} style={{ width: p.coverage === 'N/A' ? '0%' : p.coverage }} />
         </div>
         <span className="text-[10px] font-mono text-slate-500">{p.coverage === 'N/A' ? '-' : p.coverage}</span>
       </div>
    )},
    { header: 'Status', accessor: (p: any) => <StatusBadge status={p.status} /> },
    { header: 'Evaluated', accessor: 'lastUpdated' as const, className: 'text-[10px]' },
    { header: '', accessor: (p: any) => (
      <button 
        onClick={() => setSelectedPolicy(p)}
        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-8 bg-brand-500/5 border border-brand-500/10 rounded-[32px] space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-brand-500/10 rounded-2xl border border-brand-500/20">
               <ShieldCheck className="w-6 h-6 text-brand-400" />
             </div>
             <div>
                <h3 className="text-xl font-bold text-white uppercase italic tracking-tight">Active Guardians</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Semantic policy enforcement engine is active</p>
             </div>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            All AI interactions are currently being routed through the <b>Guardian-X</b> policy layer. 
            0 PII leaks detected in the last 24 hours.
          </p>
        </div>

        <div className="p-8 bg-amber-500/5 border border-amber-500/10 rounded-[32px] space-y-4">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
               <AlertCircle className="w-6 h-6 text-amber-400" />
             </div>
             <div>
                <h3 className="text-xl font-bold text-white uppercase italic tracking-tight">Compliance Drift</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">3 policies requiring review for SOC 2 Type II</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-amber-500 text-amber-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-colors">Apply Auto-Remediation</button>
            <button className="px-4 py-2 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-colors">View Drift Report</button>
          </div>
        </div>
      </div>

      <DataTable 
        title="Policy Registry"
        subtitle="Active governance templates and enforcement rules"
        data={POLICIES}
        columns={columns}
      />

      <DetailDrawer
        isOpen={!!selectedPolicy}
        onClose={() => setSelectedPolicy(null)}
        title={`Policy Detail: ${selectedPolicy?.name}`}
        subtitle={`${selectedPolicy?.id} • SECURED BY GUARDIAN-X`}
        size="lg"
        tabs={[
          { id: 'OVERVIEW', label: 'Definition', icon: FileText },
          { id: 'IMPACT', label: 'Impact Audit', icon: Activity },
          { id: 'LINEAGE', label: 'Policy Lineage', icon: GitBranch },
          { id: 'RBAC', label: 'Permission Matrix', icon: Lock },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div className="p-8 space-y-8 overflow-y-auto h-full no-scrollbar">
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 {[
                   { label: 'Risk Factor', val: selectedPolicy?.risk, icon: Shield, color: 'text-red-400' },
                   { label: 'Evaluation Rate', val: '1.2M/day', icon: Activity, color: 'text-brand-400' },
                   { label: 'Coverage', val: selectedPolicy?.coverage, icon: BarChart2, color: 'text-green-400' },
                   { label: 'Conflicts', val: '0', icon: Scale, color: 'text-slate-400' },
                 ].map((stat, i) => (
                   <div key={i} className="p-5 bg-white/5 border border-white/5 rounded-3xl">
                      <div className="flex items-center gap-2 mb-3 tracking-widest">
                        <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                        <span className="text-[9px] font-black text-slate-500 uppercase">{stat.label}</span>
                      </div>
                      <div className="text-lg font-display font-bold text-white">{stat.val}</div>
                   </div>
                 ))}
              </div>

              <div className="p-8 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 blur-[50px]" />
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Info className="w-4 h-4 text-brand-400" />
                  Semantic Definition
                </h4>
                <div className="font-mono text-sm text-slate-300 leading-relaxed bg-black/40 p-6 rounded-2xl border border-white/5">
                  <span className="text-brand-400">POLICY</span> {selectedPolicy?.id} <br/>
                  <span className="text-slate-600">-- ENFORCEMENT_MODE: BLOCK --</span> <br/><br/>
                  MATCH metadata.classification == "PII" <br/>
                  THEN APPLY <span className="text-purple-400">MASK_DYNAMIC</span> <br/>
                  WHERE actor_clearance {"<"} "LEVEL_4" <br/><br/>
                  LOG "PII_REDACTION_TRIGGERED" TO SECURITY_AUDIT
                </div>
              </div>

              {isExpertMode && (
                <div className="p-6 bg-slate-900 border border-white/5 rounded-3xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Raw Kubernetes Manifest</span>
                    <Code2 className="w-4 h-4 text-slate-500" />
                  </div>
                  <pre className="text-[9px] font-mono text-slate-400 leading-tight">
                    {`kind: GuardianPolicy
metadata:
  name: ${selectedPolicy?.id.toLowerCase()}
  tenant: enterprise-prod
spec:
  priority: 100
  interceptMode: preemptive
  resources: ["*"]`}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'IMPACT' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="p-8 bg-brand-500/5 border border-brand-500/10 rounded-[3rem]">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                  <Activity className="w-4 h-4 text-brand-400" />
                  Real-time Interception Trace
                </h4>
                <div className="space-y-3">
                  {[
                    { t: '12:04:22', msg: 'Intercepted user query (u_248)... no policy violation.', status: 'ALLOW' },
                    { t: '12:04:10', msg: 'Redacted phone number (XXX-XXX-1234) in retrieval response.', status: 'REDACT' },
                    { t: '11:58:33', msg: 'Policy re-evaluated after git commit e4a2b1...', status: 'RELOAD' },
                  ].map((log, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl text-xs">
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-mono text-slate-500">{log.t}</span>
                        <span className="text-slate-300 italic">{log.msg}</span>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                        log.status === 'ALLOW' ? 'text-green-500' : log.status === 'REDACT' ? 'text-amber-500' : 'text-blue-500'
                      )}>{log.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'RBAC' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="glass-panel p-8 rounded-[3rem] border-white/5 bg-white/[0.01]">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-3 font-mono">
                  <Lock className="w-4 h-4 text-purple-400" />
                  Privilege Matrix for {selectedPolicy?.name}
                </h4>
                <div className="space-y-4">
                  {[
                    { role: 'Platform Admin', permissions: ['Grant', 'Revoke', 'Create', 'Bypass'], color: 'text-purple-400' },
                    { role: 'AI Engineer', permissions: ['Modify', 'Test', 'Observe'], color: 'text-blue-400' },
                    { role: 'Security Auditor', permissions: ['Read', 'Export Trace'], color: 'text-amber-400' },
                    { role: 'Business Operator', permissions: ['Request Approval'], color: 'text-slate-500' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className={cn("w-32 text-xs font-bold uppercase italic", row.color)}>{row.role}</div>
                      <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                         {row.permissions.map(p => (
                           <span key={p} className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-mono text-slate-300 transition-all hover:bg-brand-500 hover:text-white cursor-default">
                             {p}
                           </span>
                         ))}
                      </div>
                      <Shield className="w-3.5 h-3.5 text-slate-700" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DetailDrawer>
    </div>
  );
};
