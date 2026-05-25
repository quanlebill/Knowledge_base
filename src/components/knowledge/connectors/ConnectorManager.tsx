import React, { useState } from 'react';
import { DetailDrawer } from '../../shared/DetailDrawer';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  RefreshCw, 
  Settings2, 
  ShieldCheck, 
  ExternalLink,
  Table as TableIcon,
  Cloud,
  MessageSquare,
  Globe,
  Database,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Pause,
  Trash2,
  Copy,
  ChevronRight,
  ArrowRight,
  LayoutGrid,
  List,
  Calendar,
  History as HistoryIcon,
  Lock,
  Link as LinkIcon,
  X,
  Shield,
  HardDrive,
  BarChart3,
  Terminal,
  Zap,
  Layers,
  Cpu,
  Monitor,
  Webhook,
  HelpCircle,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import { KBConnector, ConnectorStatus, ConnectorType } from '../../../types';

// --- EXTENDED TYPES ---
type ConnectorCategory = 'CLOUD_STORAGE' | 'SAAS' | 'DATABASE' | 'WEB_API';

interface ConnectorTemplate {
  id: string;
  name: string;
  type: ConnectorType;
  category: string;
  categoryId: ConnectorCategory;
  desc: string;
  status: 'AVAILABLE' | 'BETA' | 'DISABLED';
  popular?: boolean;
}

interface SyncRun {
  id: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  time: string;
  duration: string;
  processed: number;
  errors: number;
}

// --- MOCK DATA ---
const CATEGORIES: { id: ConnectorCategory; label: string; icon: any; count: number; desc: string }[] = [
  { id: 'CLOUD_STORAGE', label: 'Cloud Storage', icon: HardDrive, count: 12, desc: 'S3, Azure Blob, GCS, SFTP and local NAS/SAN clusters.' },
  { id: 'SAAS', label: 'SaaS Apps', icon: Cloud, count: 45, desc: 'SharePoint, Confluence, Slack, Notion, and Google Workspace.' },
  { id: 'DATABASE', label: 'Databases', icon: Database, count: 12, desc: 'PostgreSQL, MySQL, SQL Server, Snowflake, and BigQuery.' },
  { id: 'WEB_API', label: 'Web & API', icon: Globe, count: 8, desc: 'Website crawlers, RSS feeds, REST APIs, and GraphQL endpoints.' },
];

const HUB_TEMPLATES: ConnectorTemplate[] = [
  { id: 't1', name: 'SharePoint', type: 'ENTERPRISE', categoryId: 'SAAS', category: 'Enterprise Docs', desc: 'Secure document sync from SharePoint Online libraries.', status: 'AVAILABLE', popular: true },
  { id: 't2', name: 'PostgreSQL', type: 'DATABASE', categoryId: 'DATABASE', category: 'Structured Data', desc: 'Ingest specific tables or custom query results.', status: 'AVAILABLE', popular: true },
  { id: 't3', name: 'Web Crawler', type: 'WEB', categoryId: 'WEB_API', category: 'Public Info', desc: 'Deep-crawl websites with sitemap support and rate limiting.', status: 'AVAILABLE' },
  { id: 't4', name: 'Confluence', type: 'ENTERPRISE', categoryId: 'SAAS', category: 'Enterprise Wiki', desc: 'Index pages, spaces, and attachments from Atlassian Confluence.', status: 'AVAILABLE' },
  { id: 't5', name: 'Slack Archive', type: 'COMMUNICATION', categoryId: 'SAAS', category: 'Chat', desc: 'Export and index conversation history from specific channels.', status: 'AVAILABLE', popular: true },
  { id: 't6', name: 'S3 Bucket', type: 'DATABASE', categoryId: 'CLOUD_STORAGE', category: 'Cloud Storage', desc: 'Sync files from Amazon S3 with pattern matching.', status: 'AVAILABLE', popular: true },
  { id: 't7', name: 'Snowflake', type: 'DATABASE', categoryId: 'DATABASE', category: 'Warehouse', desc: 'Connect to Snowflake warehouse for enterprise data.', status: 'BETA' },
  { id: 't8', name: 'Google Drive', type: 'ENTERPRISE', categoryId: 'SAAS', category: 'Personal Docs', desc: 'OAuth-based sync for Google Workspace documents.', status: 'AVAILABLE' },
  { id: 't9', name: 'Azure Blob', type: 'DATABASE', categoryId: 'CLOUD_STORAGE', category: 'Cloud Storage', desc: 'Enterprise blob storage synchronization with metadata support.', status: 'AVAILABLE' },
  { id: 't10', name: 'MongoDB', type: 'DATABASE', categoryId: 'DATABASE', category: 'NoSQL', desc: 'Schema-less document ingestion from Atlas or local clusters.', status: 'AVAILABLE' },
  { id: 't11', name: 'Zendesk', type: 'ENTERPRISE', categoryId: 'SAAS', category: 'Support', desc: 'Index tickets, articles, and macros for support AI training.', status: 'AVAILABLE' },
  { id: 't12', name: 'RSS Feed', type: 'WEB', categoryId: 'WEB_API', category: 'Live Updates', desc: 'Continuous monitoring of RSS/Atom feeds for news or updates.', status: 'AVAILABLE' },
];

const CONNECTORS: KBConnector[] = [
  { id: 'c1', name: 'Global SharePoint Site', type: 'ENTERPRISE', status: 'HEALTHY', lastSync: '12m ago', volume: '1.2 TB', health: 98, category: 'Internal Docs' },
  { id: 'c2', name: 'Customer Support Slack', type: 'COMMUNICATION', status: 'SYNCING', lastSync: 'Live', volume: '420 GB', health: 100, category: 'Real-time' },
  { id: 'c3', name: 'Product specs (Notion)', type: 'ENTERPRISE', status: 'ERROR', lastSync: '2d ago', volume: '12 GB', health: 45, category: 'Wiki' },
  { id: 'c4', name: 'Operational DB (PostgreSQL)', type: 'DATABASE', status: 'PAUSED', lastSync: '1w ago', volume: '4.5 TB', health: 80, category: 'Structured' },
  { id: 'c5', name: 'Corporate Website Crawler', type: 'WEB', status: 'HEALTHY', lastSync: '4h ago', volume: '800 MB', health: 92, category: 'Public' },
];

