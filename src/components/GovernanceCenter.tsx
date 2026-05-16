import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, History, Lock, Eye, Search, Filter, Plus, FileText, CheckCircle2, AlertCircle, Scale, Fingerprint } from 'lucide-react';
import { cn } from '../lib/utils';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';
import { AuditLogsView as AuditLogs } from './AuditLogs';
import { GovernanceView } from './Governance';
import { useAppState } from '../AppStateContext';
import { Placeholder } from './shared/Placeholder';

const GovernanceCenter = () => {
  const { subTab, setSubTab } = useAppState();
  const activeSubTab = (subTab['governance'] as 'GOVERNANCE' | 'AUDIT' | 'SECURITY' | 'COMPLIANCE') ?? 'GOVERNANCE';
  const setActiveSubTab = (id: string) => setSubTab('governance', id);

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
      <div className="sub-tab-bar">
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
        {activeSubTab === 'GOVERNANCE' && <GovernanceView />}
        {activeSubTab === 'AUDIT' && <AuditLogs />}
        {activeSubTab === 'SECURITY' && (
          <Placeholder
            title="Security Intelligence"
            icon={Fingerprint}
            description="Real-time threat detection and PII leakage monitoring for every AI interaction across the platform."
            plannedFeatures={[
              'PII leakage detection across prompts',
              'Prompt-injection threat scoring',
              'Anomalous access pattern alerts',
              'SIEM integration & response playbooks',
            ]}
          />
        )}
        {activeSubTab === 'COMPLIANCE' && (
          <Placeholder
            title="Compliance Reports"
            icon={FileText}
            description="SOC 2, ISO 27001, HIPAA, and regulatory compliance evidence collection — automated and continuously audited."
            plannedFeatures={[
              'Continuous control monitoring',
              'Evidence collection automation',
              'Auditor-ready report export',
              'Per-tenant compliance scope',
            ]}
          />
        )}
      </motion.div>
    </div>
  );
};

export default GovernanceCenter;
