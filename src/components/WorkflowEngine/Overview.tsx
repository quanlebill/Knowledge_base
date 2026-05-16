import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  GitMerge, 
  Play, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical, 
  History, 
  Code, 
  Settings2,
  Rocket,
  Shield,
  LayoutGrid,
  List,
  ExternalLink,
  Copy,
  Archive,
  Ban,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkflowStatus, WorkflowType, Workflow } from '../../types/workflow';
import WorkflowBuilder from './Builder';
import ExecutionCenter from './ExecutionCenter';
import WorkflowTemplates from './Templates';
import SchedulingCenter from './SchedulingCenter';
import WorkflowObservability from './Observability';
import { DetailDrawer } from '../shared/DetailDrawer';

const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Multi-Agent Banking Support',
    type: WorkflowType.MULTI_AGENT,
    tenant: 'Global-Finance',
    project: 'Retail-Banking-AI',
    version: 'v2.4.0',
    status: WorkflowStatus.PUBLISHED,
    lastDeployment: '2h ago',
    lastExecution: '5m ago',
    successRate: 98.2,
    avgDuration: '42s',
    owner: 'Linh Nguyen',
    tags: ['Customer Support', 'Critical', 'Secure'],
    nodes: [],
    edges: []
  },
  {
    id: 'wf-2',
    name: 'GraphRAG Intelligence Sync',
    type: WorkflowType.KB_PIPELINE,
    tenant: 'Smart-City-Nexus',
    project: 'Public-Safety',
    version: 'v1.1.2',
    status: WorkflowStatus.PUBLISHED,
    lastDeployment: '1d ago',
    lastExecution: '12h ago',
    successRate: 99.5,
    avgDuration: '12m',
    owner: 'Sarah Chen',
    tags: ['Knowledge', 'GraphRAG', 'Sync'],
    nodes: [],
    edges: []
  },
  {
    id: 'wf-3',
    name: 'Gov-Compliance Review',
    type: WorkflowType.HUMAN_APPROVAL,
    tenant: 'Gov-Tech-Hanoi',
    project: 'Digital-Identity',
    version: 'v3.0.1-rc',
    status: WorkflowStatus.DORMANT,
    lastDeployment: '5d ago',
    lastExecution: '2d ago',
    successRate: 100,
    avgDuration: '4h',
    owner: 'Dr. Pham',
    tags: ['Legal', 'Human-in-the-loop', 'Privacy'],
    nodes: [],
    edges: []
  }
];

