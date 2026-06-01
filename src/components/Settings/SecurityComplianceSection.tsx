import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Download, 
  Settings2,
  MoreVertical,
  Activity,
  History,
  ArrowRight,
  TrendingUp,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';

const POLICIES = [
  { id: 'pol-1', name: 'PII Redaction Threshold', module: 'Knowledge Base', status: 'COMPLIANT', severity: 'HIGH' },
  { id: 'pol-2', name: 'Zero-Trust Model Access', module: 'AI Runtime', status: 'VIOLATION (2)', severity: 'CRITICAL' },
  { id: 'pol-3', name: 'Retention Lock (Gold Layer)', module: 'Storage', status: 'COMPLIANT', severity: 'MEDIUM' },
  { id: 'pol-4', name: 'Audit Trace Residency', module: 'Governance', status: 'PENDING_SCAN', severity: 'HIGH' },
];

export const SecurityComplianceSection = () => {
  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Security & Compliance Center</h1>
          <p className="text-slate-500 font-medium leading-relaxed max-w-xl">
            Governing zero-trust access, data residency, and enterprise compliance scores. PII masking and automated policy enforcement.
          </p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
           <button className="px-5 py-2.5 bg-brand-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Real-time Policy</button>
           <button className="px-5 py-2.5 text-slate-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Audit Engine</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[40px]">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-xl font-bold text-white tracking-tight">Enterprise Governance Policies</h3>
                 <button className="flex items-center gap-2 text-xs font-bold text-brand-400 hover:text-brand-300">
                   <Settings2 className="w-4 h-4" />
                   Configure Scanners
                 </button>
              </div>

              <div className="space-y-4">
                 {POLICIES.map((policy) => (
                   <div key={policy.id} className="group flex items-center justify-between p-6 bg-white/5 hover:bg-white/[0.08] border border-white/5 rounded-3xl transition-all">
                      <div className="flex items-center gap-6">
                         <div className={`p-4 rounded-2xl bg-slate-900 border border-white/10 ${
                           policy.status.includes('VIOLATION') ? 'text-red-400' : 
                           policy.status === 'COMPLIANT' ? 'text-emerald-400' : 'text-slate-500'
                         }`}>
                           {policy.status.includes('VIOLATION') ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                         </div>
                         <div>
                            <div className="text-white font-bold text-sm tracking-tight mb-1">{policy.name}</div>
                            <div className="flex items-center gap-3">
                               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{policy.module}</span>
                               <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                 policy.severity === 'CRITICAL' ? 'bg-red-400/10 border-red-400/20 text-red-400' :
                                 policy.severity === 'HIGH' ? 'bg-amber-400/10 border-amber-400/20 text-amber-400' :
                                 'bg-blue-400/10 border-blue-400/20 text-blue-400'
                               }`}>
                                 {policy.severity}
                               </div>
                            </div>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                         <div className="text-right">
                            <div className={`text-xs font-bold ${
                               policy.status === 'COMPLIANT' ? 'text-emerald-400' : 
                               policy.status.includes('VIOLATION') ? 'text-red-400' : 'text-slate-500'
                            }`}>{policy.status}</div>
                            <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Policy Status</div>
                         </div>
                         <ArrowRight className="w-4 h-4 text-slate-700 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" />
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="p-8 bg-[#0a0a0a] border border-white/5 rounded-[40px] relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8">
                <Globe className="w-24 h-24 text-brand-500/5 rotate-12" />
             </div>
              <h3 className="text-xl font-bold text-white mb-8">Data Residency & Sovereignty</h3>
              <div className="grid grid-cols-3 gap-6">
                 {[
                   { region: 'Asia-SE1', compliance: 'HIPAA, GDPR', state: 'LOCKED' },
                   { region: 'US-East-1', compliance: 'SOC2-TypeII', state: 'RESTRICTED' },
                   { region: 'EU-West-3', compliance: 'GDPR, EBA', state: 'LOCKED' },
                 ].map(r => (
                   <div key={r.region} className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                      <div className="text-brand-400 font-bold text-xs mb-2 italic">#{r.region}</div>
                      <div className="text-white font-bold text-lg mb-4">{r.state}</div>
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 leading-none">Standards</div>
                      <div className="text-[10px] text-slate-400 font-medium">{r.compliance}</div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="space-y-8">
           <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[40px]">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-lg font-bold text-white">Compliance Score</h3>
                 <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex items-end gap-3 mb-8">
                 <span className="text-5xl font-bold text-white leading-none">94.2</span>
                 <span className="text-slate-500 font-bold mb-1">/ 100</span>
              </div>
              <div className="space-y-4">
                 {[
                   { label: 'Platform Security', val: 98 },
                   { label: 'Data Residency', val: 82 },
                   { label: 'Audit Velocity', val: 100 },
                 ].map(m => (
                   <div key={m.label} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        <span>{m.label}</span>
                        <span>{m.val}%</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${m.val}%` }} />
                      </div>
                   </div>
                 ))}
              </div>
              <button className="w-full mt-10 py-4 bg-brand-500 hover:bg-brand-400 text-white rounded-[20px] font-bold shadow-lg transition-all">
                 Generate Compliance Report
              </button>
           </div>

           <div className="p-8 bg-slate-900 border border-white/5 rounded-[40px]">
              <div className="flex items-center gap-3 mb-6">
                <History className="w-5 h-5 text-brand-400" />
                <h3 className="text-lg font-bold text-white">Security Log</h3>
              </div>
              <div className="space-y-4">
                 {[
                   { op: 'SECRET_ROTATION', time: '12m ago', user: 'Linh N.' },
                   { op: 'RBAC_ELEVATION', time: '1h ago', user: 'System' },
                   { op: 'PII_REDACTION_FAIL', time: '2h ago', user: 'KB-Indexer' },
                 ].map((log, i) => (
                   <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <div className="text-[10px] font-black text-white hover:text-brand-400 transition-colors cursor-pointer">{log.op}</div>
                        <div className="text-[10px] text-slate-500">{log.time}</div>
                      </div>
                      <div className="text-[10px] font-mono text-slate-600 uppercase">{log.user}</div>
                   </div>
                 ))}
              </div>
              <button className="w-full mt-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-white transition-colors">View All Events</button>
           </div>
        </div>
      </div>
    </div>
  );
};
