import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AgentRegistryOverview } from './AgentRegistry/Overview';
import { NewAgentWizard } from './AgentRegistry/Wizard';
import { CLIScreen } from './AgentRegistry/CLI';
import { ConfigRegistry } from './AgentRegistry/ConfigRegistry';
import { TraceExplorer } from './AgentRegistry/TraceExplorer';
import { ProvisioningView } from './AgentRegistry/Provisioning';
import { RunRegistry } from './AgentRegistry/RunRegistry';
import { AgentDetailView } from './AgentRegistry/AgentDetail';
import { DetailDrawer } from './shared/DetailDrawer';
import { Bot, Terminal, Sliders, Activity, Zap, Plus, Settings } from 'lucide-react';

type RegistryView = 'OVERVIEW' | 'CLI' | 'CONFIG' | 'TRACES' | 'RUNS';

export const AgentRuntimeView = () => {
  const [view, setView] = useState<RegistryView>('OVERVIEW');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showProvisioning, setShowProvisioning] = useState(false);

  const handleSelectAgent = (id: string) => {
    setSelectedAgentId(id);
  };

  const renderView = () => {
    switch (view) {
      case 'CLI':
        return <CLIScreen />;
      case 'CONFIG':
        return <ConfigRegistry />;
      case 'TRACES':
        return <TraceExplorer />;
      case 'RUNS':
        return <RunRegistry />;
      case 'OVERVIEW':
      default:
        return (
          <AgentRegistryOverview 
            onNewAgent={() => setShowWizard(true)} 
            onOpenCLI={() => setView('CLI')} 
            onOpenProvision={() => setShowProvisioning(true)}
            onSelectAgent={handleSelectAgent}
          />
        );
    }
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-[#050505] p-12">
      {/* Global Module Navigation (Small overlay) */}
      <div className="fixed bottom-6 lg:bottom-12 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-fit z-50 px-6 py-4 bg-black/80 backdrop-blur-3xl border border-white/5 rounded-[2rem] lg:rounded-[2.5rem] flex items-center justify-between lg:justify-start lg:gap-10 shadow-2xl shadow-black/50 overflow-x-auto no-scrollbar">
         {[
           { id: 'OVERVIEW', label: 'Inventory' },
           { id: 'CONFIG', label: 'Config' },
           { id: 'TRACES', label: 'Traces' },
           { id: 'RUNS', label: 'Runs' },
           { id: 'CLI', label: 'CLI' }
         ].map(nav => (
            <button 
              key={nav.id}
              onClick={() => { setView(nav.id as any); setSelectedAgentId(null); }}
              className={`text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap px-2 ${view === nav.id ? 'text-brand-400 italic' : 'text-slate-600 hover:text-slate-400'}`}
            >
              {nav.label}
            </button>
         ))}
      </div>

      <DetailDrawer
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        title="Agent Architect"
        subtitle="Provision specialized AI agents with discrete capabilities"
        icon={Plus}
        size="lg"
      >
        <NewAgentWizard 
          onCancel={() => setShowWizard(false)} 
          onComplete={() => setShowWizard(false)} 
        />
      </DetailDrawer>

      <DetailDrawer
        isOpen={showProvisioning}
        onClose={() => setShowProvisioning(false)}
        title="Fleet Provisioning"
        subtitle="Autoscale agent clusters based on demand"
        icon={Zap}
        size="md"
      >
        <ProvisioningView />
      </DetailDrawer>

      <DetailDrawer
        isOpen={!!selectedAgentId}
        onClose={() => setSelectedAgentId(null)}
        title={selectedAgentId ? `Agent: ${selectedAgentId}` : 'Agent Detail'}
        subtitle="Control Plane • Production Runtime • V2.0"
        icon={Bot}
        size="xl"
        tabs={[
          { id: 'CONFIG', label: 'Configuration', icon: Settings },
          { id: 'LOGS', label: 'Real-time Logs', icon: Terminal },
          { id: 'METRICS', label: 'Metrics', icon: Activity },
          { id: 'POLICY', label: 'Governance', icon: Sliders },
        ]}
        footer={
          <div className="flex gap-3">
             <button className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
                Restart Instance
             </button>
             <button className="px-6 py-2.5 bg-brand-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20">
                Synchronize Configuration
             </button>
          </div>
        }
      >
        {selectedAgentId && (
          <AgentDetailView 
            agentId={selectedAgentId} 
            onBack={() => setSelectedAgentId(null)} 
            onRun={() => { setView('RUNS'); setSelectedAgentId(null); }}
            onTrace={() => { setView('TRACES'); setSelectedAgentId(null); }}
          />
        )}
      </DetailDrawer>

      <AnimatePresence mode="wait">
        <div key={view} className="flex-1 overflow-y-auto no-scrollbar">
          {renderView()}
        </div>
      </AnimatePresence>
    </div>
  );
};
