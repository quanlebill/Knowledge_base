import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, History, Lock, Eye, Search, Filter, Plus, FileText, CheckCircle2, AlertCircle, Scale, Fingerprint } from 'lucide-react';
import { cn } from '../lib/utils';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';
import { AuditLogsView as AuditLogs } from './AuditLogs';
import { GovernanceView } from './Governance';

const GovernanceCenter = () => {
  const [activeSubTab, setActiveSubTab] = useState<'GOVERNANCE' | 'AUDIT' | 'SECURITY' | 'COMPLIANCE'>('GOVERNANCE');

  const mainMetrics = [
    { label: 'Security Score', value: 'A+', trend: 'COMPLIANT', trendType: 'NEUTRAL' as const, icon: ShieldCheck, color: 'brand' as const },
    { label: 'Audit Density', value: '2.4M', icon: History, color: 'blue' as const },
    { label: 'Active Policies', value: '42', icon: Scale, color: 'emerald' as const },
    { label: 'Pending Approvals', value: '3', trend: 'ACTION REQ', trendType: 'UP' as const, icon: CheckCircle2, color: 'amber' as const },
  ];

  const subTabs = [
    { id: 'GOVERNANCE', label: 'Policy Control', icon: ShieldCheck },
    { id: 'AUDIT', label: 'System Audit', icon: History },
    { id: 'SECURITY', label: 'Security Intelligence', icon: Fingerprint },
    { id: 'COMPLIANCE', label: 'Compliance Reports', icon: FileText },
  ];

  return (
    <div className="space-y-8">
      <OperationalHeader 
        title="Governance & Audit"
        subtitle="Policy Enforcement, Immutable Audit Trails & Enterprise Compliance Intelligence"
        breadcrumbs={[{ label: 'Governance' }, { label: 'Center' }]}
        status={<StatusBadge status="SECURE" size="lg" />}
        actions={
          <div className="flex gap-3">
              <button className="btn-primary">
                <FileText className="w-4 h-4" />
                GENERATE REPORT
              </button>
          </div>
        }
      />

      <StandardMetricsGrid metrics={mainMetrics} />

      {/* Sub-Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-[#F8F6EF] border border-[#ECE7DA] rounded-2xl w-full lg:w-fit overflow-x-auto no-scrollbar">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-all shrink-0",
              activeSubTab === tab.id
                ? "bg-white text-[#171717] shadow-sm border border-[#ECE7DA]"
                : "text-[#8B8B8B] hover:text-[#4A4A4A] hover:bg-white/70"
            )}
          >
            <tab.icon className={cn("w-3.5 h-3.5", activeSubTab === tab.id ? "text-[#D9B86C]" : "text-[#C0B9AC]")} />
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
        {activeSubTab === 'GOVERNANCE' && <GovernanceView />}
        {activeSubTab === 'AUDIT' && <AuditLogs />}
        {activeSubTab === 'SECURITY' && (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[40px] border-dashed">
            <div className="w-16 h-16 rounded-full bg-slate-500/10 flex items-center justify-center border border-white/5">
              <Fingerprint className="w-8 h-8 text-slate-500 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase italic">Security Intelligence</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Real-time threat detection and PII leakage monitoring for all AI interactions</p>
            </div>
          </div>
        )}
        {activeSubTab === 'COMPLIANCE' && (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[40px] border-dashed">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase italic">Compliance Reports</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">SOC 2, ISO 27001, and regulatory compliance evidence collection</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default GovernanceCenter;
