import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  MoreVertical, 
  Search, 
  Filter, 
  Shield, 
  Lock, 
  Eye, 
  CheckCircle2, 
  XCircle,
  Copy,
  ChevronRight,
  ArrowRight,
  Bot,
  Database,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { OperationalHeader } from '../shared/OperationalHeader';
import { StatusBadge } from '../shared/StatusBadge';
import { DataTable } from '../shared/DataTable';

const MOCK_USERS = [
  { id: 'u1', name: 'Linh Nguyen', email: 'linh@aeroflow.ai', role: 'PLATFORM_ADMIN', workspace: 'Global-Alpha', lastLogin: '2m ago', mfa: true, sso: true },
  { id: 'u2', name: 'Sarah Chen', email: 'sarah.c@nexus.com', role: 'AI_ENGINEER', workspace: 'Nexus-Core', lastLogin: '1h ago', mfa: true, sso: true },
  { id: 'u3', name: 'John Doe', email: 'john@finance.net', role: 'BUSINESS_OPERATOR', workspace: 'Fin-Retail', lastLogin: '2d ago', mfa: false, sso: false },
];

export const IAMSection = () => {
  const [tab, setTab] = useState<'USERS' | 'ROLES' | 'PERMISSIONS'>('USERS');

  const userColumns = [
    { header: 'Identity Profile', accessor: (user: any) => (
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
           user.role === 'PLATFORM_ADMIN' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/30 shadow-[0_0_15px_rgba(2,115,199,0.2)]' : 'bg-slate-800 text-slate-400'
        }`}>
          {user.name[0]}
        </div>
        <div>
          <div className="text-white font-bold tracking-tight uppercase italic underline decoration-brand-500/30 underline-offset-4">{user.name}</div>
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mt-1">{user.email}</div>
        </div>
      </div>
    ) },
    { header: 'Role & Access', accessor: (user: any) => (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
           <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
           <span className="text-white font-black tracking-widest text-[10px] uppercase">{user.role}</span>
        </div>
        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 inline-block px-1.5 py-0.5 rounded italic opacity-70">TENANT: {user.workspace}</div>
      </div>
    ) },
    { header: 'Security Status', accessor: (user: any) => (
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-2">
            {user.mfa ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">MFA STATUS</span>
         </div>
         <div className="flex items-center gap-2">
            {user.sso ? <CheckCircle2 className="w-3 h-3 text-brand-500 shadow-[0_0_8px_rgba(2,115,199,0.4)]" /> : <AlertCircle className="w-3 h-3 text-slate-600" />}
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">SAML/SSO</span>
         </div>
      </div>
    ) },
    { header: 'Lifecycle', accessor: (user: any) => (
      <div>
         <div className="text-[10px] text-slate-300 italic font-bold uppercase tracking-tighter">Last Seen {user.lastLogin}</div>
         <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Active Pulse</span>
         </div>
      </div>
    ) },
  ];

  return (
    <div className="space-y-10">
      <OperationalHeader 
        title="Identity Control"
        subtitle="Multi-Tenant IAM, Role Mapping & Security Posture Sovereignty"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Governance' }, { label: 'IAM' }]}
        status={<StatusBadge status="STABLE" size="lg" />}
        actions={
          <button className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-500/20 active:scale-95">
            <UserPlus className="w-5 h-5" />
            VOUCHER NEW IDENTITY
          </button>
        }
      />

      <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-[24px] w-fit shadow-inner">
        {[
          { id: 'USERS', label: 'Fleet Personnel', icon: Users },
          { id: 'ROLES', label: 'Role Repository', icon: Shield },
          { id: 'PERMISSIONS', label: 'Access Matrix', icon: Lock },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id as any)}
            className={cn(
              "flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-xs font-bold transition-all relative",
              tab === item.id 
                ? "bg-white/10 text-white shadow-xl italic" 
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            )}
          >
            <item.icon className={cn("w-4 h-4", tab === item.id ? "text-brand-400" : "text-slate-500")} />
            {item.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={tab}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
           transition={{ duration: 0.2 }}
        >
          {tab === 'USERS' && (
            <DataTable 
              data={MOCK_USERS}
              columns={userColumns as any}
              subtitle="Audited user registry for Global Finance tenant"
            />
          )}

          {tab === 'ROLES' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {[
                 { title: 'Platform Admin', desc: 'Sovereign authority over entire multi-tenant infrastructure and governance pipelines.', users: 3, icon: ShieldCheck, color: 'brand' },
                 { title: 'AI Engineer', desc: 'Full-stack operational access to model registry, deployment pipelines, and observability.', users: 12, icon: Bot, color: 'emerald' },
                 { title: 'Policy Auditor', desc: 'Read-only archival access to audit ledgers and security compliance matrices.', users: 5, icon: Eye, color: 'amber' },
               ].map((role) => (
                 <div key={role.title} className="p-10 bg-white/[0.02] border border-white/5 rounded-[48px] group hover:bg-white/[0.04] transition-all relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.02] blur-[80px] pointer-events-none" />
                    
                    <div className="flex items-center justify-between mb-10">
                      <div className={cn("p-4 rounded-2xl border transition-transform group-hover:scale-110", 
                        role.color === 'brand' ? 'bg-brand-500/10 border-brand-500/20 text-brand-400' : 
                        role.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
                        'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      )}>
                        <role.icon className="w-8 h-8" />
                      </div>
                      <div className="text-right">
                         <span className="text-4xl font-bold text-white tracking-tighter italic leading-none">{role.users}</span>
                         <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Sovereign Units</div>
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-4 tracking-tight group-hover:text-brand-400 transition-colors uppercase italic">{role.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed italic mb-10 flex-1 opacity-80">{role.desc}</p>
                    
                    <div className="flex items-center justify-between pt-8 border-t border-white/5">
                       <button className="text-[11px] font-black text-brand-400 uppercase tracking-widest hover:text-brand-300 transition-colors underline decoration-brand-500/30 underline-offset-4">Edit Manifest</button>
                       <ArrowRight className="w-5 h-5 text-slate-700 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                    </div>
                 </div>
               ))}
            </div>
          )}

          {tab === 'PERMISSIONS' && (
            <div className="overflow-hidden rounded-[40px] border border-white/5 bg-white/[0.01] shadow-2xl">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-white/[0.02] border-b border-white/5">
                     <th className="p-8 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Operational Capability</th>
                     {['Admin', 'Engineer', 'Operator', 'Viewer'].map(r => (
                       <th key={r} className="p-8 text-center border-l border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{r}</th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {[
                      'Knowledge Ingestion Pipeline',
                      'Semantic Conflict Reconciliation',
                      'Agentic Model Promotion',
                      'Guardian Policy Rotation',
                      'Ledger Audit Export',
                      'Tenant Quota Management',
                      'Runtime Fabric Scaling'
                    ].map((cap, i) => (
                      <tr key={i} className="hover:bg-white/[0.03] transition-all group">
                        <td className="p-8 font-bold text-sm text-slate-300 uppercase italic opacity-70 group-hover:opacity-100 group-hover:text-white group-hover:translate-x-1 transition-all">{cap}</td>
                        {[1, 2, 3, 4].map(col => (
                          <td key={col} className="p-8 text-center border-l border-white/5">
                             <div className={cn(
                               "mx-auto w-6 h-6 p-1 relative",
                               (i+col) % 3 === 0 ? 'text-red-500/30' : 'text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                             )}>
                               {(i+col) % 3 === 0 ? <XCircle className="w-full h-full" /> : <CheckCircle2 className="w-full h-full" />}
                             </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
