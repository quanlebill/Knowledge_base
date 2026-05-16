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

type KnowledgeTabId = 'FLEET' | 'CONNECTORS' | 'INVENTORY' | 'PIPELINES' | 'CONFLICTS' | 'GRAPH' | 'PLAYGROUND' | 'EMBEDDINGS' | 'GOVERNANCE';

// Deleted redundant functions and constants below
const KnowledgeOpsCenter = () => {
  const [activeSubTab, setActiveSubTab] = useState<KnowledgeTabId>('FLEET');
  const [showIngestionWizard, setShowIngestionWizard] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<KnowledgeDocument | null>(null);
  const [assetTab, setAssetTab] = useState<'PREVIEW' | 'CHUNKS' | 'LOGS' | 'TIMELINE' | 'GRAPH'>('PREVIEW');
  const [showPromoteWizard, setShowPromoteWizard] = useState(false);

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
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-3 gap-8">
                <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 space-y-6">
                   <h4 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-500" />
                    Security Baseline
                   </h4>
                   <div className="space-y-4">
                      {['Data Masking', 'PII Detection', 'RBAC Enforcement', 'VPC Isolation'].map(s => (
                        <div key={s} className="flex justify-between items-center px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
                           <span className="text-xs text-slate-400">{s}</span>
                           <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                      ))}
                   </div>
                </div>
                <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 space-y-6 flex flex-col">
                   <h4 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <HistoryIcon className="w-5 h-5 text-brand-400" />
                    Audit Logs
                   </h4>
                   <div className="space-y-4 flex-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex gap-4 text-xs">
                           <div className="w-px bg-white/10 relative"><div className="absolute top-1 left-[-4px] w-2 h-2 rounded-full bg-slate-700" /></div>
                           <div>
                              <div className="font-bold text-slate-300">Artifact Created</div>
                              <div className="text-[10px] text-slate-600 mt-0.5">Admin performed Batch Ingest • 2h ago</div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
                <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 space-y-6 flex flex-col">
                   <h4 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Network className="w-5 h-5 text-purple-400" />
                    Lineage Control
                   </h4>
                   <div className="p-10 bg-[#02040d] border border-white/5 rounded-[2.5rem] text-center flex-1 flex flex-col items-center justify-center group cursor-pointer hover:bg-brand-500/[0.02]">
                      <Share2 className="w-10 h-10 text-slate-700 mb-4 group-hover:text-brand-400 transition-colors" />
                      <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Initialize Root Lineage Map</div>
                   </div>
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
        size="lg"
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
        size="xl"
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
             <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-2">
                <HistoryIcon className="w-3.5 h-3.5" />
                History
             </button>
             <button 
                onClick={() => setShowPromoteWizard(true)}
                className="px-5 py-2 bg-brand-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20 flex items-center gap-2"
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
        subtitle="Lifecycle State Transition"
        icon={Sparkles}
        size="md"
      >
        <div className="p-8">
           {/* Reusing wizard content logic from AssetDetailWorkspace but in a simpler form or properly extracted */}
           <p className="text-slate-400 text-sm">Promotion Wizard Implementation Here...</p>
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
              className="px-5 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
             >
                MANAGE HUB
             </button>
             <button 
              onClick={() => setShowIngestionWizard(true)}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-95"
             >
                <Plus className="w-4 h-4" />
                INGEST KNOWLEDGE
             </button>
          </div>
        }
      />

      <StandardMetricsGrid metrics={mainMetrics} />

      {/* Sub-Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-[24px] w-full lg:w-fit overflow-x-auto no-scrollbar shadow-inner">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as KnowledgeTabId)}
            className={cn(
              "flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-xs font-bold transition-all relative shrink-0",
              activeSubTab === tab.id 
                ? "bg-white/10 text-white shadow-xl italic" 
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeSubTab === tab.id ? "text-brand-400" : "text-slate-500")} />
            <span className="uppercase tracking-widest text-[10px] font-black">{tab.label}</span>
            {tab.count && (
              <span className="px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-500 text-[9px] font-black">{tab.count}</span>
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

