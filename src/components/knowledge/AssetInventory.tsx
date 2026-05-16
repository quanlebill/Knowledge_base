import React from 'react';
import { Layers, Database, Activity, Search, ShieldCheck, Zap, ArrowRight, MoreVertical, Edit2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { KnowledgeDocument } from '../../types';

interface AssetInventoryProps {
  onSelectAsset: (asset: KnowledgeDocument) => void;
}

const DOCUMENTS: KnowledgeDocument[] = [
  { id: 'd1', name: 'Global_Refund_Policy_2025.pdf', layer: 'BRONZE', status: 'PUBLISHED', version: 'v3.1', lastUpdated: '2h ago', author: 'System', metadata: { tenant: 'GlobalCorp', type: 'PDF' } },
  { id: 'd2', name: 'H1_Cloud_Architecture_Specs', layer: 'SILVER', status: 'EMBEDDING', version: 'v1.4', lastUpdated: '10m ago', author: 'ARivera', metadata: { tenant: 'GlobalCorp', type: 'Markdown' } },
  { id: 'd3', name: 'Security_Compliance_Framework', layer: 'GOLD', status: 'PUBLISHED', version: 'v2.0', lastUpdated: '1d ago', author: 'Compliance_Bot', metadata: { tenant: 'GlobalCorp', type: 'Vector Index' } },
  { id: 'd4', name: 'Operational_Manual_Draft.docx', layer: 'BRONZE', status: 'FAILED', version: 'v1.0', lastUpdated: '5h ago', author: 'JSmith', metadata: { tenant: 'Logistics_Sub', type: 'DOCX' } },
  { id: 'd5', name: 'Entity_Map_v2', layer: 'GOLD', status: 'PUBLISHED', version: 'v2.1', lastUpdated: '4h ago', author: 'Graph_Sync', metadata: { tenant: 'GlobalCorp', type: 'Graph Nodes' } },
];

export const AssetInventory = ({ onSelectAsset }: AssetInventoryProps) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full">
      <div className="flex justify-between items-center">
         <div className="flex gap-4">
            {['ALL ASSETS', 'BRONZE', 'SILVER', 'GOLD'].map(filter => (
              <button key={filter} className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                filter === 'ALL ASSETS' ? "bg-brand-500 text-white shadow-xl shadow-brand-500/20" : "bg-white/5 text-slate-500 hover:text-white"
              )}>
                {filter}
              </button>
            ))}
         </div>
         <div className="flex gap-3">
            <div className="relative group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-brand-400 transition-colors" />
               <input type="text" placeholder="Search knowledge..." className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-2.5 text-xs w-64 focus:outline-none focus:border-brand-500/30 transition-all font-mono" />
            </div>
         </div>
      </div>

      <div className="glass-panel border-white/5 rounded-[2.5rem] overflow-hidden bg-white/[0.01]">
         <table className="w-full text-left">
            <thead>
               <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                  <th className="px-8 py-5">Knowledge Asset</th>
                  <th className="px-6 py-5">Layer</th>
                  <th className="px-6 py-5">Ref. ID</th>
                  <th className="px-6 py-5">Compliance</th>
                  <th className="px-6 py-5">Author</th>
                  <th className="px-6 py-5 text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
               {DOCUMENTS.map((doc, i) => (
                  <tr key={doc.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => onSelectAsset(doc)}>
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className={cn(
                             "w-10 h-10 rounded-xl flex items-center justify-center border",
                             doc.layer === 'BRONZE' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                             doc.layer === 'SILVER' ? 'bg-slate-500/10 border-white/10 text-slate-400' :
                             'bg-brand-500/10 border-brand-500/20 text-brand-400'
                           )}>
                              {doc.layer === 'BRONZE' ? <Database className="w-5 h-5" /> : 
                               doc.layer === 'SILVER' ? <Edit2 className="w-5 h-5" /> : 
                               <Zap className="w-5 h-5" />}
                           </div>
                           <div>
                              <div className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors uppercase tracking-tight">{doc.name}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{doc.metadata.type} • V{doc.version}</div>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-6">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest",
                          doc.layer === 'BRONZE' ? 'text-amber-500 border-amber-500/20' :
                          doc.layer === 'SILVER' ? 'text-slate-400 border-white/10' :
                          'text-brand-400 border-brand-500/20'
                        )}>
                          {doc.layer}
                        </span>
                     </td>
                     <td className="px-6 py-6 font-mono text-[10px] text-slate-500 tracking-tighter">{doc.id}</td>
                     <td className="px-6 py-6">
                        <div className="flex items-center gap-1.5">
                           <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                           <span className="text-[10px] font-mono font-bold text-green-500 uppercase">SECURE</span>
                        </div>
                     </td>
                     <td className="px-6 py-6">
                        <div className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center text-[8px] font-bold text-brand-400">{doc.author[0]}</div>
                           <span className="text-[11px] text-slate-400">{doc.author}</span>
                        </div>
                     </td>
                     <td className="px-8 py-6 text-right">
                        <button className="p-2 hover:bg-brand-500/10 rounded-xl text-slate-500 hover:text-brand-400 transition-all">
                           <ArrowRight className="w-4 h-4" />
                        </button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};
