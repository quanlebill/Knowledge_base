import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  ShieldAlert, 
  Network, 
  Play, 
  Search, 
  Filter, 
  Plus, 
  Layers, 
  Database as DBIcon, 
  Zap, 
  Globe,
  Activity,
  History as HistoryIcon,
  HardDrive,
  Cpu,
  Terminal,
  ShieldCheck,
  ShieldQuestion,
  FileSearch,
  Hash,
  FileText,
  CheckCircle2,
  Share2,
  Check,
  MoreVertical,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  X,
  Eye,
  Clock,
  Sparkles,
  Edit2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { OperationalHeader } from './shared/OperationalHeader';
import { StatusBadge } from './shared/StatusBadge';
import { StandardMetricsGrid } from './shared/ObservabilityPanel';
import { KnowledgeBaseView } from './KnowledgeBase';
import { ConflictWorkspace } from './ConflictWorkspace';
import { ConnectorManager } from './ConnectorManager';
import { IngestionWizard } from './IngestionWizard';
import { AssetDetailWorkspace } from './AssetDetailWorkspace';
import { DetailDrawer } from './shared/DetailDrawer';
import { FleetOverview } from './knowledge/FleetOverview';
import { KnowledgePlayground } from './knowledge/KnowledgePlayground';
import { EmbeddingManagement } from './knowledge/EmbeddingManagement';
import { AssetInventory } from './knowledge/AssetInventory';
import { JobCenter } from './knowledge/JobCenter';
import { GraphRAGView } from './GraphRAG';
import { KnowledgeDocument } from '../types';
import { useAppState } from '../AppStateContext';

type KnowledgeTabId = 'FLEET' | 'CONNECTORS' | 'INGEST' | 'INVENTORY' | 'PIPELINES' | 'CONFLICTS' | 'GRAPH' | 'PLAYGROUND' | 'EMBEDDINGS' | 'GOVERNANCE';