const WorkflowEngine = () => {
  const [activeTab, setActiveTab] = useState<'REGISTRY' | 'BUILDER' | 'EXECUTIONS' | 'TEMPLATES' | 'SCHEDULING' | 'OBSERVABILITY'>('REGISTRY');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showNewWorkflowDrawer, setShowNewWorkflowDrawer] = useState(false);

  const renderTab = () => {
    switch (activeTab) {
      case 'BUILDER': return <WorkflowBuilder onClose={() => setActiveTab('REGISTRY')} workflow={selectedWorkflow} />;
      case 'EXECUTIONS': return <ExecutionCenter />;
      case 'TEMPLATES': return <WorkflowTemplates onUse={(t) => { setSelectedWorkflow(null); setActiveTab('BUILDER'); }} />;
      case 'SCHEDULING': return <SchedulingCenter />;
      case 'OBSERVABILITY': return <WorkflowObservability />;
      default: return renderRegistry();
    }
  };

  const renderRegistry = () => (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden relative">
      <DetailDrawer
        isOpen={showNewWorkflowDrawer}
        onClose={() => setShowNewWorkflowDrawer(false)}
        title="Orchestration Architect"
        subtitle="Provision a new distributed AI workflow"
        icon={GitMerge}
        size="lg"
      >
        <div className="p-8 space-y-8">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Workflow Identity</label>
              <input type="text" placeholder="e.g. Multi-Agent Customer Support" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500" />
           </div>
           
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Starting Point</label>
              <div className="grid grid-cols-2 gap-4">
                 {[
                   { id: 'blank', label: 'Blank Canvas', icon: LayoutGrid, desc: 'Start from scratch' },
                   { id: 'template', label: 'Use Template', icon: Rocket, desc: 'Pick from library' },
                   { id: 'clone', label: 'Clone Existing', icon: Copy, desc: 'Duplicate a workflow' },
                   { id: 'yaml', label: 'Import YAML', icon: Code, desc: 'Upload config-as-code' },
                 ].map(opt => (
                   <div key={opt.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-brand-500/10 hover:border-brand-500/50 cursor-pointer group transition-all">
                      <opt.icon className="w-5 h-5 text-slate-500 group-hover:text-brand-400 mb-3" />
                      <div className="text-xs font-bold text-white mb-1 group-hover:text-brand-400">{opt.label}</div>
                      <div className="text-[10px] text-slate-600">{opt.desc}</div>
                   </div>
                 ))}
              </div>
           </div>

           <button 
             onClick={() => { setShowNewWorkflowDrawer(false); setActiveTab('BUILDER'); }}
             className="w-full py-4 bg-brand-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20"
           >
             Initialize & Build <ArrowRight className="w-4 h-4" />
           </button>
        </div>
      </DetailDrawer>

      {/* Registry Header */}
      <div className="p-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-brand-500/10 rounded-xl">
                <GitMerge className="w-6 h-6 text-brand-400" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Workflow Registry</h1>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl">
              Control plane for enterprise AI orchestration. Manage distributed agents, retrieval pipelines, and human-in-the-loop approval flows.
            </p>
          </div>
          <button 
            onClick={() => setShowNewWorkflowDrawer(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search workflows by name, tenant, or tags..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 transition-all uppercase text-[10px] font-black tracking-widest">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button className="p-2 bg-brand-500 text-white rounded-lg"><LayoutGrid className="w-4 h-4" /></button>
            <button className="p-2 text-slate-500 hover:text-slate-300 transition-colors"><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Registry Table */}
      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        <table className="w-full border-separate border-spacing-y-4">
          <thead>
            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              <th className="px-6 pb-2 text-left">Workflow / Type</th>
              <th className="px-6 pb-2 text-left">Tenant & Environment</th>
              <th className="px-6 pb-2 text-left">Status / Version</th>
              <th className="px-6 pb-2 text-left">Performance</th>
              <th className="px-6 pb-2 text-left">Last Activity</th>
              <th className="px-6 pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_WORKFLOWS.map((wf) => (
              <motion.tr 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={wf.id}
                className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl transition-all"
              >
                <td className="px-6 py-5 first:rounded-l-2xl border-y border-l border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-slate-800 border border-white/10 ${
                      wf.type === WorkflowType.MULTI_AGENT ? 'text-brand-400' :
                      wf.type === WorkflowType.KB_PIPELINE ? 'text-emerald-400' :
                      'text-amber-400'
                    }`}>
                      <GitMerge className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-white font-bold mb-1 hover:text-brand-400 transition-colors cursor-pointer" onClick={() => { setSelectedWorkflow(wf); setActiveTab('BUILDER'); }}>{wf.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{wf.type.replace('_', ' ')}</span>
                        {wf.tags.slice(0, 1).map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-brand-500/10 text-brand-400 rounded-md border border-brand-500/20">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 border-y border-white/5">
                  <div className="text-slate-300 font-medium text-sm">{wf.tenant}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{wf.project}</div>
                </td>
                <td className="px-6 py-5 border-y border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      wf.status === WorkflowStatus.PUBLISHED ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                      wf.status === WorkflowStatus.ERROR ? 'bg-red-500' : 'bg-slate-500'
                    }`} />
                    <span className="text-xs font-bold text-white uppercase tracking-tight">{wf.status}</span>
                  </div>
                  <div className="text-xs text-brand-400 font-mono tracking-tighter">{wf.version}</div>
                </td>
                <td className="px-6 py-5 border-y border-white/5">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-xs font-bold text-white">{wf.successRate}%</div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Success</div>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div>
                      <div className="text-xs font-bold text-white">{wf.avgDuration}</div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Avg Dur</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 border-y border-white/5">
                  <div className="text-xs text-slate-300 font-medium italic">Deployed {wf.lastDeployment}</div>
                  <div className="text-[10px] text-slate-500 font-bold">Executed {wf.lastExecution}</div>
                </td>
                <td className="px-6 py-5 last:rounded-r-2xl border-y border-r border-white/5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white"><Play className="w-4 h-4 text-emerald-400" /></button>
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white"><History className="w-4 h-4 text-brand-400" /></button>
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white"><Code className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tab Switcher */}
      <div className="p-4 border-t border-white/5 bg-slate-900/50 backdrop-blur-md flex justify-center">
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 shadow-2xl">
          {[
            { id: 'REGISTRY', label: 'Registry', icon: List },
            { id: 'BUILDER', label: 'Builder', icon: GitMerge },
            { id: 'EXECUTIONS', label: 'Executions', icon: History },
            { id: 'TEMPLATES', label: 'Templates', icon: Rocket },
            { id: 'SCHEDULING', label: 'Scheduling', icon: Clock },
            { id: 'OBSERVABILITY', label: 'Observability', icon: Settings2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return renderTab();
};

export default WorkflowEngine;
