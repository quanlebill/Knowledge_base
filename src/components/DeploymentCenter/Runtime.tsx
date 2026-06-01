import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Rocket, ShieldAlert } from 'lucide-react';
import { DeploymentOverview } from './Overview';
import { DeploymentWizard } from './Wizard';
import { EnvironmentManager } from './EnvironmentManager';
import { DriftDetection } from './DriftDetection';
import { DetailDrawer } from '../shared/DetailDrawer';

type DeploymentView = 'OVERVIEW' | 'WIZARD' | 'ENV_MANAGER' | 'DRIFT';

export const DeploymentCenterRuntime = () => {
  const [view, setView] = useState<DeploymentView>('OVERVIEW');
  const [showWizard, setShowWizard] = useState(false);
  const [showDrift, setShowDrift] = useState(false);

  const renderView = () => {
    switch (view) {
      case 'ENV_MANAGER':
        return <EnvironmentManager />;
      default:
        return (
          <DeploymentOverview 
            onNewDeployment={() => setShowWizard(true)} 
            onOpenApprovals={() => {}} 
            onOpenDrift={() => setShowDrift(true)} 
          />
        );
    }
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-[#050505] p-12">
      {/* Local Module Navigation */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 px-8 py-4 bg-black/80 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] flex items-center gap-10 shadow-2xl shadow-black/50">
         {[
           { id: 'OVERVIEW', label: 'Release Ops' },
           { id: 'ENV_MANAGER', label: 'Clusters' },
         ].map(nav => (
            <button 
              key={nav.id}
              onClick={() => setView(nav.id as any)}
              className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === nav.id ? 'text-brand-400' : 'text-slate-600 hover:text-slate-400'}`}
            >
              {nav.label}
            </button>
         ))}
      </div>

      <AnimatePresence mode="wait">
        <div key={view} className="flex-1 overflow-y-auto no-scrollbar pb-32">
          {renderView()}
        </div>
      </AnimatePresence>

      <DetailDrawer
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        title="Promote Release Package"
        subtitle="Cross-Environment Asset Orchestration"
        icon={Rocket}
        size="xl"
      >
        <DeploymentWizard onCancel={() => setShowWizard(false)} onComplete={() => setShowWizard(false)} />
      </DetailDrawer>

      <DetailDrawer
        isOpen={showDrift}
        onClose={() => setShowDrift(false)}
        title="Drift Reconciliation Workspace"
        subtitle="Infrastructure State Alignment & Audit"
        icon={ShieldAlert}
        size="lg"
      >
        <DriftDetection />
      </DetailDrawer>
    </div>
  );
};