const KnowledgeOpsCenter = () => {
  const { subTab, setSubTab } = useAppState();
  const activeSubTab = (subTab['knowledge-ops'] as KnowledgeTabId) ?? 'FLEET';
  const setActiveSubTab = (id: KnowledgeTabId) => setSubTab('knowledge-ops', id);

  const [selectedAsset, setSelectedAsset] = useState<KnowledgeDocument | null>(null);
  const [assetTab, setAssetTab] = useState<'PREVIEW' | 'CHUNKS' | 'LOGS' | 'TIMELINE' | 'GRAPH'>('PREVIEW');
  const [showPromoteWizard, setShowPromoteWizard] = useState(false);

  /* Ingest is driven by the secondary nav now */
  const showIngestionWizard = activeSubTab === 'INGEST';
  const setShowIngestionWizard = (v: boolean) => setActiveSubTab(v ? 'INGEST' : 'FLEET');

  const mainMetrics = [
    { label: 'Knowledge Fleet', value: '1,248', trend: '+12%', trendType: 'UP' as const, icon: Database, color: 'brand' as const },
    { label: 'Conflict Rate', value: '0.04%', trend: '-2%', trendType: 'DOWN' as const, icon: ShieldAlert, color: 'emerald' as const },
    { label: 'Graph Density', value: '42.8k', trend: '+5k', trendType: 'UP' as const, icon: Network, color: 'blue' as const },
    { label: 'Pipeline Auth', value: '100%', trend: 'STABLE', trendType: 'NEUTRAL' as const, icon: ShieldCheck, color: 'amber' as const },
  ];

  const subTabs = [
    { id: 'FLEET', label: 'Fleet Overview', icon: Database },
    { id: 'CONNECTORS', label: 'Connectors', icon: Globe },
    { id: 'INVENTORY', label: 'Data Layers', icon: Layers },
    { id: 'PIPELINES', label: 'Pipeline Ops', icon: Activity },
    { id: 'CONFLICTS', label: 'Conflicts', icon: ShieldAlert, count: 12 },
    { id: 'GRAPH', label: 'Graph', icon: Network },
    { id: 'PLAYGROUND', label: 'Playground', icon: Play },
    { id: 'EMBEDDINGS', label: 'Embeddings', icon: Zap },
    { id: 'GOVERNANCE', label: 'Audit & Lineage', icon: HistoryIcon },
  ];

  const renderContent = () => {
    switch (activeSubTab) {
      case 'FLEET':
        return <FleetOverview />;
      case 'CONNECTORS':
        return <ConnectorManager />;
      case 'INVENTORY':
        return <AssetInventory onSelectAsset={(asset) => setSelectedAsset(asset)} />;
      case 'PIPELINES':
        return <JobCenter />;
      case 'GRAPH':
        return <GraphRAGView />;
      case 'PLAYGROUND':
        return <KnowledgePlayground />;
      case 'CONFLICTS':
        return <ConflictWorkspace />;
      case 'EMBEDDINGS':
        return <EmbeddingManagement />;
      case 'GOVERNANCE':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="section-card space-y-5">
                   <h4 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 text-[#111111]">
                    <ShieldCheck className="w-5 h-5 text-[#2F4F0B]" />
                    Security Baseline
                   </h4>
                   <div className="space-y-2">
                      {['Data Masking', 'PII Detection', 'RBAC Enforcement', 'VPC Isolation'].map(s => (
                        <div key={s} className="flex justify-between items-center px-4 py-2.5 bg-[#FAF6EA] rounded-xl border border-[#BFA66A]">
                           <span className="text-sm text-[#2A2A2A] font-medium">{s}</span>
                           <CheckCircle2 className="w-4 h-4 text-[#2F4F0B]" />
                        </div>
                      ))}
                   </div>
                </div>
                <div className="section-card space-y-5 flex flex-col">
                   <h4 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 text-[#111111]">
                    <HistoryIcon className="w-5 h-5 text-[#8A5A00]" />
                    Audit Logs
                   </h4>
                   <div className="space-y-3 flex-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex gap-3">
                           <div className="w-px bg-[#BFA66A] relative">
                             <div className="absolute top-1 left-[-3px] w-1.5 h-1.5 rounded-full bg-[#8A5A00]" />
                           </div>
                           <div>
                              <div className="text-sm font-semibold text-[#111111]">Artifact Created</div>
                              <div className="text-[11px] text-[#5A5A5A] mt-0.5">Admin performed Batch Ingest • 2h ago</div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
                <div className="section-card space-y-5 flex flex-col">
                   <h4 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 text-[#111111]">
                    <Network className="w-5 h-5 text-[#7C3AED]" />
                    Lineage Control
                   </h4>
                   <button className="flex-1 p-10 bg-[#FAF6EA] border-2 border-dashed border-[#BFA66A] rounded-2xl text-center flex flex-col items-center justify-center group cursor-pointer hover:border-[#8A5A00] hover:bg-[#FFF9E8] transition-all">
                      <Share2 className="w-10 h-10 text-[#8A5A00] mb-3 group-hover:text-[#5A4209] transition-colors" />
                      <div className="text-[12px] font-bold text-[#2A2A2A] uppercase tracking-wide">Initialize Root Lineage Map</div>
                   </button>
                </div>
             </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 h-full">
      <DetailDrawer
        isOpen={showIngestionWizard}
        onClose={() => setShowIngestionWizard(false)}
        title="Knowledge Ingestion"
        subtitle="Multi-stage AI Processing Factory"
        icon={Zap}
        size="wide"
        persistKey="kb-ingest"
      >
        <IngestionWizard 
          onCancel={() => setShowIngestionWizard(false)} 
          onComplete={() => setShowIngestionWizard(false)} 
        />
      </DetailDrawer>

      <DetailDrawer
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        title={selectedAsset?.name || 'Asset Detail'}
        subtitle={`${selectedAsset?.layer} LAYER • ${selectedAsset?.version} • ${selectedAsset?.id}`}
        icon={selectedAsset?.layer === 'GOLD' ? Zap : selectedAsset?.layer === 'SILVER' ? Edit2 : Database}
        size="xwide"
        persistKey="kb-asset-detail"
        tabs={[
          { id: 'PREVIEW', label: 'Preview', icon: Eye },
          { id: 'CHUNKS', label: 'Chunks', icon: Layers },
          { id: 'LOGS', label: 'Logs', icon: Terminal },
          { id: 'TIMELINE', label: 'Timeline', icon: Clock },
          { id: 'GRAPH', label: 'Graph', icon: Network },
        ]}
        activeTab={assetTab}
        onTabChange={(id) => setAssetTab(id as any)}
        footer={
          <div className="flex gap-3">
             <button className="btn-secondary">
                <HistoryIcon className="w-3.5 h-3.5" />
                History
             </button>
             <button
                onClick={() => setShowPromoteWizard(true)}
                className="btn-primary"
             >
                Promote
                <ArrowRight className="w-3.5 h-3.5" />
             </button>
          </div>
        }
      >
        {selectedAsset && (
          <AssetDetailWorkspace 
             document={selectedAsset}
             activeTab={assetTab}
          />
        )}
      </DetailDrawer>

      <DetailDrawer
        isOpen={showPromoteWizard}
        onClose={() => setShowPromoteWizard(false)}
        title="Promote Knowledge Artifact"
        subtitle="Lifecycle State Transition · Bronze → Silver → Gold"
        icon={Sparkles}
        size="wide"
        persistKey="kb-promote"
      >
        <div className="p-6">
           <p className="text-[#2A2A2A] text-sm">Promotion wizard implementation here — select target layer, validate prerequisites, configure embedding refresh, attach approver.</p>
        </div>
      </DetailDrawer>

      <OperationalHeader 
        title="Knowledge Operations"
        subtitle="Global Data Ingestion, Semantic Normalization & Graph Synthesis"
        breadcrumbs={[{ label: 'Knowledge' }, { label: 'Operations' }]}
        status={<StatusBadge status="HEALTHY" size="lg" />}
        actions={
          <div className="flex gap-3">
             <button
              onClick={() => setActiveSubTab('CONNECTORS')}
              className="btn-secondary"
             >
                MANAGE HUB
             </button>
             <button
              onClick={() => setShowIngestionWizard(true)}
              className="btn-primary"
             >
                <Plus className="w-4 h-4" />
                INGEST KNOWLEDGE
             </button>
          </div>
        }
      />

      <StandardMetricsGrid metrics={mainMetrics} />

      {/* Sub-Navigation */}
      <div className="sub-tab-bar max-w-full">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as KnowledgeTabId)}
            className={cn('sub-tab', activeSubTab === tab.id && 'active')}
          >
            <tab.icon className="tab-icon w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {tab.count && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#FAD7D7] text-[#9F1D1D] text-[9px] font-bold border border-[#C94A4A]">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="pb-20"
      >
        {renderContent()}
      </motion.div>
    </div>
  );
};

export default KnowledgeOpsCenter;

