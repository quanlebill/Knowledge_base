import React from 'react';
import { 
  Key, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  History, 
  Plus,
  Server,
  KeyRound,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { OperationalHeader } from '../shared/OperationalHeader';
import { StatusBadge } from '../shared/StatusBadge';
import { cn } from '../../lib/utils';

export const SecretsSection = () => {
  return (
    <div className="space-y-10 lg:space-y-12 pb-20 no-scrollbar">
      <OperationalHeader 
        title="Secrets Vault"
        subtitle="Distributed cryptographic storage, API key management, and RSA/HSM signing."
        breadcrumbs={[{ label: 'Settings' }, { label: 'Security' }, { label: 'Secrets Vault' }]}
        status={<StatusBadge status="SECURE" size="lg" />}
        actions={
          <button className="w-full lg:w-auto flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-95">
            <Plus className="w-4 h-4" />
            INJECT SECRET
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8 lg:space-y-10">
          {/* Active Secrets */}
          <section className="glass-panel p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[3rem] border-white/5 bg-white/[0.01]">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-brand-500/10 rounded-2xl border border-brand-500/20 text-brand-400">
                     <KeyRound className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="text-xl lg:text-2xl font-bold text-white tracking-tight italic">Active Cryptographic Keys</h3>
                     <p className="text-[10px] lg:text-xs text-slate-500 uppercase font-black tracking-widest mt-1">FIPS 140-2 Level 3 Secure Storage</p>
                   </div>
                </div>
                <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl">
                   <button className="px-4 py-2 bg-brand-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Active</button>
                   <button className="px-4 py-2 text-slate-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Archived</button>
                </div>
             </div>

             <div className="space-y-4">
                {[
                   { name: 'AZURE_PROD_API_KEY', realm: 'FINANCE-INFRA', status: 'ACTIVE', type: 'AES-256', expiry: '2 days' },
                   { name: 'ENTERPRISE_SSH_ROOT', realm: 'CORE-PLATFORM', status: 'CRITICAL', type: 'RSA-4096', expiry: '84 days' },
                   { name: 'STRIPE_CLIENT_SECRET', realm: 'BILLING-NODE', status: 'EXPIRED', type: 'HMAC-SHA256', expiry: 'Exp. 12h ago' },
                   { name: 'NVIDIA_NIM_AUTH', realm: 'AI-RUNTIME', status: 'ACTIVE', type: 'BEARER', expiry: '340 days' },
                ].map((secret, i) => (
                   <div key={secret.name} className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-white/[0.03] border border-white/5 rounded-[2rem] hover:bg-white/[0.06] transition-all group gap-6 lg:gap-0">
                      <div className="flex items-center gap-5">
                         <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-brand-400 transition-colors shadow-inner">
                            <Lock className="w-6 h-6" />
                         </div>
                         <div>
                            <h4 className="text-base lg:text-lg font-bold text-white tracking-tight font-mono">{secret.name}</h4>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                               <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{secret.realm}</span>
                               <div className="w-1 h-1 rounded-full bg-slate-800" />
                               <span className="text-[10px] font-mono text-brand-500/80 uppercase tracking-widest">{secret.type}</span>
                            </div>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-8 justify-between lg:justify-end border-t lg:border-t-0 border-white/5 pt-4 lg:pt-0">
                         <div className="text-right">
                            <div className={cn(
                               "text-xs font-bold font-mono tracking-tighter",
                               secret.status === 'EXPIRED' ? 'text-red-500' : secret.status === 'CRITICAL' ? 'text-amber-500' : 'text-emerald-500'
                            )}>{secret.expiry}</div>
                            <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">TTL Remaining</div>
                         </div>
                         <div className="flex gap-2">
                           <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-slate-600 hover:text-white transition-all transform hover:scale-110 active:scale-95">
                              <Eye className="w-4 h-4" />
                           </button>
                           <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-slate-600 hover:text-white transition-all transform hover:scale-110 active:scale-95">
                              <History className="w-4 h-4" />
                           </button>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </section>

          {/* Vault Governance */}
          <section className="glass-panel p-8 lg:p-10 rounded-[2.5rem] lg:rounded-[3rem] border-white/5 bg-white/[0.01]">
             <h3 className="text-lg lg:text-xl font-bold text-white mb-8 italic flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Vault Governance Controls
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                   { label: 'Auto-Rotation', desc: 'Schedules key swap every 90 days', enabled: true },
                   { label: 'Panic Mode', desc: 'Instant revocation of all non-core keys', enabled: false },
                   { label: 'PII Access Log', desc: 'Record every secret retrieval event', enabled: true },
                ].map(ctl => (
                   <div key={ctl.label} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:border-brand-500/30 transition-all flex flex-col justify-between group">
                      <div>
                         <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-tight italic group-hover:text-brand-400">{ctl.label}</h4>
                         <p className="text-[10px] text-slate-500 italic leading-relaxed">{ctl.desc}</p>
                      </div>
                      <div className="mt-6 flex items-center gap-3">
                         <div className={cn("w-2 h-2 rounded-full", ctl.enabled ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-500")} />
                         <span className={cn("text-[9px] font-black uppercase tracking-widest", ctl.enabled ? "text-emerald-400" : "text-slate-400")}>{ctl.enabled ? 'ACTIVE' : 'STANDBY'}</span>
                      </div>
                   </div>
                ))}
             </div>
          </section>
        </div>

        <div className="space-y-8 lg:space-y-10">
           {/* HSM Health & Cryptography */}
           <section className="glass-panel p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[3rem] border-white/5 bg-[#02040d]">
              <div className="flex items-center gap-3 mb-8">
                 <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20 text-brand-400">
                    <Server className="w-5 h-5" />
                 </div>
                 <h3 className="text-lg lg:text-xl font-bold text-white tracking-tight italic">HSM Infrastructure</h3>
              </div>
              
              <div className="space-y-8">
                 <div className="p-6 bg-white/5 border border-white/5 rounded-3xl text-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/[0.05] blur-[40px] group-hover:bg-brand-500/[0.1] transition-all" />
                    <div className="text-3xl font-display font-medium text-white mb-2 italic">99.999%</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cryptographic Uptime</div>
                 </div>

                 <div className="space-y-6">
                    <div>
                       <div className="flex justify-between text-[10px] font-black mb-2 uppercase tracking-widest text-slate-600">
                          <span>Entropy Pool Depth</span>
                          <span className="text-emerald-400">CRITICAL_STABLE</span>
                       </div>
                       <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 w-[94%] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                       </div>
                    </div>
                 </div>

                 <div className="p-6 bg-brand-500/5 border border-brand-500/20 rounded-3xl">
                    <div className="flex items-center gap-3 mb-3 text-brand-400">
                       <ShieldAlert className="w-4 h-4" />
                       <span className="text-[10px] font-black uppercase tracking-widest tracking-widest">Secure Handshake</span>
                    </div>
                    <p className="text-[11px] text-brand-500/70 italic leading-relaxed">Hardware Security Module verified. Physical breach sensors operational.</p>
                 </div>
              </div>
           </section>

           {/* Access Logs Summary */}
           <section className="glass-panel p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[3rem] border-white/5 bg-white/[0.01]">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 lg:mb-10 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Recent Faults
              </h3>
              
              <div className="space-y-4">
                 {[
                    { event: 'UNAUTHORIZED_GET', user: 'ext-gateway-01', time: '14m ago' },
                    { event: 'KEY_REVOCATION', user: 'admin-g7', time: '2h ago' },
                    { event: 'BULK_DECRYPTION', user: 'system-rag', time: '4h ago' },
                 ].map(log => (
                    <div key={log.time} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] transition-all cursor-pointer">
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{log.event}</span>
                          <span className="text-[9px] font-mono text-slate-600">{log.time}</span>
                       </div>
                       <div className="text-[10px] font-bold text-white tracking-tight">{log.user}</div>
                    </div>
                 ))}
              </div>

              <div className="mt-8 flex justify-center border-t border-white/5 pt-8">
                 <button className="text-[10px] font-black text-brand-400 uppercase tracking-widest hover:underline flex items-center gap-2">
                    View Full Audit Stream <ArrowRight size={12} />
                 </button>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
};