const SYNC_HISTORY: SyncRun[] = [
  { id: 'H-901', status: 'SUCCESS', time: '12m ago', duration: '4m 12s', processed: 1240, errors: 0 },
  { id: 'H-900', status: 'PARTIAL', time: '1h ago', duration: '6m 45s', processed: 890, errors: 12 },
  { id: 'H-899', status: 'FAILED', time: '4h ago', duration: '12s', processed: 0, errors: 1 },
  { id: 'H-898', status: 'SUCCESS', time: '1d ago', duration: '3m 55s', processed: 1102, errors: 0 },
];

// --- COMPONENTS ---

const TypeIcon = ({ type }: { type: ConnectorType }) => {
  switch (type) {
    case 'DOCUMENT': return <FileText className="w-4 h-4" />;
    case 'ENTERPRISE': return <Cloud className="w-4 h-4" />;
    case 'COMMUNICATION': return <MessageSquare className="w-4 h-4" />;
    case 'WEB': return <Globe className="w-4 h-4" />;
    case 'DATABASE': return <Database className="w-4 h-4" />;
    case 'MEDIA': return <Activity className="w-4 h-4" />;
  }
};

const StatusBadge = ({ status }: { status: ConnectorStatus }) => {
  const configs: Record<ConnectorStatus, { color: string, icon: any }> = {
    HEALTHY: { color: 'text-green-500 border-green-500/20 bg-green-500/5', icon: CheckCircle2 },
    SYNCING: { color: 'text-brand-400 border-brand-400/20 bg-brand-400/5 animate-pulse', icon: RefreshCw },
    ERROR: { color: 'text-red-500 border-red-500/20 bg-red-500/5', icon: AlertCircle },
    PAUSED: { color: 'text-slate-500 border-slate-500/20 bg-slate-500/5', icon: Pause },
  };
  const config = configs[status];
  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider", config.color)}>
      <config.icon className="w-3 h-3" />
      {status}
    </div>
  );
};

