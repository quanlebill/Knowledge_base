import React, { useState } from 'react';
import { 
  Lock, 
  Key, 
  ShieldCheck, 
  Users, 
  Fingerprint, 
  Database,
  Globe,
  ArrowRight,
  ShieldAlert,
  Server,
  Cloud,
  ExternalLink,
  Plus,
  AlertCircle
} from 'lucide-react';
import { OperationalHeader } from '../shared/OperationalHeader';
import { StatusBadge } from '../shared/StatusBadge';
import { DetailDrawer } from '../shared/DetailDrawer';

export const AuthSection = () => {
  const [showProviderDrawer, setShowProviderDrawer] = useState(false);
  const [showRuleDrawer, setShowRuleDrawer] = useState<string | null>(null);

  const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');

  return (
    <>
      <div className="space-y-10 lg:space-y-12 pb-20 no-scrollbar">
        <OperationalHeader 
          title="Auth & SSO Federation"
          subtitle="Manage identity providers, SAML/OIDC bridges, and MFA policy enforcement."
          breadcrumbs={[{ label: 'Settings' }, { label: 'Security' }, { label: 'Auth & SSO' }]}
          status={<StatusBadge status="ACTIVE" size="lg" />}
          actions={
            <button 
              onClick={() => setShowProviderDrawer(true)}
              className="w-full lg:w-auto flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              REGISTER PROVIDER
            </button>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8 lg:space-y-10">
            {/* Active Identity Providers */}
            <section className="glass-panel p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[3rem] border-white/5 bg-white/[0.01]">
               <div className="flex items-center gap-3 mb-8 lg:mb-10">
                  <div className="p-2.5 bg-brand-500/10 rounded-2xl border border-brand-500/20 text-brand-400">
                    <Server className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl lg:text-2xl font-bold text-white tracking-tight italic">Federated Identity Bridges</h3>
                    <p className="text-[10px] lg:text-xs text-slate-500 uppercase font-black tracking-widest mt-1">Active External Auth Nodes</p>
                  </div>
               </div>

               <div className="space-y-4">
                  {[
                     { name: 'Azure AD (Entra ID)', type: 'OIDC / SAML 2.0', status: 'ACTIVE', users: '12,402', icon: Cloud, logo: 'AZ' },
                     { name: 'Okta Enterprise', type: 'SAML 2.0', status: 'ACTIVE', users: '4,500', icon: ShieldCheck, logo: 'OK' },
                     { name: 'Google Workspace', type: 'OIDC (Google Cloud)', status: 'ACTIVE', users: '820', icon: Globe, logo: 'GO' },
                  ].map((idp, i) => (
                     <div key={idp.name} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/[0.06] transition-all group gap-4 sm:gap-0">
                        <div className="flex items-center gap-5">
                           <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-400 font-mono font-black text-xs shadow-inner">
                              {idp.logo}
                           </div>
                           <div>
                              <h4 className="text-base lg:text-lg font-bold text-white tracking-tight">{idp.name}</h4>
                              <div className="flex flex-wrap items-center gap-3 mt-1">
                                 <span className="text-[9px] font-black text-brand-500/60 uppercase tracking-widest">{idp.type}</span>
                                 <div className="w-1 h-1 rounded-full bg-slate-800" />
                                 <span className="text-[10px] font-bold text-slate-500">{idp.users} Synced Entities</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BRIDGE ACTIVE</span>
                           </div>
                           <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-slate-600 hover:text-white transition-all">
                              <ArrowRight className="w-4 h-4" />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            </section>

            {/* Policy Enforcement */}
            <section className="glass-panel p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[3rem] border-white/5 bg-white/[0.01]">
               <div className="flex items-center gap-3 mb-8 lg:mb-10">
                  <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl lg:text-2xl font-bold text-white tracking-tight italic">Access Policy Matrix</h3>
                    <p className="text-[10px] lg:text-xs text-slate-500 uppercase font-black tracking-widest mt-1">Global Neural Guardrail Settings</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                     { label: 'Enforce Multi-Factor (MFA)', desc: 'Mandatory TOTP / WebAuthn for all tenants', status: true },
                     { label: 'Session Persistence', desc: 'Auto-revocation after 8 hours of inactivity', status: true },
                     { label: 'IP Allowlisting', desc: 'Restricted access to corporate VPN ranges', status: false },
                     { label: 'Concurrent Session Limit', desc: 'Max 2 active sessions per user entity', status: true },
                  ].map(policy => (
                     <div key={policy.label} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:border-brand-500/30 transition-all flex flex-col justify-between group">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                             <h4 className="text-sm lg:text-base font-bold text-white tracking-tight group-hover:text-brand-400 transition-colors uppercase italic">{policy.label}</h4>
                             <div className={cn(
                                "w-10 h-5 rounded-full relative transition-all",
                                policy.status ? "bg-brand-500" : "bg-slate-800"
                             )}>
                                <div className={cn(
                                   "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                                   policy.status ? "right-1" : "left-1"
                                )} />
                             </div>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed italic">{policy.desc}</p>
                        </div>
                        <div className="mt-8 pt-4 border-t border-white/5">
                           <button 
                             onClick={() => setShowRuleDrawer(policy.label)}
                             className="text-[9px] font-black text-slate-600 hover:text-white uppercase tracking-widest transition-all"
                           >
                             Configure Rule →
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            </section>
          </div>

          <div className="space-y-8 lg:space-y-10">
             {/* Biometric & WebAuthn Health */}
             <section className="glass-panel p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[3rem] border-white/5 bg-[#02040d]">
                <div className="flex items-center gap-3 mb-8 lg:mb-10">
                   <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20 text-brand-400">
                      <Fingerprint className="w-5 h-5" />
                   </div>
                   <h3 className="text-lg lg:text-xl font-bold text-white tracking-tight italic">Biometric Mesh</h3>
                </div>

                <div className="space-y-6">
                   <div>
                      <div className="flex justify-between text-[10px] font-black mb-3 uppercase tracking-widest text-slate-600">
                         <span>Adoption Rate</span>
                         <span className="text-brand-400">62%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full bg-brand-500 rounded-full w-[62%] shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                         <div className="text-[10px] font-black text-slate-600 uppercase mb-1">FaceID / TouchID</div>
                         <div className="text-sm font-bold text-white">4,204 Users</div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                         <div className="text-[10px] font-black text-slate-600 uppercase mb-1">YukiKey / NFC</div>
                         <div className="text-sm font-bold text-white">210 Total</div>
                      </div>
                   </div>

                   <button className="w-full py-4 bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white border border-brand-500/20 hover:border-transparent rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                      Enable WebAuthn Shield
                   </button>
                </div>
             </section>

             {/* OIDC Discovery Ops */}
             <section className="glass-panel p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[3rem] border-white/5 bg-white/[0.01]">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 lg:mb-10 flex items-center gap-3">
                  <Database className="w-4 h-4 text-slate-600" />
                  Discovery Endpoint
                </h3>
                
                <div className="space-y-6">
                   <div>
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-3">Well-Known Config</label>
                      <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
                         <div className="text-[10px] font-mono text-slate-400 truncate tracking-tight">https://auth.neuralarch.io/.well-known/oidc-config</div>
                         <button className="p-2 text-slate-600 hover:text-white"><ExternalLink size={14} /></button>
                      </div>
                   </div>

                   <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                      <div className="flex items-center gap-3 mb-2 text-amber-400">
                         <ShieldAlert className="w-4 h-4" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Rotation Advisory</span>
                      </div>
                      <p className="text-[11px] text-amber-500/80 italic leading-relaxed">System keys have reached 84% of their TTL. Automated rotation scheduled for next Sunday.</p>
                   </div>
                </div>

                <div className="mt-10 pt-10 border-t border-white/5">
                   <button className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest py-2">
                      <History size={16} />
                      View Auth Audit Stream
                   </button>
                </div>
             </section>
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={showProviderDrawer}
        onClose={() => setShowProviderDrawer(false)}
        title="Register Identity Provider"
        subtitle="External OIDC/SAML Bridge Configuration"
        icon={Cloud}
        size="md"
        footer={
           <div className="flex gap-3">
              <button 
                onClick={() => setShowProviderDrawer(false)}
                className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest"
              >
                 Cancel
              </button>
              <button className="px-8 py-2.5 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-500/20">
                 Test & Sync Bridge
              </button>
           </div>
        }
      >
        <div className="p-10 space-y-8">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Protocol Type</label>
              <div className="grid grid-cols-2 gap-3">
                 {['OIDC 1.0', 'SAML 2.0'].map(p => (
                    <button key={p} className={cn(
                       "p-4 border rounded-2xl text-[10px] font-bold uppercase transition-all",
                       p === 'OIDC 1.0' ? "bg-brand-500/10 border-brand-500 text-brand-400" : "bg-white/5 border-white/10 text-slate-500"
                    )}>{p}</button>
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Discovery Endpoint</label>
              <input type="text" placeholder="https://..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-brand-500/50" />
           </div>

           <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Client ID</label>
                 <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono text-slate-300" />
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Client Secret</label>
                 <input type="password" value="********" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono text-slate-300" />
              </div>
           </div>
        </div>
      </DetailDrawer>

      <DetailDrawer
        isOpen={!!showRuleDrawer}
        onClose={() => setShowRuleDrawer(null)}
        title={showRuleDrawer || 'Rule Policy'}
        subtitle="Global Guardrail Enforcement Engine"
        icon={ShieldAlert}
        size="md"
        footer={
           <div className="flex gap-3">
              <button 
                onClick={() => setShowRuleDrawer(null)}
                className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest"
              >
                 Close
              </button>
              <button className="px-8 py-2.5 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-500/20">
                 Apply Global Rule
              </button>
           </div>
        }
      >
        <div className="p-10 space-y-8">
           <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
              <div>
                 <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Impact Analysis</h4>
                 <p className="text-[11px] text-amber-600 leading-relaxed italic">
                    Changing this rule will affect 12,402 active identities across 3 global tenants. A platform-wide re-authentication event will be triggered.
                 </p>
              </div>
           </div>

           <div className="space-y-6">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Enforcement Mode</label>
              <div className="space-y-3">
                 {['Strict Isolation', 'Baseline Required', 'Audit Only'].map((mode, i) => (
                    <div key={i} className="p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-brand-500/30">
                       <div>
                          <div className="text-xs font-bold text-white group-hover:text-brand-400 uppercase">{mode}</div>
                          <div className="text-[10px] text-slate-600 mt-1 italic">Policy version 2.4-stable</div>
                       </div>
                       <div className={cn(
                          "w-4 h-4 rounded-full border-2",
                          i === 0 ? "border-brand-500 bg-brand-500" : "border-white/20"
                       )} />
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </DetailDrawer>
    </>
  );
};

const History = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
    <path d="M3 3v5h5"></path>
    <path d="M12 7v5l4 2"></path>
  </svg>
);
