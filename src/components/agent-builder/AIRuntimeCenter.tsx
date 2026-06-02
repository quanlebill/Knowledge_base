import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bot, Layers, History, Plus, Zap, Activity, Terminal, Sliders, MessageSquare, MessageCircle, ScrollText } from 'lucide-react';
import AgentPlayground from './AgentPlayground';
import Conversations from './Conversations';
import SystemLogs from './SystemLogs';
import { cn } from '../../lib/utils';
import { useAppState } from '../../AppStateContext';
import { MODULE_SUB_ITEMS } from '../../constants';
import { OperationalHeader } from '../shared/OperationalHeader';
import { StatusBadge } from '../shared/StatusBadge';
import { AgentRuntimeView, RegistryView } from './agents/AgentRuntime';
import WorkflowEngine from './workflow/Overview';

const SUB_ITEMS = MODULE_SUB_ITEMS['ai-runtime'];

const AIRuntimeCenter = () => {
  const { subTab, setSubTab } = useAppState();
  const activeSubTab = subTab['ai-runtime'] ?? 'AGENTS';
  const setActiveSubTab = (id: string) => setSubTab('ai-runtime', id);

  /* Map secondary-nav sub-items onto AgentRuntime internal views */
  const registryViewMap: Record<string, RegistryView | null> = {
    AGENTS: 'OVERVIEW',
    CLI: 'CLI',
    CONFIG: 'CONFIG',
    TRACES: 'TRACES',
    RUNS: 'RUNS',
    PROVISION: null,   // opens drawer instead
    NEW_AGENT: null,   // opens drawer instead
  };

  const externalRegistryView = registryViewMap[activeSubTab] ?? undefined;
  const openWizard    = activeSubTab === 'NEW_AGENT';
  const openProvision = activeSubTab === 'PROVISION';

  /* Top in-page pill tabs — mirror the secondary nav as compact pills */
  const pillTabs = [
    { id: 'PLAYGROUND',    label: 'Playground',    icon: MessageSquare },
    { id: 'AGENTS',        label: 'Agents',        icon: Bot },
    { id: 'CONVERSATIONS', label: 'Conversations', icon: MessageCircle },
    { id: 'LOGS',          label: 'Logs',          icon: ScrollText },
    { id: 'CLI',           label: 'CLI',           icon: Terminal },
    { id: 'CONFIG',        label: 'Config',        icon: Sliders },
    { id: 'TRACES',        label: 'Traces',        icon: History },
    { id: 'RUNS',          label: 'Runs',          icon: Activity },
  ];

  const handleNewAgent  = () => setActiveSubTab('NEW_AGENT');
  const handleProvision = () => setActiveSubTab('PROVISION');

  return (
    <div className="space-y-7">
      <OperationalHeader
        title="AI Runtime"
        subtitle="Manage, orchestrate, and trace distributed AI agents and workflows"
        breadcrumbs={[{ label: 'AI' }, { label: 'Runtime' }]}
        status={<StatusBadge status="ACTIVE" size="lg" />}
        actions={
          <div className="flex gap-2">
            <button onClick={handleProvision} className="btn-secondary">
              <Zap className="w-4 h-4" />
              Quick Provision
            </button>
            <button onClick={handleNewAgent} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Agent
            </button>
          </div>
        }
      />

      {/* Sub-tab pill bar (in-page mirror of secondary nav) */}
      <div className="sub-tab-bar">
        {pillTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn('sub-tab', activeSubTab === tab.id && 'active')}
          >
            <tab.icon className="tab-icon w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {activeSubTab === 'WORKFLOWS' ? (
          <WorkflowEngine />
        ) : activeSubTab === 'PLAYGROUND' ? (
          <AgentPlayground embedded />
        ) : activeSubTab === 'CONVERSATIONS' ? (
          <Conversations />
        ) : activeSubTab === 'LOGS' ? (
          <SystemLogs />
        ) : (
          <AgentRuntimeView
            view={externalRegistryView}
            onViewChange={(v) => {
              const inverse: Record<RegistryView, string> = {
                OVERVIEW: 'AGENTS', CLI: 'CLI', CONFIG: 'CONFIG', TRACES: 'TRACES', RUNS: 'RUNS',
              };
              setActiveSubTab(inverse[v]);
            }}
            openWizard={openWizard}
            onWizardClose={() => setActiveSubTab('AGENTS')}
            openProvision={openProvision}
            onProvisionClose={() => setActiveSubTab('AGENTS')}
          />
        )}
      </motion.div>
    </div>
  );
};

export default AIRuntimeCenter;
