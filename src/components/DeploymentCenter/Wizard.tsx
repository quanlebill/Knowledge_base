import React, { useState } from 'react';
import { 
  Plus, 
  ChevronRight, 
  Rocket, 
  Database, 
  Bot, 
  Wrench, 
  ShieldCheck, 
  GitBranch, 
  ArrowRight, 
  X, 
  Check, 
  Layers, 
  FileCode, 
  Lock, 
  Zap, 
  Search, 
  Cpu, 
  AlertTriangle,
  Terminal,
  Activity,
  User,
  ShieldAlert,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface WizardProps {
  onCancel: () => void;
  onComplete: () => void;
}

const STEPS = [
  'Blueprint',
  'Unit Selection',
  'Dependency Graph',
  'Validation',
  'Security Audit',
  'Approval Flow',
  'Finalize'
];

export const DeploymentWizard: React.FC<WizardProps> = ({ onCancel, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [deployType, setDeployType] = useState('AGENT');
  const [env, setEnv] = useState('UAT');

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Blueprint
        return (
          <div className="grid grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-500">
             {[
               { id: 'AGENT', name: 'Agent Deployment', icon: Bot, desc: 'Update autonomous runtime units and prompts.' },
               { id: 'KB', name: 'Knowledge Base Sync', icon: Database, desc: 'Release new vector collections and graph versions.' },
               { id: 'TOOL', name: 'Tool Binding', icon: Wrench, desc: 'Promote new API actions and SDK interfaces.' },
               { id: 'SOLUTION', name: 'Full Stack Promotion', icon: Layers, desc: 'Atomic release of Agent, KB, and connected tools.' },
               { id: 'POLICY', name: 'Governance Patch', icon: ShieldCheck, desc: 'Update guardrails, PII filters and rate limits.' },
               { id: 'CONFIG', name: 'Environment Config', icon: FileCode, desc: 'Global settings, secrets, and model overrides.' },
             ].map(type => (
                <button 
                  key={type.id}
                  onClick={() => { setDeployType(type.id); nextStep(); }}
                  className={cn(
                    "p-8 bg-white/5 border rounded-[3rem] text-left transition-all hover:bg-white/10 group relative overflow-hidden",
                    deployType === type.id ? "border-brand-500 bg-brand-500/5 shadow-2xl shadow-brand-500/10" : "border-white/5"
                  )}
                >
                   <type.icon className={cn("w-12 h-12 mb-6 transition-all group-hover:scale-110", deployType === type.id ? "text-brand-400" : "text-slate-500")} />
                   <div className="font-bold text-white text-xl uppercase tracking-tighter italic">{type.name}</div>
                   <p className="text-slate-500 text-sm mt-2 leading-relaxed italic">{type.desc}</p>
                </button>
             ))}
          </div>
        );
      case 2: // Dependency Graph
        return (
           <div className="flex flex-col items-center justify-center p-20 animate-in fade-in duration-500">
              <div className="relative mb-12">
                 <div className="absolute inset-0 bg-brand-500 opacity-10 blur-[100px] animate-pulse" />
                 <Cpu className="w-32 h-32 text-brand-400 text-glow-blue" />
              </div>
              <h3 className="text-3xl font-display font-medium text-white mb-4 italic tracking-tight">Resolving Multi-Unit Dependencies</h3>
              <div className="flex gap-4 mb-4">
                 <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-bold text-slate-300">KB Version v2.1 Matches</span>
                 </div>
                 <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-bold text-slate-300">Tool Schema Compatible</span>
                 </div>
                 <div className="px-5 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-400">Secret Reference Missing</span>
                 </div>
              </div>
              <button 
                onClick={nextStep}
                className="text-[10px] font-black text-brand-400 uppercase underline tracking-widest hover:text-white transition-all"
              >
                 Inject Manual Override Configuration
              </button>
           </div>
        );
      case 6: // Finalize
        return (
          <div className="grid grid-cols-12 gap-12 animate-in fade-in zoom-in-95 duration-700">
             <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
                <div className="glass-panel p-12 rounded-[4rem] border-white/5 bg-black/40">
                   <h3 className="text-3xl font-display font-medium text-white mb-10 italic">Release Manifest Summary</h3>
                   <div className="grid grid-cols-2 gap-12">
                      <div className="space-y-6">
                         <div className="space-y-1">
                            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Target Environment</div>
                            <div className="text-2xl font-bold text-brand-400 uppercase">{env}</div>
                         </div>
                         <div className="space-y-1">
                            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Deployment Strategy</div>
                            <div className="text-lg font-bold text-slate-200">Canary (10% Step Traffic)</div>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <div className="space-y-1">
                            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Safety Policy</div>
                            <div className="text-lg font-bold text-green-500 underline decoration-green-500/30">Zero Downtime Verified</div>
                         </div>
                         <div className="space-y-1">
                            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total Risk Factor</div>
                            <div className="text-3xl font-display font-medium text-white">LOW (12/100)</div>
                         </div>
                      </div>
                   </div>
                </div>
                <div className="p-8 bg-amber-500/10 border border-amber-500/20 rounded-[2.5rem] flex items-center gap-6">
                   <AlertTriangle className="w-10 h-10 text-amber-500" />
                   <div>
                      <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">PROD Promotion Notice</h4>
                      <p className="text-slate-400 text-sm italic">"Deployment requires approval from Governance Board due to cross-tenant KB linkage."</p>
                   </div>
                </div>
             </div>
             <div className="col-span-12 lg:col-span-4 gap-8 flex flex-col">
                <div className="glass-panel p-8 rounded-[2.5rem] border-white/10 bg-white/5 flex-1 relative overflow-hidden">
                   <div className="absolute inset-0 bg-brand-500/5 blur-[80px]" />
                   <div className="relative">
                      <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-8 flex items-center gap-2">
                        <Terminal className="w-4 h-4" /> CD Payload Preview
                      </h4>
                      <pre className="text-[10px] font-mono text-slate-500 leading-relaxed max-h-[300px] overflow-y-auto no-scrollbar">
{`deployment:
  id: "DEP-${Math.floor(Math.random() * 10000)}"
  type: "${deployType}"
  strategy: "canary"
  assets:
    - id: "agt-4412"
      version: "v4.2.1"
    - id: "kb-9901"
      version: "v2.0"
  runtime:
    cpu: 2
    mem: "4Gi"
    gpu: "nvidia-l4-1"`}
                      </pre>
                   </div>
                </div>
             </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center p-32 opacity-30 italic">
             <RefreshCw className="w-16 h-16 text-slate-700 animate-spin-slow mb-8" />
             <h3 className="text-2xl font-display font-medium">Neural Asset Indexation...</h3>
             <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-2 underline decoration-brand-500/30">Syncing with Canonical Build Store</p>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col p-10">
       <div className="relative w-full h-full flex flex-col space-y-16"
       >
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-6 overflow-x-auto pb-4 no-scrollbar">
                {STEPS.map((step, i) => (
                   <div key={step} className="flex items-center gap-3 shrink-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all",
                        currentStep === i ? "bg-brand-500 text-white shadow-2xl shadow-brand-500/40 scale-110" : 
                        currentStep > i ? "bg-green-500/20 text-green-500" : "bg-white/5 text-slate-700"
                      )}>
                        {currentStep > i ? <Check className="w-4 h-4" /> : i + 1}
                      </div>
                      <div className="hidden lg:block">
                        <div className={cn(
                            "text-[8px] font-black uppercase tracking-widest mb-0.5",
                            currentStep === i ? "text-brand-400" : "text-slate-600"
                        )}>{step}</div>
                      </div>
                      {i < STEPS.length - 1 && <div className="w-4 h-px bg-white/5" />}
                   </div>
                ))}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
             {renderStep()}
          </div>

          <div className="mt-10 flex justify-between items-center pt-8 border-t border-white/5">
              <button 
                onClick={prevStep}
                disabled={currentStep === 0}
                className="px-8 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all disabled:opacity-30"
              >
                Previous Stage
              </button>
              <div className="flex gap-4">
                 {currentStep < STEPS.length - 1 ? (
                    <button 
                      onClick={nextStep}
                      className="px-12 py-3.5 bg-brand-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/40 flex items-center gap-3"
                    >
                      Establish Promotion Path
                      <ArrowRight className="w-4 h-4" />
                    </button>
                 ) : (
                    <button 
                      onClick={onComplete}
                      className="px-16 py-3.5 bg-green-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] hover:bg-green-600 transition-all shadow-2xl shadow-green-500/30 flex items-center gap-3"
                    >
                      Queue Production Runtime
                      <Zap className="w-4 h-4" />
                    </button>
                 )}
              </div>
          </div>
       </div>
    </div>
  );
};
