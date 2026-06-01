import React, { useState } from 'react';
import { 
  Plus, 
  ChevronRight, 
  Bot, 
  Database, 
  Network, 
  Wrench, 
  GitBranch, 
  ShieldCheck, 
  Cpu, 
  Eye, 
  Check, 
  AlertCircle, 
  Code, 
  Globe, 
  Lock, 
  User, 
  ArrowRight,
  MoreVertical,
  X,
  Layers,
  Settings,
  MessageSquare,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';

interface WizardProps {
  onCancel: () => void;
  onComplete: () => void;
}

const STEPS = [
  'Type',
  'Template',
  'Identity',
  'Model',
  'Knowledge',
  'Tools',
  'Guardrails',
  'Memory',
  'Review'
];

export const NewAgentWizard: React.FC<WizardProps> = ({ onCancel, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    type: 'RAG',
    template: 'Customer Support',
    name: '',
    description: '',
    tenant: 'BlueChip Enterprise',
    project: 'Service Desk',
    environment: 'DEV',
    model: 'gemini-1.5-pro',
    temperature: 0.7,
    kbCollection: '',
    tools: [] as string[],
    guardrails: [] as string[],
    memory: 'session'
  });

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Type
        return (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-500">
            {[
              { type: 'RAG', desc: 'Standard information retrieval from documents.', icon: Database },
              { type: 'GRAPHRAG', desc: 'Semantic knowledge graph relationships.', icon: Network },
              { type: 'TOOL_USE', desc: 'Executes actions via API / Function calling.', icon: Wrench },
              { type: 'WORKFLOW', desc: 'Complex multi-step state machine logic.', icon: GitBranch },
              { type: 'COORDINATOR', desc: 'Manages multiple sub-agents.', icon: Layers },
              { type: 'HITL', desc: 'Human-in-the-loop approval workflows.', icon: User },
            ].map(item => (
              <button 
                key={item.type}
                onClick={() => { setFormData({...formData, type: item.type}); nextStep(); }}
                className={cn(
                  "p-8 bg-white/5 border rounded-[2rem] text-left transition-all hover:bg-white/10 group",
                  formData.type === item.type ? "border-brand-500 bg-brand-500/5" : "border-white/5"
                )}
              >
                <item.icon className={cn("w-10 h-10 mb-4 transition-transform group-hover:scale-110", formData.type === item.type ? "text-brand-400" : "text-slate-500")} />
                <div className="font-bold text-white text-lg">{item.type} Agent</div>
                <p className="text-slate-500 text-sm mt-1 leading-relaxed">{item.desc}</p>
              </button>
            ))}
          </div>
        );
      case 1: // Template
        return (
          <div className="grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-right-8 duration-500">
            {[
              'Customer Support', 'Policy Assistant', 'Railway Incident', 
              'Banking Compliance', 'Medical Knowledge', 'Internal Ops'
            ].map(tmpl => (
              <button 
                key={tmpl}
                onClick={() => { setFormData({...formData, template: tmpl}); nextStep(); }}
                className={cn(
                  "p-6 bg-white/5 border rounded-3xl text-center transition-all hover:bg-white/10",
                  formData.template === tmpl ? "border-brand-500 bg-brand-500/5 shadow-xl shadow-brand-500/10" : "border-white/5"
                )}
              >
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-brand-400">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="font-bold text-white text-sm">{tmpl}</div>
              </button>
            ))}
          </div>
        );
      case 2: // Identity
        return (
          <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Agent Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Sentinel-7"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-brand-500/50 transition-all font-display text-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Describe the agent's purpose..."
                className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-brand-500/50 transition-all resize-none leading-relaxed"
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Environment</label>
                <select 
                  value={formData.environment}
                  onChange={e => setFormData({...formData, environment: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none appearance-none font-bold"
                >
                  <option value="DEV">DEVELOPMENT</option>
                  <option value="UAT">UAT / STAGING</option>
                  <option value="PROD">PRODUCTION</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tenant</label>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-slate-400 font-bold italic">
                  BlueChip Enterprise
                </div>
              </div>
            </div>
          </div>
        );
      case 8: // Review
        return (
          <div className="grid grid-cols-12 gap-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="col-span-8 space-y-6">
              <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-white/[0.01]">
                <h3 className="text-2xl font-display font-medium mb-8 italic">Configuration Summary</h3>
                <div className="grid grid-cols-2 gap-10">
                   <div className="space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                        <span className="text-[10px] font-black text-slate-600 uppercase">Agent Type</span>
                        <span className="text-sm font-bold text-brand-400">{formData.type}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                        <span className="text-[10px] font-black text-slate-600 uppercase">Template</span>
                        <span className="text-sm font-bold text-white">{formData.template}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                        <span className="text-[10px] font-black text-slate-600 uppercase">Model</span>
                        <span className="text-sm font-mono font-bold text-slate-300">{formData.model}</span>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                        <span className="text-[10px] font-black text-slate-600 uppercase">Environment</span>
                        <span className="text-sm font-black text-amber-500">{formData.environment}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                        <span className="text-[10px] font-black text-slate-600 uppercase">KB Target</span>
                        <span className="text-sm font-bold text-slate-400 italic">None Selected</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                        <span className="text-[10px] font-black text-slate-600 uppercase">Tools</span>
                        <span className="text-sm font-bold text-slate-400">0 Active</span>
                      </div>
                   </div>
                </div>
              </div>
              <div className="glass-panel p-8 rounded-[2rem] border-brand-500/20 bg-brand-500/5">
                 <div className="flex items-center gap-4 text-brand-400 mb-4">
                    <ShieldCheck className="w-6 h-6" />
                    <span className="font-bold uppercase tracking-widest text-xs">Security Validation Results</span>
                 </div>
                 <p className="text-sm text-slate-400 leading-relaxed italic">
                    "Agent configuration conforms to BlueChip Enterprise security baseline. Governance tags will be auto-injected upon deployment."
                 </p>
              </div>
            </div>
            <div className="col-span-4 space-y-6">
               <div className="glass-panel p-6 rounded-[2rem] border-white/5 bg-black/40">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Code className="w-3 h-3" /> YAML Preview
                  </h4>
                  <pre className="text-[10px] font-mono text-slate-500 leading-relaxed">
                    {`agent:\n  name: ${formData.name || 'Untitled'}\n  type: ${formData.type}\n  model: ${formData.model}\n  env: ${formData.environment}\nguardrails:\n  hallucination_check: true\n  pii_masking: true`}
                  </pre>
               </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center p-20 opacity-50">
             <Cpu className="w-16 h-16 text-slate-700 animate-pulse mb-6" />
             <h3 className="text-2xl font-display font-medium italic">Configuring {STEPS[currentStep]}...</h3>
             <p className="text-slate-600 text-xs font-black uppercase tracking-widest mt-2">Simulating Neural Optimization Pipeline</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-20">
       <motion.div 
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         onClick={onCancel}
         className="absolute inset-0 bg-black/90 backdrop-blur-2xl" 
       />
       <motion.div 
         initial={{ opacity: 0, y: 40, scale: 0.95 }}
         animate={{ opacity: 1, y: 0, scale: 1 }}
         className="relative w-full max-w-6xl h-full flex flex-col glass-panel p-16 rounded-[4rem] border-white/5 bg-[#01030a]"
       >
          <div className="flex justify-between items-center mb-16">
             <div className="flex items-center gap-12 overflow-x-auto pb-4 no-scrollbar">
                {STEPS.map((step, i) => (
                   <div key={step} className="flex items-center gap-4 shrink-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black transition-all",
                        currentStep === i ? "bg-brand-500 text-white shadow-xl shadow-brand-500/30 scale-110" : 
                        currentStep > i ? "bg-green-500/20 text-green-500" : "bg-white/5 text-slate-700"
                      )}>
                        {currentStep > i ? <Check className="w-5 h-5" /> : i + 1}
                      </div>
                      <div className="hidden lg:block">
                         <div className={cn("text-[9px] font-black uppercase tracking-widest mb-0.5", currentStep === i ? "text-brand-400" : "text-slate-600")}>
                           {step}
                         </div>
                      </div>
                      {i < STEPS.length - 1 && <div className="w-8 h-px bg-white/10" />}
                   </div>
                ))}
             </div>
             <button onClick={onCancel} className="p-4 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all shadow-xl">
                <X className="w-6 h-6" />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
             {renderStep()}
          </div>

          <div className="mt-16 flex justify-between items-center pt-12 border-t border-white/5">
              <button 
                onClick={prevStep}
                disabled={currentStep === 0}
                className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all disabled:opacity-30 flex items-center gap-2"
              >
                Back Step
              </button>
              <div className="flex gap-4">
                 {currentStep < STEPS.length - 1 ? (
                    <button 
                      onClick={nextStep}
                      className="px-12 py-4 bg-brand-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/30 flex items-center gap-3"
                    >
                      Establish Platform Metadata
                      <ArrowRight className="w-4 h-4" />
                    </button>
                 ) : (
                    <>
                       <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all">
                          Save as Blueprint
                       </button>
                       <button 
                         onClick={onComplete}
                         className="px-12 py-4 bg-green-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-green-600 transition-all shadow-2xl shadow-green-500/20 flex items-center gap-3"
                       >
                         Initialize Production Unit
                         <Zap className="w-4 h-4" />
                       </button>
                    </>
                 )}
              </div>
          </div>
       </motion.div>
    </div>
  );
};
