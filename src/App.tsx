import React, { useState } from 'react';
import { AppStateProvider, useAppState } from './AppStateContext';
import { AppLayout } from './components/Layout';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import KnowledgeOpsCenter from './components/KnowledgeOpsCenter';
import AIRuntimeCenter from './components/AIRuntimeCenter';
import OperationsCenter from './components/OperationsCenter';
import ReleaseManagementCenter from './components/ReleaseManagementCenter';
import GovernanceCenter from './components/GovernanceCenter';
import SettingsView from './components/Settings/Overview';
import { GovernmentView } from './components/GovernmentView';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { role, industry } = useAppState();

  const renderView = () => {
    // Override dashboard based on industry for Executives
    if (activeTab === 'dashboard' && industry === 'GOVERNMENT') {
      return <GovernmentView />;
    }

    switch (activeTab) {
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
          <div className="h-full flex items-center justify-center text-slate-500 font-display italic">
            Module "{activeTab}" is initializing in {industry} context...
          </div>
        );
    }
  };

  return (
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab}>
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

