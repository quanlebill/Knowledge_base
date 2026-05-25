import React from 'react';
import { 
  Building2, 
  Map as MapIcon, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Users, 
  Zap, 
  Lock,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';

export const GovernmentView = () => {
  return (
    <div className="space-y-8">
      <div className="animate-in fade-in duration-1000">
        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold font-mono tracking-[0.2em] uppercase mb-3">
          <Building2 className="w-4 h-4" />
          National Security & Public Service
        </div>
        <h1 className="text-4xl font-display font-medium text-white">National Intelligence Workspace</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <div className="glass-panel p-8 rounded-3xl bg-slate-900/50 border-slate-800">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-brand-400" />
                 National Policy Index
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[
                   { name: 'Regulatory Framework V4', status: 'SYNCHRONIZED', date: '2024-Q3' },
                   { name: 'Public Health Directive 12', status: 'UPDATE_REQUIRED', date: '2024-Q4' },
                   { name: 'Infrastructure Bill 2025', status: 'SYNCHRONIZED', date: '2025-JAN' },
                   { name: 'Data Privacy Guidelines', status: 'SYNCHRONIZED', date: '2025-FEB' },
                 ].map((doc, i) => (
                   <div key={doc.name} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center group cursor-pointer hover:border-brand-500/40 transition-all">
                      <div>
                         <div className="text-sm font-bold text-slate-200 group-hover:text-white">{doc.name}</div>
                         <div className="text-[10px] text-slate-500 mt-1 uppercase font-mono">{doc.date}</div>
                      </div>
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        doc.status === 'SYNCHRONIZED' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                      )} />
                   </div>
                 ))}
              </div>
           </div>

           <div className="glass-panel p-8 rounded-3xl border-slate-800 h-96 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                 <MapIcon className="w-64 h-64 text-slate-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Regional Operational Awareness</h3>
              <p className="text-sm text-slate-500 mb-8">AI-Synthesized status of national critical infrastructure.</p>
              
              <div className="space-y-4 max-w-sm">
                 {[
                   { region: 'East Sector', load: 82, status: 'NOMINAL' },
                   { region: 'West Sector', load: 45, status: 'NOMINAL' },
                   { region: 'Central Capital', load: 94, status: 'ALERT' },
                 ].map((s, i) => (
                   <div key={s.region} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase">
                        <span className="text-slate-400">{s.region}</span>
                        <span className={s.status === 'ALERT' ? 'text-red-400' : 'text-green-400'}>{s.status}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          s.status === 'ALERT' ? 'bg-red-500' : 'bg-brand-500'
                        )} style={{ width: `${s.load}%` }} />
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="space-y-6">
           <div className="glass-panel p-6 rounded-3xl bg-brand-500/10 border-brand-500/20">
              <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                 <Zap className="w-5 h-5 text-brand-400" />
                 AI Policy Assistant
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                Generate briefings based on current national policies and regional data. 
              </p>
              <button className="w-full py-3 bg-brand-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20">
                GENERATE BRIEFING
              </button>
           </div>

           <div className="glass-panel p-6 rounded-3xl border-slate-800">
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                 <Lock className="w-4 h-4" />
                 Top Secret Cleared Access
              </h4>
              <div className="space-y-3">
                 {[
                   'Biometric Auth: Verified',
                   'Encryption: AES-256-GCM',
                   'Logging: Permanent Audit',
                   'Sovereign Data: On-Premise'
                 ].map(text => (
                   <div key={text} className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      {text}
                   </div>
                 ))}
              </div>
           </div>

           <div className="glass-card p-6 rounded-3xl border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-3 mb-3">
                 <AlertCircle className="w-5 h-5 text-red-500" />
                 <span className="text-sm font-bold text-red-500 uppercase">Emergency Protocol</span>
              </div>
              <p className="text-xs text-red-200/60">
                Authorized override for cross-agency data sharing is active for next 2 hours.
              </p>
              <button className="mt-4 text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 group">
                Review Override Authorization
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
