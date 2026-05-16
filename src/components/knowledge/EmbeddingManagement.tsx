import React, { useState } from 'react';
import { Cpu, HardDrive, Zap, ShieldCheck, Activity, Search, ArrowRight, MoreVertical, Settings, Database, History, RefreshCw, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DetailDrawer } from '../shared/DetailDrawer';

export const EmbeddingManagement = () => {
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [showReEmbeddingDrawer, setShowReEmbeddingDrawer] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any>(null);

  const models = [
    { name: 'text-embedding-004', provider: 'Google', dimensions: 768, usage: '84%', status: 'ACTIVE' },
    { name: 'bge-large-en-v1.5', provider: 'Open Source', dimensions: 1024, usage: '12%', status: 'IDLE' },
    { name: 'multimodal-embedding-001', provider: 'Google', dimensions: 1408, usage: '4%', status: 'ACTIVE' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
           <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-brand-500/[0.02]">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-brand-400" />
                    Embedding Model Fleet
                 </h3>
                 <button 
                  onClick={() => {
                    setSelectedModel(null);
                    setShowConfigDrawer(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20"
                 >
                    Register Model
                 </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                 {models.map((model, i) => (
                    <div key={i} className="group p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-between hover:bg-white/[0.04] transition-all">
                       <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center border",
                            model.status === 'ACTIVE' ? "bg-brand-500/10 border-brand-500/20 text-brand-400" : "bg-white/5 border-white/5 text-slate-600"
                          )}>
                             <Zap className="w-6 h-6" />
                          </div>
                          <div>
                             <div className="text-sm font-bold text-white uppercase tracking-tight">{model.name}</div>
                             <div className="text-[10px] text-slate-500 mt-1 font-mono uppercase tracking-tighter">
                                {model.provider} • {model.dimensions} Dim
                             </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-12">
                          <div className="text-right">
                             <div className="text-[10px] text-slate-600 font-bold uppercase mb-1">Utilization</div>
                             <div className="text-xs font-mono text-white">{model.usage}</div>
                          </div>
                          <div className="text-right min-w-[80px]">
                             <div className="text-[10px] text-slate-600 font-bold uppercase mb-1">Status</div>
                             <div className={cn(
                               "text-[10px] font-black uppercase tracking-widest",
                               model.status === 'ACTIVE' ? "text-emerald-500" : "text-slate-600"
                             )}>{model.status}</div>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedModel(model);
                              setShowConfigDrawer(true);
                            }}
                            className="p-2 hover:bg-white/10 rounded-xl transition-all"
                          >
                             <Settings className="w-4 h-4 text-slate-500" />
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="glass-panel p-8 rounded-[2.5rem] border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-3">
                 <HardDrive className="w-5 h-5 text-purple-400" />
                 Vector Storage Clusters
              </h3>
              <div className="space-y-4">
                 {[
                   { name: 'Cluster-East-Prod', type: 'Pinecone', throughput: '1.2k req/s', latency: '12ms' },
                   { name: 'Cluster-Local-Deep', type: 'Chroma', throughput: '400 req/s', latency: '4ms' },
                 ].map((cluster, i) => (
                    <div key={i} className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex justify-between items-center">
                       <div className="flex gap-4 items-center">
                          <Activity className="w-4 h-4 text-slate-500" />
                          <div>
                             <div className="text-xs font-bold text-white uppercase">{cluster.name}</div>
                             <div className="text-[9px] text-slate-600 font-mono mt-0.5">{cluster.type}</div>
                          </div>
                       </div>
                       <div className="flex gap-8 text-right">
                          <div>
                             <div className="text-[9px] text-slate-600 font-bold uppercase">Throughput</div>
                             <div className="text-[10px] font-mono text-slate-400">{cluster.throughput}</div>
                          </div>
                          <div>
                             <div className="text-[9px] text-slate-600 font-bold uppercase">Lat.</div>
                             <div className="text-[10px] font-mono text-slate-400">{cluster.latency}</div>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="space-y-8">
           <div className="glass-panel p-8 rounded-[2.5rem] border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6">Optimization Tasks</h3>
              <div className="space-y-4">
                 <button className="w-full p-6 border border-brand-500/20 bg-brand-500/5 rounded-[2rem] flex flex-col items-center gap-4 group hover:bg-brand-500/10 transition-all text-center">
                    <Zap className="w-8 h-8 text-brand-400 animate-pulse" />
                    <div>
                       <div className="text-xs font-bold text-white uppercase tracking-widest">Global Re-embedding</div>
                       <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">Upgrade 4.2k existing artifacts to the new vector schema.</p>
                    </div>
                 </button>
                 <button className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all text-center">
                    Trigger Cache Flush
                 </button>
              </div>
           </div>

           <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 bg-amber-500/[0.02]">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6">Embedding Governance</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 uppercase font-bold">PII Filter</span>
                    <span className="text-emerald-500 font-black tracking-widest">ENABLED</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 uppercase font-bold">Vector Versioning</span>
                    <span className="text-emerald-500 font-black tracking-widest">ENABLED</span>
                 </div>
                 <div className="pt-4 border-t border-white/5">
                    <div className="text-[10px] text-slate-600 mb-2 font-mono uppercase">Current Strategy:</div>
                    <div className="text-xs font-bold text-white">Semantic-Rich Context Masking</div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
