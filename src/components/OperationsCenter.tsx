import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Activity, BarChart3, Cpu, Server, Play, Search, Filter, Plus, ShieldCheck, Zap, Globe, Gauge } from 'lucide-react';
import { cn } from '../lib/utils';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';
import { AIOpsCenter } from './AIOpsCenter';
import { ObservabilityView } from './ObservabilityView';
import { useAppState } from '../AppStateContext';
import { Placeholder } from './shared/Placeholder';

const OperationsCenter = () => {
  const { subTab, setSubTab } = useAppState();
  const activeSubTab = (subTab['operations-center'] as 'HEALTH' | 'OBSERVABILITY' | 'FLEET') ?? 'HEALTH';
  const setActiveSubTab = (id: string) => setSubTab('operations-center', id);

  const mainMetrics = [
    { label: 'System Health', value: '99.9%', trend: 'STABLE', trendType: 'NEUTRAL' as const, icon: Activity, color: 'emerald' as const },
    { label: 'Ingestion Thru', value: '84GB/s', trend: '+14%', trendType: 'UP' as const, icon: Gauge, color: 'blue' as const },
    { label: 'Worker Fleet', value: '428', trend: 'AUTOSCALING', trendType: 'UP' as const, icon: Server, color: 'brand' as const },
    { label: 'Resource Efficiency', value: '78%', trend: '-2%', trendType: 'DOWN' as const, icon: Cpu, color: 'amber' as const },
  ];

  const subTabs = [
    { id: 'HEALTH', label: 'Platform Health', icon: Activity },
    { id: 'OBSERVABILITY', label: 'Metric Explorer', icon: BarChart3 },
    { id: 'FLEET', label: 'Worker Fleet', icon: Server },
  ];

  return (
    <div className="space-y-8">
      <OperationalHeader 
        title="Operations Center"
        subtitle="Real-time Platform Health, Resource Observability & Infrastructure Control"
        breadcrumbs={[{ label: 'Operations' }, { label: 'Center' }]}
        status={<StatusBadge status="STABLE" size="lg" />}
        actions={
          <div className="flex gap-3">
             <button className="btn-secondary">
                <Globe className="w-4 h-4" />
                REGION: US-EAST-1
              </button>
              <button className="btn-primary">
                <Play className="w-4 h-4" />
                TRIGGER DRIFT CHECK
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
        {activeSubTab === 'HEALTH' && <AIOpsCenter />}
        {activeSubTab === 'OBSERVABILITY' && <ObservabilityView />}
        {activeSubTab === 'FLEET' && (
          <Placeholder
            title="Worker Fleet Management"
            icon={Server}
            description="Status of all distributed execution workers across the global fabric. Monitor utilization, autoscale, and triage worker incidents."
            plannedFeatures={[
              'Real-time worker health map',
              'Autoscaling rule configuration',
              'Worker pool reconciliation',
              'Per-worker trace inspection',
            ]}
          />
        )}
      </motion.div>
    </div>
  );
};

export default OperationsCenter;