export const ConnectorManager = ({ onBack }: { onBack?: () => void }) => {
  const [view, setView] = useState<'ACTIVE' | 'HUB' | 'CATEGORY_DETAIL'>('ACTIVE');
  const [showWizard, setShowWizard] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ConnectorCategory | null>(null);
  const [filter, setFilter] = useState<ConnectorType | 'ALL'>('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState<ConnectorTemplate | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<KBConnector | null>(null);
  const [detailTab, setDetailTab] = useState<'OVERVIEW' | 'CONFIG' | 'CREDENTIALS' | 'SCHEDULER' | 'MAPPING' | 'PIPELINE' | 'SYNC_HISTORY' | 'LOGS' | 'ASSETS' | 'AUDIT'>('OVERVIEW');
  const [wizardStep, setWizardStep] = useState(1);

  // --- VIEWS ---

  const ActiveView = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 no-scrollbar pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-[10px] font-black mb-4 uppercase tracking-[0.2em]"
          >
            ← Back to Ops
          </button>
          <div className="flex items-center gap-3 mb-2">
             <div className="p-2.5 bg-brand-500/10 rounded-2xl border border-brand-500/20 text-brand-400">
                <RefreshCw className="w-6 h-6" />
             </div>
             <h1 className="text-3xl lg:text-4xl font-display font-medium tracking-tight italic">Active Connectors</h1>
          </div>
          <p className="text-slate-500 text-sm lg:text-lg">Manage configured enterprise sources and ingestion sync status.</p>
        </div>
        <button 
          onClick={() => setView('HUB')}
          className="w-full lg:w-auto px-6 py-4 lg:py-3 bg-white text-black rounded-2xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10"
        >
          <Plus className="w-5 h-5 font-black" />
          Add Data Source
        </button>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
         <div className="flex gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-2xl overflow-x-auto no-scrollbar">
            {['ALL', 'DATABASE', 'SAAS', 'WEB'].map(cat => (
               <button 
                key={cat}
                onClick={() => setFilter(cat as any)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all whitespace-nowrap",
                  filter === cat ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20" : "text-slate-500 hover:text-white"
                )}
               >
                 {cat}
               </button>
            ))}
         </div>
         <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Search connectors..." 
                 className="bg-white/5 border border-white/10 px-10 py-3 lg:py-2.5 rounded-xl text-xs w-full lg:w-80 focus:outline-none focus:border-brand-500/50 uppercase font-mono"
               />
            </div>
            <button className="p-3 lg:p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-500 hover:text-white flex items-center justify-center">
               <Filter className="w-5 h-5" />
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
         {CONNECTORS.filter(c => filter === 'ALL' || c.type === filter).map(connector => (
            <motion.div 
               layout
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               key={connector.id}
               onClick={() => {
                  setSelectedConnector(connector);
                  setShowDetail(true);
               }}
               className="glass-panel p-8 rounded-[3rem] border-white/5 hover:border-brand-500/30 transition-all group relative overflow-hidden cursor-pointer"
            >
               <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-brand-400 transition-colors">
                     <TypeIcon type={connector.type} />
                  </div>
                  <div className="flex gap-2">
                     <button className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-slate-600 hover:text-slate-300">
                        <Settings2 className="w-5 h-5" />
                     </button>
                  </div>
               </div>

               <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white group-hover:text-brand-400 transition-all tracking-tight">{connector.name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                     <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{connector.category}</span>
                     <span className="text-slate-700 font-black">•</span>
                     <span className="text-[10px] font-mono text-brand-500/80 uppercase tracking-widest">{connector.volume}</span>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                     <StatusBadge status={connector.status} />
                     <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Encrypted</span>
                     </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                     <div className="flex justify-between text-[10px] font-black mb-2 uppercase tracking-widest">
                        <span className="text-slate-500">Resource Health</span>
                        <span className={cn(
                           connector.health > 90 ? "text-green-500" : connector.health > 70 ? "text-amber-500" : "text-red-500"
                        )}>{connector.health}%</span>
                     </div>
                     <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${connector.health}%` }}
                          className={cn(
                             "h-full rounded-full transition-all duration-1000",
                             connector.health > 90 ? "bg-green-500" : connector.health > 70 ? "bg-amber-500" : "bg-red-500"
                          )}
                        />
                     </div>
                  </div>

                  <div className="flex items-center justify-between mt-6">
                     <div className="flex items-center gap-2 text-[10px] text-slate-600 font-black uppercase tracking-widest">
                        <Clock className="w-4 h-4" />
                        SYNC: {connector.lastSync}
                     </div>
                     <button className="p-2.5 bg-white/5 rounded-xl text-slate-500 hover:text-brand-400 transition-all">
                        <RefreshCw className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            </motion.div>
         ))}

         <button 
           onClick={() => setView('HUB')}
           className="h-full min-h-[380px] rounded-[3rem] border-2 border-dashed border-white/5 hover:border-brand-500/40 hover:bg-brand-500/[0.02] flex flex-col items-center justify-center gap-5 group transition-all"
         >
            <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center text-slate-500 group-hover:bg-brand-500/20 group-hover:text-brand-400 transition-all group-hover:scale-110">
               <Plus className="w-10 h-10" />
            </div>
            <div className="text-center">
               <div className="text-xl font-bold text-slate-400 group-hover:text-white transition-colors tracking-tight">Expand Ecosystem</div>
               <div className="text-xs text-slate-600 font-bold uppercase mt-2 tracking-widest">Register New Hub</div>
            </div>
         </button>
      </div>
    </div>
  );

  const HubView = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 no-scrollbar pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <button 
            onClick={() => setView('ACTIVE')}
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-[10px] font-black mb-4 uppercase tracking-[0.2em]"
          >
            ← Back to Active
          </button>
          <div className="flex items-center gap-3 mb-2">
             <div className="p-2.5 bg-brand-500/10 rounded-2xl border border-brand-500/20 text-brand-400">
                <LayoutGrid className="w-6 h-6" />
             </div>
             <h1 className="text-3xl lg:text-4xl font-display font-medium tracking-tight italic">Registry Hub</h1>
          </div>
          <p className="text-slate-500 text-sm lg:text-lg">Browse certified connectors for your enterprise AI ecosystem.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {CATEGORIES.map(cat => (
          <motion.div 
            whileHover={{ scale: 1.02 }}
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              setView('CATEGORY_DETAIL');
            }}
            className="glass-panel p-6 lg:p-8 rounded-[2.5rem] border-white/10 hover:border-brand-500/30 transition-all cursor-pointer group flex flex-col items-center text-center bg-white/[0.01]"
          >
            <div className="w-16 lg:w-20 h-16 lg:h-20 rounded-[1.5rem] lg:rounded-[2rem] bg-white/5 flex items-center justify-center text-slate-500 group-hover:bg-brand-500/20 group-hover:text-brand-400 transition-all mb-6">
              <cat.icon className="w-8 lg:w-10 h-8 lg:h-10" />
            </div>
            <h3 className="text-lg lg:text-xl font-bold text-white mb-3 tracking-tight">{cat.label}</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-6 line-clamp-3">{cat.desc}</p>
            <div className="mt-auto px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest group-hover:bg-brand-500 transition-all">
              {cat.count} AVAILABLE
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-lg lg:text-xl font-bold italic tracking-tight">Recommended for your Stack</h3>
          <button className="text-[10px] font-black text-brand-400 uppercase tracking-widest">View all Templates</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {HUB_TEMPLATES.filter(t => t.popular).map(template => (
             <motion.div 
                whileHover={{ y: -4 }}
                key={template.id}
                className="glass-panel p-6 rounded-3xl border-white/10 flex flex-col h-full group hover:border-brand-500/30 transition-all bg-white/[0.01]"
             >
                <div className="flex justify-between items-start mb-6">
                   <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-brand-400 transition-colors">
                      <TypeIcon type={template.type} />
                   </div>
                   <div className="px-2 py-1 bg-brand-500/10 text-brand-400 text-[8px] font-black uppercase tracking-widest rounded-lg">TRUSTED</div>
                </div>
                <div className="flex-1">
                   <h3 className="text-lg font-bold text-white mb-2">{template.name}</h3>
                   <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-6">{template.desc}</p>
                </div>
                <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                   <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{template.category}</div>
                   <button 
                      onClick={() => {
                         setSelectedTemplate(template);
                         setWizardStep(1);
                         setShowWizard(true);
                      }}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-500 hover:text-white transition-all shadow-xl"
                   >
                      Register
                   </button>
                </div>
             </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const CategoryDetailView = () => {
    const category = CATEGORIES.find(c => c.id === selectedCategory);
    if (!category) return null;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 no-scrollbar pb-20">
        <div className="flex justify-between items-end">
          <div>
            <button 
              onClick={() => setView('HUB')}
              className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-[10px] font-black mb-4 uppercase tracking-[0.2em]"
            >
              ← Back to Registry
            </button>
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2.5 bg-brand-500/10 rounded-2xl border border-brand-500/20 text-brand-400">
                  <category.icon className="w-6 h-6" />
               </div>
               <h1 className="text-3xl lg:text-4xl font-display font-medium tracking-tight italic">{category.label} Registry</h1>
            </div>
            <p className="text-slate-500 text-sm lg:text-lg border-b border-white/5 pb-6">High-performance ingestion connectors for {category.label.toLowerCase()} clusters.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
          <div className="md:col-span-2 lg:col-span-9 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {HUB_TEMPLATES.filter(t => t.categoryId === selectedCategory).map(template => (
                <motion.div 
                  whileHover={{ y: -4 }}
                  key={template.id}
                  className="glass-panel p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] border-white/10 flex flex-col group hover:border-brand-500/30 transition-all bg-white/[0.01]"
                >
                  <div className="flex justify-between items-start mb-8 lg:mb-10">
                    <div className="w-12 lg:w-16 h-12 lg:h-16 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-brand-400 transition-colors">
                      <TypeIcon type={template.type} />
                    </div>
                    {template.popular && (
                      <div className="px-3 py-1.5 bg-brand-500/10 text-brand-400 text-[10px] font-black uppercase tracking-widest rounded-xl">Favorite</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 tracking-tight">{template.name}</h3>
                    <p className="text-[11px] lg:text-sm text-slate-500 leading-relaxed mb-8 lg:mb-10">{template.desc}</p>
                  </div>
                  <div className="pt-6 lg:pt-8 border-t border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                       <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Auth Support</span>
                          <span className="text-[10px] font-bold text-slate-400">OAuth, SAML, Vault</span>
                       </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedTemplate(template);
                        setWizardStep(1);
                        setShowWizard(true);
                      }}
                      className="px-6 py-3 bg-white text-black rounded-xl lg:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-xl"
                    >
                      Provision
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-3 space-y-8">
             <div className="glass-panel p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] border-white/5 bg-brand-500/[0.02]">
                <h4 className="text-[11px] lg:text-sm font-bold flex items-center gap-2 mb-6 uppercase tracking-widest italic">
                   <Activity className="w-4 h-4 text-brand-400" />
                   Category Health
                </h4>
                <div className="space-y-6">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-[0.1em]">Success Rate</span>
                      <span className="text-green-500 font-mono font-bold tracking-tighter">99.8%</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-[0.1em]">Active Nodes</span>
                      <span className="text-white font-mono font-bold tracking-tighter">1,240</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-[0.1em]">Total Volume</span>
                      <span className="text-brand-400 font-mono font-bold tracking-tighter">4.2 PB</span>
                   </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/5">
                   <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Top Metadata Fields</h5>
                   <div className="flex flex-wrap gap-2">
                      {['owner_id', 'dept_scope', 'security_level', 'archived'].map(tag => (
                         <span key={tag} className="px-2 py-1 bg-white/5 rounded-lg text-[9px] font-mono text-slate-500">{tag}</span>
                      ))}
                   </div>
                </div>
             </div>

             <div className="glass-panel p-8 rounded-[2.5rem] border-white/5">
                <h4 className="text-sm font-bold flex items-center gap-2 mb-6 uppercase tracking-widest">
                   <HelpCircle className="w-4 h-4 text-slate-500" />
                   Documentation
                </h4>
                <div className="space-y-4">
                   {['Configuration Guide', 'Security Policy', 'Mapping Reference'].map(doc => (
                      <button key={doc} className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        {doc}
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const WizardView = () => {
    const steps = [
      'Identification',
      'Authentication',
      'Source Scope',
      'Extraction Rules',
      'Pipeline Meta',
      'Scheduler',
      'Review'
    ];

    const renderStepContent = () => {
      const categoryId = selectedTemplate?.categoryId;

      switch (wizardStep) {
        case 1: // Identification
          return (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Connector Display Name</label>
                    <input 
                      type="text" 
                      placeholder={`e.g. Master ${selectedTemplate?.name}`}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-brand-500/50" 
                    />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Environment Stage</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-brand-500/50">
                       <option>Production (Stable)</option>
                       <option>Stage / UAT</option>
                       <option>Sandbox</option>
                    </select>
                 </div>
              </div>
              <div className="p-8 bg-brand-500/5 border border-brand-500/10 rounded-[2rem]">
                 <h4 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <Shield className="w-4 h-4 text-brand-400" />
                    Security Baseline
                 </h4>
                 <p className="text-xs text-slate-500 mb-6 font-medium">Connector will be deployed in a hardened VPC with zero-trust egress policies.</p>
                 <div className="grid grid-cols-3 gap-4">
                    {['FIPS 140-2', 'SOC2 Compliant', 'AES-256 GCM'].map((feat) => (
                       <div key={feat} className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col items-center text-center">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mb-2" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{feat}</span>
                       </div>
                    ))}
                 </div>
              </div>
            </motion.div>
          );
        case 2: // Authentication
          return (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="space-y-6">
                 {categoryId === 'CLOUD_STORAGE' && (
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Key ID</label>
                         <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" placeholder="AKIA..." />
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Secret Access Key</label>
                         <input type="password" underline="true" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" placeholder="••••••••••••" />
                      </div>
                      <div className="col-span-2 p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-4">
                        <AlertCircle className="w-5 h-5 text-amber-500 mt-1" />
                        <div className="text-xs text-amber-200/70 leading-relaxed italic">
                          Recommended: Use IAM Role-based authentication via Managed Identity for production workloads.
                        </div>
                      </div>
                   </div>
                 )}
                 {categoryId === 'SAAS' && (
                   <div className="space-y-8">
                      <div className="p-10 bg-white/5 border border-white/10 rounded-[3rem] text-center space-y-6">
                        <div className="w-20 h-20 bg-brand-500/20 rounded-[2rem] mx-auto flex items-center justify-center">
                           <Lock className="w-8 h-8 text-brand-400" />
                        </div>
                        <div>
                           <h4 className="text-xl font-bold">OAuth 2.0 Authorization</h4>
                           <p className="text-sm text-slate-500 mt-2">Grant the platform access to your {selectedTemplate?.name} workspace.</p>
                        </div>
                        <button className="px-12 py-4 bg-brand-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-brand-500/20 hover:scale-105 transition-all">
                           Authorize with {selectedTemplate?.name}
                        </button>
                      </div>
                   </div>
                 )}
                 {categoryId === 'DATABASE' && (
                   <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Connection String (URI)</label>
                        <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white font-mono focus:outline-none" placeholder="postgresql://user:pass@host:port/db" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">SSL Mode</label>
                        <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white">
                           <option>Verify-full</option>
                           <option>Verify-ca</option>
                           <option>Require</option>
                           <option>Disable</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">SSH Tunnel</label>
                        <div className="flex items-center gap-4 py-4 px-6 bg-white/5 border border-white/10 rounded-2xl">
                           <span className="text-xs text-slate-500">Enable SSH Tunneling</span>
                           <div className="w-10 h-6 bg-slate-800 rounded-full ml-auto cursor-pointer" />
                        </div>
                      </div>
                   </div>
                 )}
                 {categoryId === 'WEB_API' && (
                   <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Authentication Method</label>
                        <div className="grid grid-cols-2 gap-4">
                           {['API Key (Header)', 'Bearer Token', 'Basic Auth', 'None'].map(m => (
                             <button key={m} className="p-4 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all text-left">{m}</button>
                           ))}
                        </div>
                      </div>
                      <div className="space-y-3 pt-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Token / Key Value</label>
                        <input type="password" underline="true" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" placeholder="Bearer eyJhbGci..." />
                      </div>
                   </div>
                 )}
                 <div className="pt-8 flex gap-4">
                    <button className="flex-1 py-4 bg-white/10 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-all border border-white/5">
                       <Zap className="w-4 h-4 text-brand-400" />
                       Test Credential Integrity
                    </button>
                    <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400">
                       Validate
                    </button>
                 </div>
              </div>
            </motion.div>
          );
        case 3: // Source Scope
          return (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               {categoryId === 'CLOUD_STORAGE' && (
                 <div className="space-y-8 text-left">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Bucket / Container Name</label>
                       <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" placeholder="e.g. enterprise-raw-data-prod" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Region</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" placeholder="us-east-1" />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Folder Prefix (Optional)</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" placeholder="/docs/internal" />
                       </div>
                    </div>
                    <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <Layers className="w-5 h-5 text-slate-400" />
                          <span className="text-xs font-bold text-slate-300">Recursive Scanning</span>
                       </div>
                       <div className="w-12 h-6 bg-brand-500 rounded-full flex items-center justify-end px-1 shadow-lg shadow-brand-500/20">
                          <div className="w-4 h-4 bg-white rounded-full" />
                       </div>
                    </div>
                 </div>
               )}
               {categoryId === 'SAAS' && (
                 <div className="space-y-6 text-left">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Resources to Synchronize</label>
                    <div className="space-y-4">
                       {[1, 2, 3].map(siteIdx => (
                          <div key={`site-${siteIdx}`} className="p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-6 group hover:bg-white/10 transition-all cursor-pointer">
                             <div className="w-5 h-5 rounded border border-white/30 flex items-center justify-center text-white font-black group-hover:border-brand-500 transition-all">
                                {siteIdx === 1 && <CheckCircle2 className="w-4 h-4 text-brand-400" />}
                             </div>
                             <div className="flex-1">
                                <div className="text-sm font-bold text-white tracking-tight">Enterprise Content Library {siteIdx}</div>
                                <div className="text-[10px] text-slate-500 uppercase mt-1">/sites/global-{siteIdx}/shared-documents</div>
                             </div>
                             <div className="flex items-center gap-4">
                                <span className="text-[10px] font-mono text-slate-600">4.2 GB</span>
                                <ExternalLink className="w-4 h-4 text-slate-700" />
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
               )}
               {categoryId === 'DATABASE' && (
                 <div className="space-y-8 text-left">
                    <div className="flex justify-between items-end border-b border-white/5 pb-4">
                       <h4 className="text-sm font-bold uppercase tracking-widest">Table Selection</h4>
                       <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Catalog: PUBLIC</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                       {['users', 'orders', 'products', 'inventory', 'customer_feedback', 'service_logs', 'meta_store'].map(table => (
                          <div key={table} className="p-6 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-brand-500/30 transition-all cursor-pointer group">
                             <div className="w-4 h-4 rounded border border-white/10 flex items-center justify-center group-hover:border-brand-500">
                                {table === 'customer_feedback' && <div className="w-2 h-2 bg-brand-400 rounded-sm" />}
                             </div>
                             <div className="flex-1">
                                <span className={cn("text-xs font-mono", table === 'customer_feedback' ? "text-brand-400" : "text-slate-400")}>{table}</span>
                                <div className="text-[9px] text-slate-600 mt-1 uppercase">12.4k rows</div>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
               )}
               {categoryId === 'WEB_API' && (
                  <div className="space-y-8 text-left">
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Start URL / Endpoint Path</label>
                        <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" placeholder="https://docs.enterprise.com/v1" />
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Crawl Depth</label>
                           <input type="number" defaultValue={2} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Max Pages</label>
                           <input type="number" defaultValue={2000} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" />
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        {['Respect robots.txt', 'Render JavaScript', 'Follow External Links', 'Capture Images'].map(rule => (
                           <div key={rule} className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{rule}</span>
                              <div className="w-8 h-4 bg-slate-800 rounded-full" />
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </motion.div>
          );
        case 4: // Extraction Rules / Logic
          return (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 text-left">
               <div className="p-8 bg-brand-500/5 border border-brand-500/10 rounded-[2.5rem]">
                  <div className="flex justify-between items-center mb-10">
                     <div>
                        <h4 className="text-lg font-bold">Intelligent Parsing Pipeline</h4>
                        <p className="text-xs text-slate-500 mt-1">Configure advanced content extraction logic.</p>
                     </div>
                     <Zap className="w-8 h-8 text-brand-400 animate-pulse" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10 pb-3">Doc-to-Text Strategy</h5>
                        {[
                           { name: 'Native PDF Parsing', desc: 'Fast, text-layer based' },
                           { name: 'OCR (Neural)', desc: 'High-cost, for scans' },
                           { name: 'Layout Aware', desc: 'Preserves tables/columns' },
                        ].map((s, idx) => (
                           <div key={s.name} className={cn("p-4 rounded-2xl border transition-all cursor-pointer", idx === 2 ? "bg-brand-500 border-brand-500" : "bg-white/5 border-white/5")}>
                              <div className="text-xs font-bold">{s.name}</div>
                              <div className={cn("text-[9px] mt-1 italic", idx === 2 ? "text-brand-100" : "text-slate-500")}>{s.desc}</div>
                           </div>
                        ))}
                     </div>
                     <div className="space-y-6">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10 pb-3">File Discovery</h5>
                        <div className="flex flex-wrap gap-2">
                           {['PDF', 'DOCX', 'XLSX', 'CSV', 'PPTX', 'PNG', 'JPG', 'MD'].map(ext => (
                              <div key={ext} className="px-3 py-1.5 bg-brand-500/20 text-brand-400 rounded-lg text-[10px] font-mono font-bold border border-brand-500/30">.{ext}</div>
                           ))}
                        </div>
                        <div className="space-y-3 pt-4">
                           <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Max File Size (MB)</label>
                           <input type="range" className="w-full accent-brand-500" />
                           <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-tighter">
                              <span>1 MB</span>
                              <span>100 MB</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </motion.div>
          );
        case 5: // Pipeline Meta
          return (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 text-left">
               <div className="space-y-6">
                  <h4 className="text-sm font-bold uppercase tracking-widest border-b border-white/5 pb-4">Injected Metadata Schema</h4>
                  <div className="grid grid-cols-2 gap-4">
                     {[
                        { key: 'source_app', val: selectedTemplate?.name },
                        { key: 'dept_owner', val: 'Engineering' },
                        { key: 'security_clearance', val: 'Internal' },
                        { key: 'ingest_job_id', val: 'UUID_AUTO' },
                     ].map((meta) => (
                        <div key={meta.key} className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/5">
                           <input type="text" defaultValue={meta.key} className="bg-transparent text-[10px] font-mono text-brand-400 w-1/2 focus:outline-none" />
                           <div className="h-4 w-px bg-white/10" />
                           <input type="text" defaultValue={meta.val} className="bg-transparent text-[10px] font-mono text-slate-400 w-1/2 focus:outline-none" />
                        </div>
                     ))}
                  </div>
                  <button className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white transition-all uppercase tracking-widest mt-4">
                     <Plus className="w-4 h-4" /> Add Custom Tag
                  </button>
               </div>
               <div className="p-8 bg-brand-500/5 rounded-[2.5rem] border border-brand-500/10">
                  <h4 className="text-sm font-bold flex items-center gap-2 mb-4 hover:text-brand-400 transition-colors">
                     <Cpu className="w-4 h-4" />
                     Post-Ingest Enrichment
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                     {['Auto-Topic Tagging', 'Sentiment Scoring', 'Entity Extraction', 'PII Redaction'].map(feat => (
                        <div key={feat} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                           <span className="text-xs text-slate-400">{feat}</span>
                           <div className="w-8 h-4 bg-brand-500/20 rounded-full" />
                        </div>
                     ))}
                  </div>
               </div>
            </motion.div>
          );
        case 6: // Scheduler
          return (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 text-left">
                  <div className="grid grid-cols-3 gap-6">
                    {['Manual', 'Scheduled', 'Event-Based'].map((mode, i) => (
                       <button key={mode} className={cn(
                          "p-8 rounded-[2.5rem] border transition-all space-y-4 flex flex-col items-center",
                          i === 1 ? "bg-brand-500 border-brand-500 shadow-xl shadow-brand-500/20" : "bg-white/5 border-white/5 text-slate-500"
                       )}>
                          <Calendar className="w-8 h-8" />
                          <span className="text-xs font-black uppercase tracking-widest">{mode}</span>
                       </button>
                    ))}
                 </div>
               <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-white/[0.02] space-y-8">
                  <div className="flex justify-between items-center mb-4">
                     <h4 className="text-lg font-bold">Schedule Configuration</h4>
                     <Clock className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest underline decoration-brand-500 decoration-2 underline-offset-4">Sync Frequency</label>
                        <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white">
                           <option>Every Hour</option>
                           <option>Daily at 00:00 UTC</option>
                           <option>Weekly (Sundays)</option>
                           <option>Continuous (CDC)</option>
                        </select>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest underline decoration-brand-500 decoration-2 underline-offset-4">Incremental Logic</label>
                        <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white">
                           <option>Sync New & Updated</option>
                           <option>Full Overwrite Refresh</option>
                           <option>Appends Only</option>
                        </select>
                     </div>
                  </div>
                  <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-center gap-4">
                     <HistoryIcon className="w-5 h-5 text-amber-500" />
                     <p className="text-xs text-amber-200/60 leading-relaxed italic">
                        Warning: High-frequency sync targets may impact source performance. Monitor API rate limits.
                     </p>
                  </div>
               </div>
            </motion.div>
          );
        case 7: // Review
          return (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-10">
               <div className="grid grid-cols-12 gap-8 text-left">
                  <div className="col-span-12 space-y-4">
                     <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Connectivity Review</h4>
                     <div className="p-8 bg-white/5 border border-white/10 rounded-[3rem] grid grid-cols-3 gap-10">
                        <div className="space-y-2">
                           <div className="text-[10px] font-black text-slate-600 uppercase">Provider</div>
                           <div className="text-lg font-bold text-brand-400 capitalize">{selectedTemplate?.name}</div>
                        </div>
                        <div className="space-y-2">
                           <div className="text-[10px] font-black text-slate-600 uppercase">Scope</div>
                           <div className="text-lg font-bold text-white truncate">global-internal-v2</div>
                        </div>
                        <div className="space-y-2">
                           <div className="text-[10px] font-black text-slate-600 uppercase">Security</div>
                           <div className="text-lg font-bold text-green-500 flex items-center gap-2">
                              <ShieldCheck className="w-5 h-5" /> TIER-0
                           </div>
                        </div>
                     </div>
                  </div>
                  <div className="col-span-8">
                     <div className="p-8 bg-brand-500/5 border border-brand-500/10 rounded-[3rem] h-full flex flex-col justify-center text-center space-y-6">
                        <div className="w-20 h-20 bg-brand-500/10 rounded-full mx-auto flex items-center justify-center border border-brand-500/30">
                           <RefreshCw className="w-10 h-10 text-brand-400 animate-spin-slow" />
                        </div>
                        <div>
                           <h4 className="text-2xl font-display font-medium">Ready for Ingress</h4>
                           <p className="text-sm text-slate-500 mt-2">Est. Initial Load: 4.2 PB • 12,400 Nodes</p>
                        </div>
                     </div>
                  </div>
                  <div className="col-span-4 space-y-4">
                     <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auto-Scale</div>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                     </div>
                     <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monitoring</div>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                     </div>
                     <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lineage Tracking</div>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                     </div>
                  </div>
               </div>
               <div className="p-6 bg-brand-500/10 border border-brand-500/20 rounded-[2rem] text-center italic text-xs text-brand-300">
                  By clicking "Deploy", you authorize the platform to establish a persistent egress tunnel and begin automated knowledge indexing.
               </div>
            </motion.div>
          );
        default:
          return null;
      }
    };

    return (
      <div className="max-w-4xl mx-auto space-y-8 lg:space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20 no-scrollbar">
         <div className="flex justify-between items-center bg-[#02040d] lg:bg-transparent p-4 lg:p-0 rounded-2xl border border-white/5 lg:border-none">
            <button 
              onClick={() => setView('HUB')}
              className="p-2 lg:p-3 bg-white/5 rounded-xl lg:rounded-2xl text-slate-500 hover:text-white transition-all"
            >
              <X className="w-5 lg:w-6 h-5 lg:h-6" />
            </button>
            <div className="flex items-center gap-3">
               {steps.map((label, i) => {
                  const s = i + 1;
                  return (
                    <div key={s} className="flex items-center gap-3">
                       <div 
                        title={label}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black transition-all cursor-help",
                          wizardStep === s ? "bg-brand-500 text-white shadow-xl shadow-brand-500/20 scale-110" : 
                          wizardStep > s ? "bg-green-500/20 text-green-500" : "bg-white/5 text-slate-600"
                       )}>
                          {wizardStep > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                       </div>
                       {s < steps.length && <div className="w-4 h-px bg-white/10" />}
                    </div>
                  );
               })}
            </div>
            <div className="w-12" />
         </div>

         <div className="text-center px-4">
            <div className="text-[9px] lg:text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] mb-2 lg:mb-3">
              Step {wizardStep} of {steps.length}: {steps[wizardStep - 1]}
            </div>
            <h2 className="text-2xl lg:text-4xl font-display font-medium tracking-tight bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent italic">
              Registering {selectedTemplate?.name}
            </h2>
         </div>

         <div className="glass-panel p-6 lg:p-12 rounded-[2rem] lg:rounded-[3.5rem] border-white/5 bg-[#02040d] relative overflow-hidden mx-4 lg:mx-0">
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/[0.03] blur-[100px]" />
            
            <div className="min-h-[300px] lg:min-h-[400px]">
               {renderStepContent()}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 lg:gap-6 mt-12 lg:mt-16 relative z-10">
               {wizardStep > 1 && (
                  <button 
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="w-full sm:w-auto px-10 py-4 bg-white/5 border border-white/10 rounded-xl lg:rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all order-2 sm:order-1"
                  >
                     Previous
                  </button>
               )}
               <button 
                 onClick={() => {
                    if (wizardStep < steps.length) setWizardStep(wizardStep + 1);
                    else {
                       setView('ACTIVE');
                    }
                 }}
                 className={cn(
                    "flex-1 py-4 rounded-xl lg:rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl order-1 sm:order-2",
                    wizardStep === steps.length ? "bg-green-500 text-black shadow-green-500/40" : "bg-brand-500 text-white shadow-brand-500/40"
                 )}
               >
                  {wizardStep === steps.length ? 'Finalize & Deploy Connectivity' : 'Establish Handshake'}
               </button>
            </div>
         </div>
      </div>
    );
  };

  const DetailViewContent = () => {
    const tabs = [
      { id: 'OVERVIEW', label: 'Overview', icon: LayoutGrid },
      { id: 'CONFIG', label: 'Configuration', icon: Settings2 },
      { id: 'CREDENTIALS', label: 'Credentials', icon: Lock },
      { id: 'SCHEDULER', label: 'Scheduler', icon: Calendar },
      { id: 'MAPPING', label: 'Schema Mapping', icon: Layers },
      { id: 'PIPELINE', label: 'Processing Pipeline', icon: Cpu },
      { id: 'SYNC_HISTORY', label: 'Sync History', icon: HistoryIcon },
      { id: 'LOGS', label: 'Execution Logs', icon: Terminal },
      { id: 'ASSETS', label: 'Affected Assets', icon: FileText },
      { id: 'AUDIT', label: 'Audit Trail', icon: Shield },
    ];

    return (
      <div className="space-y-8 h-full">
         <div className="grid grid-cols-12 gap-8 h-full">
            <div className="col-span-12 overflow-y-auto custom-scrollbar pr-4">
               <AnimatePresence mode="wait">
                  {detailTab === 'OVERVIEW' && (
                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key="overview" className="space-y-8">
                        <div className="grid grid-cols-3 gap-6">
                           <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01]">
                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ingestion Health</div>
                              <div className="text-3xl font-display font-medium text-green-500">99.8%</div>
                              <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
                                 <div className="h-full w-[99.8%] bg-green-500" />
                              </div>
                           </div>
                           <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01]">
                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Last Sync Volume</div>
                              <div className="text-3xl font-display font-medium text-white">42.8 GB</div>
                              <div className="text-[10px] text-slate-600 font-bold mt-2 uppercase tracking-tight">12,402 Documents Ingested</div>
                           </div>
                           <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01]">
                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Operational Status</div>
                              <div className="flex items-center gap-2 mt-2">
                                 <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                 <span className="text-xl font-bold text-white uppercase tracking-tighter">Healthy Node</span>
                              </div>
                           </div>
                        </div>

                        <div className="glass-panel p-10 rounded-[3.5rem] border-white/5 bg-[#010310] relative overflow-hidden h-[360px]">
                           <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 blur-[120px]" />
                           <div className="flex justify-between items-center mb-10 relative z-10">
                              <div>
                                 <h3 className="text-xl font-bold flex items-center gap-2 mb-1">
                                    <BarChart3 className="w-5 h-5 text-brand-400" />
                                    Synchronized Records Trend
                                 </h3>
                                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Historical Volume (Last 30 Syncs)</p>
                              </div>
                           </div>
                           <div className="flex items-end justify-between h-[180px] gap-2 px-10 relative z-10">
                              {[40, 60, 35, 90, 45, 80, 55, 70, 40, 65, 85, 45, 70, 50, 90].map((h, i) => (
                                 <motion.div 
                                    key={`sync-bar-${i}`} 
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ delay: i * 0.03 }}
                                    className="flex-1 min-w-[12px] bg-brand-500/20 border-t-2 border-brand-500 hover:bg-brand-500 hover:scale-x-125 transition-all cursor-pointer rounded-t-sm" 
                                 />
                              ))}
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                           <div className="glass-panel p-8 rounded-[2.5rem] border-white/5">
                              <h4 className="text-sm font-bold flex items-center gap-2 mb-6 uppercase tracking-widest">
                                 <HistoryIcon className="w-4 h-4 text-brand-400" />
                                 Recent Sync Runs
                              </h4>
                              <div className="space-y-4">
                                 {SYNC_HISTORY.map(run => (
                                    <div key={run.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
                                       <div className="flex items-center gap-4">
                                          <div className={cn("w-2 h-2 rounded-full", run.status === 'SUCCESS' ? "bg-green-500" : "bg-red-500")} />
                                          <div>
                                             <div className="text-xs font-bold text-white uppercase tracking-widest">{run.id}</div>
                                             <div className="text-[10px] text-slate-600 font-mono mt-0.5">{run.time} • {run.duration}</div>
                                          </div>
                                       </div>
                                       <div className="text-right">
                                          <div className="text-xs font-bold text-slate-400">{run.processed} items</div>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                           <div className="glass-panel p-8 rounded-[2.5rem] border-white/5">
                              <h4 className="text-sm font-bold flex items-center gap-2 mb-6 uppercase tracking-widest">
                                 <Shield className="w-4 h-4 text-brand-400" />
                                 Security Oversight
                              </h4>
                              <div className="space-y-6">
                                 <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl flex items-center gap-4">
                                    <ShieldCheck className="w-5 h-5 text-green-500" />
                                    <div className="text-[10px] font-bold text-green-500/80 uppercase">No Security breaches detected. Access policy stable.</div>
                                 </div>
                                 <div className="space-y-4">
                                    {[
                                       { lab: 'Encryption', val: 'AES-256 GCM' },
                                       { lab: 'VPC Tunnel', val: 'ESTABLISHED' },
                                       { lab: 'Auth Managed', val: 'Cloud Vault' },
                                    ].map(s => (
                                       <div key={s.lab} className="flex justify-between items-center px-4">
                                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{s.lab}</span>
                                          <span className="text-xs text-white font-mono">{s.val}</span>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </div>
                     </motion.div>
                  )}

                  {detailTab === 'CONFIG' && (
                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key="config" className="space-y-8">
                        <div className="glass-panel p-10 rounded-[3rem] border-white/5 space-y-8">
                           <div className="flex justify-between items-center">
                              <h3 className="text-2xl font-bold tracking-tight">Deployment Configuration</h3>
                              <button className="px-6 py-3 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest">Save Changes</button>
                           </div>
                           <div className="grid grid-cols-2 gap-8">
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest underline decoration-brand-500 decoration-2 underline-offset-4">Instance Identity</label>
                                 <input type="text" defaultValue={selectedConnector?.name} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" />
                              </div>
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest underline decoration-brand-500 decoration-2 underline-offset-4">Deployment Environment</label>
                                 <input type="text" readOnly value="Production (High Availability)" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-slate-500 focus:outline-none" />
                              </div>
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest underline decoration-brand-500 decoration-2 underline-offset-4">Sync Scope (Root)</label>
                                 <input type="text" defaultValue="https://sharepoint.com/sites/corp-hub" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-mono text-brand-400 focus:outline-none" />
                              </div>
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest underline decoration-brand-500 decoration-2 underline-offset-4">Max Concurrent Streams</label>
                                 <input type="number" defaultValue="32" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none" />
                              </div>
                           </div>
                        </div>
                     </motion.div>
                  )}

                  {detailTab === 'SYNC_HISTORY' && (
                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key="history" className="space-y-8">
                        <div className="glass-panel rounded-[3rem] overflow-hidden border-white/5 bg-white/[0.01]">
                          <div className="p-8 border-b border-white/10 flex justify-between items-center">
                             <h3 className="text-xl font-bold flex items-center gap-2">
                                <HistoryIcon className="w-5 h-5 text-slate-400" />
                                Sync Lifecycle Execution History
                             </h3>
                             <div className="flex gap-2">
                                <button className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-slate-500 hover:text-white">
                                   <Filter className="w-5 h-5" />
                                </button>
                                <button className="p-2.5 bg-brand-500/20 border border-brand-500/30 rounded-xl text-brand-400">
                                   <RefreshCw className="w-5 h-5" />
                                </button>
                             </div>
                          </div>
                          <div className="overflow-x-auto">
                             <table className="w-full text-left">
                                <thead className="bg-white/[0.03] text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                   <tr>
                                      <th className="px-8 py-6">Session ID</th>
                                      <th className="px-6 py-6">Status</th>
                                      <th className="px-6 py-6">Inception</th>
                                      <th className="px-6 py-6">Latency</th>
                                      <th className="px-6 py-6">Records Total</th>
                                      <th className="px-8 py-6 text-right">Diagnostic</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-xs">
                                   {SYNC_HISTORY.map(run => (
                                      <tr key={run.id} className="group hover:bg-white/[0.02] transition-all">
                                         <td className="px-8 py-6">
                                            <div className="font-mono text-slate-300 font-bold tracking-widest">{run.id}</div>
                                         </td>
                                         <td className="px-6 py-6">
                                            <div className={cn(
                                               "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase w-fit tracking-tighter",
                                               run.status === 'SUCCESS' ? 'text-green-500 border-green-500/20 bg-green-500/5' :
                                               run.status === 'PARTIAL' ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' :
                                               'text-red-500 border-red-500/20 bg-red-500/5'
                                            )}>
                                               {run.status === 'SUCCESS' && <CheckCircle2 className="w-3 h-3" />}
                                               {run.status}
                                            </div>
                                         </td>
                                         <td className="px-6 py-6 text-slate-500 font-medium">{run.time}</td>
                                         <td className="px-6 py-6 text-slate-500 font-mono italic">{run.duration}</td>
                                         <td className="px-6 py-6">
                                            <div className="flex items-center gap-2">
                                               <span className="font-bold text-slate-100">{run.processed.toLocaleString()}</span>
                                               {run.errors > 0 && <span className="text-[10px] text-red-500 font-black px-1.5 py-0.5 bg-red-500/10 rounded">ERROR {run.errors}</span>}
                                            </div>
                                         </td>
                                         <td className="px-8 py-6 text-right">
                                            <button className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all">
                                               Trace
                                            </button>
                                         </td>
                                      </tr>
                                   ))}
                                </tbody>
                             </table>
                          </div>
                        </div>
                     </motion.div>
                  )}

                  {/* Fallback for other tabs */}
                  {!['OVERVIEW', 'CONFIG', 'SYNC_HISTORY'].includes(detailTab) && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[500px] text-center space-y-6">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center text-slate-700 animate-pulse">
                           {tabs.find(t => t.id === detailTab)?.icon && React.createElement(tabs.find(t => t.id === detailTab)!.icon, { className: "w-10 h-10" })}
                        </div>
                        <div>
                           <h3 className="text-2xl font-bold uppercase tracking-tight text-white/40">{detailTab.replace('_', ' ')} Workstation</h3>
                           <p className="text-slate-600 mt-2 text-sm max-w-xs">Specific workstation interface for the {selectedConnector?.type.toLowerCase()} connectivity protocol.</p>
                        </div>
                        <button className="px-8 py-3 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-500 hover:text-white transition-all shadow-xl">
                           Initialize Access
                        </button>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>
         </div>
      </div>
    );
  };

  return (
    <div className="h-full">
       <AnimatePresence mode="wait">
          {view === 'ACTIVE' && <ActiveView key="active" />}
          {view === 'HUB' && <HubView key="hub" />}
          {view === 'CATEGORY_DETAIL' && <CategoryDetailView key="category" />}
       </AnimatePresence>

       {/* Wizard Drawer */}
       <DetailDrawer
         isOpen={showWizard}
         onClose={() => setShowWizard(false)}
         title={`Register ${selectedTemplate?.name || 'Connector'}`}
         subtitle="Enterprise Data Handshake Wizard"
         icon={Plus}
         size="lg"
       >
         <WizardView />
       </DetailDrawer>

       {/* Detail Drawer */}
       <DetailDrawer
         isOpen={showDetail}
         onClose={() => setShowDetail(false)}
         title={selectedConnector?.name || 'Connector Detail'}
         subtitle={`${selectedConnector?.type} CONNECTOR NODE`}
         icon={Activity}
         size="xl"
         tabs={[
            { id: 'OVERVIEW', label: 'Overview', icon: LayoutGrid },
            { id: 'CONFIG', label: 'Configuration', icon: Settings2 },
            { id: 'CREDENTIALS', label: 'Credentials', icon: Lock },
            { id: 'SCHEDULER', label: 'Scheduler', icon: Calendar },
            { id: 'MAPPING', label: 'Schema Mapping', icon: Layers },
            { id: 'PIPELINE', label: 'Processing Pipeline', icon: Cpu },
            { id: 'SYNC_HISTORY', label: 'Sync History', icon: HistoryIcon },
            { id: 'LOGS', label: 'Execution Logs', icon: Terminal },
            { id: 'ASSETS', label: 'Affected Assets', icon: FileText },
            { id: 'AUDIT', label: 'Audit Trail', icon: Shield },
         ]}
         activeTab={detailTab}
         onTabChange={(id) => setDetailTab(id as any)}
         footer={
            <div className="flex gap-3">
               <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-2">
                  <Pause className="w-3.5 h-3.5" />
                  Suspend
               </button>
               <button className="px-5 py-2 bg-brand-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Now
               </button>
            </div>
         }
       >
         <DetailViewContent />
       </DetailDrawer>
    </div>
  );
};
