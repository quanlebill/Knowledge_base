import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Layers, ArrowRight, ChevronLeft, ChevronRight, CheckCircle2, Play } from 'lucide-react';
import { cn } from '../lib/utils';

interface Task {
  id: string;
  name: string;
  fromLayer: 'BRONZE' | 'SILVER';
  toLayer: 'SILVER' | 'GOLD';
  progress: number;
  status: 'RUNNING' | 'COMPLETED';
  speed: number;
}

export const TaskQueue = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([
    { id: 't1', name: 'Standard_Refund_Policy_v2.pdf', fromLayer: 'BRONZE', toLayer: 'SILVER', progress: 54, status: 'RUNNING', speed: 1.5 },
    { id: 't2', name: 'Azure_Migration_Architecture.pdf', fromLayer: 'SILVER', toLayer: 'GOLD', progress: 12, status: 'RUNNING', speed: 0.8 },
    { id: 't3', name: 'Compliance_Guide.md', fromLayer: 'BRONZE', toLayer: 'SILVER', progress: 85, status: 'RUNNING', speed: 2.1 },
    { id: 't4', name: 'GDPR_Compliance_Audit_Log.csv', fromLayer: 'BRONZE', toLayer: 'SILVER', progress: 32, status: 'RUNNING', speed: 1.1 },
    { id: 't5', name: 'Corporate_Bylaws_Vectorized.pdf', fromLayer: 'SILVER', toLayer: 'GOLD', progress: 70, status: 'RUNNING', speed: 0.5 },
  ]);

  // Simulate progress updates for running tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((prevTasks) =>
        prevTasks.map((task) => {
          if (task.status === 'COMPLETED') {
            // After being completed, wait a bit then cycle/restart of task
            if (Math.random() > 0.85) {
              return {
                ...task,
                progress: 0,
                status: 'RUNNING',
                speed: parseFloat((Math.random() * 2 + 0.5).toFixed(1)),
              };
            }
            return task;
          }

          const nextProgress = task.progress + task.speed;
          if (nextProgress >= 100) {
            return {
              ...task,
              progress: 100,
              status: 'COMPLETED',
            };
          }

          return {
            ...task,
            progress: parseFloat(nextProgress.toFixed(1)),
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const totalCompleted = tasks.filter(t => t.status === 'COMPLETED').length;
  const runningTasksCount = tasks.filter(t => t.status === 'RUNNING').length;

  return (
    <div 
      className="fixed inset-y-0 right-0 z-[160] h-screen flex items-stretch justify-end select-none pointer-events-none"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="flex items-stretch h-full relative pointer-events-auto">
        {/* COLLAPSED VISUAL TAB */}
        <div 
          className={cn(
            "fixed bottom-6 right-0 flex items-center gap-2.5 bg-[#1E1B15] text-[#FAFAFA] border-y border-l border-[#BFA66A]/40 rounded-l-[1.5rem] px-5 py-3.5 shadow-2xl cursor-pointer hover:bg-[#2C271E] transition-all duration-300 transform translate-x-1.5 hover:translate-x-0 group pointer-events-auto",
            isOpen ? "opacity-0 pointer-events-none translate-x-full" : "opacity-100"
          )}
        >
          <div className="relative">
            <Activity className="w-4 h-4 text-[#D9B86C] animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          </div>
          <span className="text-[12px] font-display font-bold uppercase tracking-wider text-[#D9B86C]">Task Queue</span>
          <span className="bg-[#BFA66A]/20 text-[#D9B86C] text-[10px] px-2 py-0.5 rounded-full border border-[#BFA66A]/30 font-mono">
            {runningTasksCount} Active
          </span>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
        </div>

        {/* EXPANDED SLIDE-IN TASK CONTAINER */}
        <div 
          className={cn(
            "bg-[#13110E] border-l border-[#BFA66A]/40 shadow-2xl p-6 w-[360px] h-full transform ease-in-out duration-300 flex flex-col gap-4 text-white overflow-hidden select-text",
            isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none absolute right-0"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#BFA66A]/20 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#D9B86C]" />
              <h3 className="text-xs font-display font-bold uppercase tracking-widest text-[#D9B86C]">Task Ingestion Queue</h3>
            </div>
            <div className="flex items-center gap-1.5 text-[8px] font-mono text-slate-500 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
              <span>LIVE FEED</span>
            </div>
          </div>

          {/* List representing tasks */}
          <div className="space-y-3.5 overflow-y-auto custom-scrollbar pr-1 flex-1">
            {tasks.map((task) => (
              <div key={task.id} className="group p-3 bg-white/[0.03] rounded-xl border border-white/5 hover:bg-white/[0.05] hover:border-[#BFA66A]/20 transition-all">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold font-mono tracking-tight text-slate-300 group-hover:text-[#D9B86C] transition-colors truncate">
                      {task.name}
                    </div>
                    {/* Layer Transition Badge */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded border tracking-tight uppercase",
                        task.fromLayer === 'BRONZE' ? 'bg-[#AC8A4D]/15 text-[#D9B86C] border-[#BFA66A]/30' : 'bg-[#C0C0C0]/10 text-slate-300 border-slate-300/20'
                      )}>
                        {task.fromLayer}
                      </span>
                      <ArrowRight className="w-2.5 h-2.5 text-slate-500" />
                      <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded border tracking-tight uppercase",
                        task.toLayer === 'SILVER' ? 'bg-[#C0C0C0]/10 text-slate-300 border-slate-300/20' : 'bg-[#D9B86C]/10 text-[#FFEBB3] border-[#D9B86C]/20'
                      )}>
                        {task.toLayer}
                      </span>
                    </div>
                  </div>

                  {/* Status column */}
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 font-bold whitespace-nowrap">
                      {task.status === 'COMPLETED' ? '100%' : `${task.progress}%`}
                    </span>
                  </div>
                </div>

                {/* Progress bar and metrics */}
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-300", 
                        task.status === 'COMPLETED' ? "bg-emerald-500" : "bg-[#D9B86C]"
                      )}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  {task.status === 'COMPLETED' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="w-1.5 h-1.5 bg-[#D9B86C] rounded-full animate-pulse shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer metrics summary */}
          <div className="border-t border-white/5 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Completed: {totalCompleted} / {tasks.length}</span>
            <span>Refreshes: 1s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
