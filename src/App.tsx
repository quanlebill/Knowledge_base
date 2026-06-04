import React from 'react';
import { AppStateProvider, useAppState } from './AppStateContext';
import { AppLayout } from './components/Layout';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import KnowledgeOpsCenter from './components/knowledge/KnowledgeOpsCenter';
import AIRuntimeCenter from './components/agent-builder/AIRuntimeCenter';
import OperationsCenter from './components/OperationsCenter';
import ReleaseManagementCenter from './components/ReleaseManagementCenter';
import GovernanceCenter from './components/GovernanceCenter';
import SettingsView from './components/Settings/Overview';

const Placeholder = ({ module }: { module: string }) => (
  <div className="h-full flex items-center justify-center text-[#5F5F5F] font-display italic">
    Module &quot;{module}&quot; is under construction...
  </div>
);

function AppContent() {
  const { activeModule } = useAppState();

  const renderView = () => {
    switch (activeModule) {
      case 'knowledge-ops':
        return <KnowledgeOpsCenter />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Placeholder module={activeModule} />;
    }
  };

  return (
    <div className="h-screen w-screen bg-[#1E1B15] overflow-hidden">
      {renderView()}
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}
