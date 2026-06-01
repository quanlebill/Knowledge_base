import React, { useState } from 'react';
import { 
  FileText, 
  Cloud, 
  Database, 
  Globe, 
  Activity, 
  Plus, 
  CheckCircle2, 
  ArrowRight, 
  Settings2, 
  Layers, 
  Grid3X3, 
  Network, 
  ShieldCheck, 
  Cpu, 
  Zap,
  MoreVertical,
  X,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const STEPS = [
  { id: 'source', label: 'Select Source' },
  { id: 'pipeline', label: 'Choose Pipeline' },
  { id: 'config', label: 'Configure Processing' },
  { id: 'dest', label: 'Assign Destination' },
  { id: 'review', label: 'Review & Launch' }
];

const SOURCES = [
  { id: 's1', name: 'File Upload', icon: FileText, desc: 'Local PDF, Excel, Docx, Images' },
  { id: 's2', name: 'SharePoint', icon: Cloud, desc: 'Enterprise document library' },
  { id: 's3', name: 'PostgreSQL', icon: Database, desc: 'Direct database ingestion' },
  { id: 's4', name: 'Web Crawler', icon: Globe, desc: 'Scrape internal or public portals' },
];

const PIPELINES = [
  { id: 'p1', name: 'GraphRAG Pipeline', icon: Network, desc: 'Chunks + Vector + Entity Graph' },
  { id: 'p2', name: 'Standard RAG', icon: Grid3X3, desc: 'OCR + Cleaning + Embedding' },
  { id: 'p3', name: 'Media Transcription', icon: Activity, desc: 'Audio/Video to searchable KB' },
];

export const IngestionWizard = ({ onComplete, onCancel }: { onComplete: () => void, onCancel: () => void }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  return (
    <div className="flex flex-col h-full">
        {/* Wizard Steps */}
        <div className="px-8 py-6 border-b border-white/5 bg-white/[0.005]">
           <div className="flex justify-between items-center relative">
              <div className="absolute left-0 right-0 h-px bg-white/10 top-1/2 -translate-y-1/2 z-0" />
              {STEPS.map((step, i) => (
                 <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                    <div className={cn(
                       "w-7 h-7 rounded-full border flex items-center justify-center text-[9px] font-black transition-all duration-500",
                       currentStep === i ? "bg-brand-500 border-brand-500 text-white scale-110 shadow-lg shadow-brand-500/30" :
                       currentStep > i ? "bg-green-500 border-green-500 text-white" :
                       "bg-[#0a0a0a] border-white/10 text-slate-500"
                    )}>
                       {currentStep > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className={cn(
                       "text-[8px] font-black uppercase tracking-widest transition-colors",
                       currentStep === i ? "text-brand-400" : "text-slate-600"
                    )}>{step.label}</span>
                 </div>
              ))}
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
           <AnimatePresence mode="wait">
              {currentStep === 0 && (
                 <motion.div 
                    key="step-0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                 >
                    <div className="text-center mb-8">
                       <h3 className="text-2xl font-display font-medium italic">Intelligence Source</h3>
                       <p className="text-slate-500 text-xs mt-1 uppercase font-bold tracking-widest opacity-50">Choose extraction point</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       {SOURCES.map(source => (
                          <button 
                             key={source.id}
                             onClick={() => setSelectedSource(source.id)}
                             className={cn(
                                "p-6 rounded-[2rem] border-2 text-left transition-all group",
                                selectedSource === source.id ? "border-brand-500 bg-brand-500/5" : "border-white/5 hover:border-white/10 bg-white/[0.02]"
                             )}
                          >
                             <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all",
                                selectedSource === source.id ? "bg-brand-500 text-white" : "bg-white/5 text-slate-400 group-hover:text-brand-400"
                             )}>
                                <source.icon className="w-6 h-6" />
                             </div>
                             <h4 className="text-sm font-bold mb-1 uppercase tracking-tight">{source.name}</h4>
                             <p className="text-[10px] text-slate-500 leading-tight">{source.desc}</p>
                          </button>
                       ))}
                    </div>
                 </motion.div>
              )}

              {currentStep === 1 && (
                 <motion.div 
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                 >
                    <div className="text-center mb-8">
                       <h3 className="text-2xl font-display font-medium italic">Extraction Pipeline</h3>
                       <p className="text-slate-500 text-xs mt-1 uppercase font-bold tracking-widest opacity-50">Transformation logic</p>
                    </div>
                    <div className="space-y-3">
                       {PIPELINES.map(p => (
                          <button 
                             key={p.id}
                             onClick={() => setSelectedPipeline(p.id)}
                             className={cn(
                                "w-full p-6 rounded-[2rem] border-2 text-left transition-all flex items-center gap-6 group",
                                selectedPipeline === p.id ? "border-brand-500 bg-brand-500/5 shadow-2xl shadow-brand-500/5" : "border-white/5 hover:border-white/10 bg-white/[0.02]"
                             )}
                          >
                             <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all",
                                selectedPipeline === p.id ? "bg-brand-500 text-white" : "bg-white/5 text-slate-500 group-hover:text-brand-400"
                             )}>
                                <p.icon className="w-5 h-5" />
                             </div>
                             <div className="flex-1">
                                <h4 className="text-sm font-bold mb-1 uppercase tracking-tight">{p.name}</h4>
                                <p className="text-[10px] text-slate-500">{p.desc}</p>
                             </div>
                             {selectedPipeline === p.id && (
                                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white">
                                   <CheckCircle2 className="w-5 h-5" />
                                </div>
                             )}
                          </button>
                       ))}
                    </div>
                 </motion.div>
              )}

              {currentStep > 1 && (
                 <div className="flex flex-col items-center justify-center h-full text-center py-20 text-slate-500 italic">
                    <Cpu className="w-12 h-12 mb-4 opacity-50" />
                    Configuration modules for Step {currentStep + 1} are initializing...
                 </div>
              )}
           </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-white/5 bg-white/[0.01] flex justify-between items-center">
           <button 
             onClick={prevStep}
             disabled={currentStep === 0}
             className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-white disabled:opacity-0 transition-all flex items-center gap-2"
           >
              <ChevronLeft className="w-4 h-4" />
              BACK
           </button>
           <div className="flex gap-3">
              <button 
                onClick={onCancel}
                className="px-6 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={currentStep === STEPS.length - 1 ? onComplete : nextStep}
                disabled={currentStep === 0 && !selectedSource || currentStep === 1 && !selectedPipeline}
                className="px-8 py-2 bg-brand-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20 flex items-center gap-3 disabled:opacity-30"
              >
                 {currentStep === STEPS.length - 1 ? 'Launch' : 'Next'}
                 <ArrowRight className="w-4 h-4" />
              </button>
           </div>
        </div>
    </div>
  );
};
