import React from 'react';
import { AppStateProvider, useAppState } from './AppStateContext';
import { AppLayout } from './components/Layout';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import KnowledgeOpsCenter from './components/knowledge/KnowledgeOpsCenter';
import AIRuntimeCenter from './components/AIRuntimeCenter';
import OperationsCenter from './components/OperationsCenter';
import ReleaseManagementCenter from './components/ReleaseManagementCenter';
import GovernanceCenter from './components/GovernanceCenter';
import SettingsView from './components/Settings/Overview';
import { GovernmentView } from './components/GovernmentView';

function AppContent() {
  const { activeModule, setActiveModule, industry } = useAppState();

  const renderView = () => {
    // Industry overrides for Executive dashboard
    if (activeModule === 'dashboard' && industry === 'GOVERNMENT') {
      return <GovernmentView />;
    }

    switch (activeModule) {
      case 'dashboard':
        return <ExecutiveDashboard />;
      case 'knowledge-ops':
        return <KnowledgeOpsCenter />;
      case 'ai-runtime':
        return <AIRuntimeCenter />;
      case 'operations-center':
        return <OperationsCenter />;
      case 'release-management':
        return <ReleaseManagementCenter />;
      case 'governance':
        return <GovernanceCenter />;
      case 'national-ops':
        return <GovernmentView />;
      case 'settings':
        return <SettingsView />;
      default:
        return (
          <div className="h-full flex items-center justify-center text-[#5F5F5F] font-display italic">
            Module "{activeModule}" is initializing in {industry} context...
          </div>
        );
    }
  };

  return (
    <AppLayout activeTab={activeModule} setActiveTab={setActiveModule}>
      {renderView()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}
