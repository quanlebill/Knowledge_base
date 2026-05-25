import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Database, 
  Network, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  GitMerge, 
  User, 
  Check, 
  Eye, 
  Info, 
  Search,
  Filter,
  CheckCircle,
  HelpCircle,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  FolderOpen,
  ArrowLeft
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { DetailDrawer } from '../../shared/DetailDrawer';
import { mockGet, mockMutate } from '../../../lib/mockApi';
import {
  ConflictTypeKey, DatabaseType, SeverityType, ConflictStatusType,
  Conflict, ConflictBatch, CONFLICT_TYPE_LABELS,
} from './conflicts.data';


export const ConflictWorkspace = () => {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [batches, setBatches] = useState<ConflictBatch[]>([]);
  const [activeTab, setActiveTab] = useState<ConflictStatusType>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);

  // Pending batch grouping state
  const [selectedBatchId, setSelectedBatchId] = useState<string>('BATCH-001');
  const [pendingView, setPendingView] = useState<'batches' | 'conflicts'>('batches');

  // Resolution sandbox states
  const [resolutionInstruction, setResolutionInstruction] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'keep_existing' | 'keep_incoming' | 'merge_custom' | 'no_action' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch from mock server on mount; fall back to static data if server is offline
  useEffect(() => {
    mockGet<ConflictBatch[]>('/api/knowledge/conflicts/batches')
      .then(setBatches)
      .catch(() => {});
    mockGet<Conflict[]>('/api/knowledge/conflicts')
      .then(setConflicts)
      .catch(() => {});
  }, []);

  // Status counters
  const pendingCount = conflicts.filter(c => c.status === 'pending').length;
  const awaitingCount = conflicts.filter(c => c.status === 'awaiting').length;
  const resolvedCount = conflicts.filter(c => c.status === 'resolved').length;

  // Render nice severity colors
  const renderSeverityBadge = (sev: SeverityType) => {
    const styles = {
      high: 'bg-red-500/10 text-red-700 border-red-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold border font-mono',
      medium: 'bg-amber-500/10 text-amber-700 border-amber-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold border font-mono',
      low: 'bg-slate-100 text-slate-600 border-slate-200 px-2 py-0.5 rounded text-[10px] uppercase font-bold border font-mono'
    };
    return (
      <span className={styles[sev]}>
        {sev}
      </span>
    );
  };

  // Helper to map type to nice colorful labels
  const getConflictTypeLabel = (type: ConflictTypeKey) => {
    const labels: Record<ConflictTypeKey, string> = {
      schema: 'Schema Exception',
      content_contradiction: 'Content contradiction',
      content_conflict: 'Content conflict',
      content_duplicate: 'Content duplicate',
      content_update: 'Content update'
    };
    return labels[type] || type;
  };

  // Check if a method is disabled in sandbox based on conflict type rules
  const isMethodDisabled = (method: 'keep_existing' | 'keep_incoming' | 'merge_custom' | 'no_action', type: ConflictTypeKey) => {
    if (type === 'content_contradiction') {
      return method === 'merge_custom' || method === 'no_action';
    }
    if (type === 'schema') {
      return method === 'merge_custom' || method === 'no_action';
    }
    if (type === 'content_update') {
      return method === 'merge_custom';
    }
    if (type === 'content_duplicate') {
      return method === 'no_action';
    }
    return false;
  };

  // Filter conflicts for main list
  const filteredConflicts = conflicts.filter(c => {
    // Basic status match
    if (c.status !== activeTab) return false;
    
    // Batch filter applies to Pending only
    if (activeTab === 'pending' && c.batch_id !== selectedBatchId) return false;

    // Search query match
    const matchesSearch = 
      c.conflict_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tenant_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.affected_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.conflict_type.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Calculate pending counts per batch dynamically
  const getBatchPendingCount = (batchId: string) => {
    return conflicts.filter(c => c.status === 'pending' && c.batch_id === batchId).length;
  };

  const handleOpenConflict = (conflict: Conflict) => {
    setSelectedConflict(conflict);
    setResolutionInstruction(conflict.resolution_instruction || '');
    setSelectedMethod(conflict.selected_resolution_method || null);
  };

  const handleSubmitResolution = () => {
    if (!selectedConflict || !selectedMethod) return;

    setSubmitting(true);

    const nextStatus: ConflictStatusType = selectedMethod === 'merge_custom' ? 'awaiting' : 'resolved';
    const patch = {
      status: nextStatus,
      resolution_instruction: resolutionInstruction,
      selected_resolution_method: selectedMethod,
      resolved_at: nextStatus === 'resolved' ? new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : undefined,
      resolved_by: nextStatus === 'resolved' ? 'Platform Admin' : undefined,
    };

    // Fire mutation to mock server (ignore errors — local state always updates)
    mockMutate('PATCH', `/api/knowledge/conflicts/${selectedConflict.conflict_id}`, patch).catch(() => {});

    setTimeout(() => {
      setConflicts(prev => prev.map(c => {
        if (c.conflict_id === selectedConflict.conflict_id) {
          return { ...c, ...patch };
        }
        return c;
      }));

      setSelectedConflict(null);
      setResolutionInstruction('');
      setSelectedMethod(null);
      setSubmitting(false);
      setActiveTab(nextStatus);
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-[#111111]">

      {/* CONFLICT DETAIL DRAWER */}
      <DetailDrawer
        isOpen={!!selectedConflict}
        onClose={() => setSelectedConflict(null)}
        title={selectedConflict?.conflict_id || 'Conflict Detail'}
        subtitle={selectedConflict ? `${selectedConflict.tenant_id} • ${selectedConflict.status.toUpperCase()}` : ''}
        icon={ShieldAlert}
        size="wide"
        fixedHeight
        footer={
          selectedConflict?.status === 'pending' ? (
            <div className="flex justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setSelectedConflict(null)}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitResolution}
                disabled={!selectedMethod || submitting}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  selectedMethod && !submitting
                    ? "bg-[#B88719] text-white shadow-md hover:bg-[#8A5A00]"
                    : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-[#B88719] animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Execute Sync</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => setSelectedConflict(null)}
                className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer"
              >
                Close View
              </button>
            </div>
          )
        }
      >
        {selectedConflict && (
          <div className="p-5 space-y-5 text-[#111111] bg-white">

            {/* Conflict metadata warning banner */}
            <div className="bg-[#FFFDF8] border border-[#BFA66A]/30 p-4 rounded-xl flex gap-3 shadow-xs">
              <Info className="w-4 h-4 text-[#8A5A00] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-[#2A2A2A] uppercase tracking-wide">
                  {CONFLICT_TYPE_LABELS[selectedConflict.conflict_type].title}
                </h4>
                <p className="text-[11px] text-[#5A5A5A] leading-relaxed">
                  {CONFLICT_TYPE_LABELS[selectedConflict.conflict_type].desc}
                </p>
              </div>
            </div>

            {/* Conflict detailed description */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#8A5A00] font-mono">
                Reconciliation Explanation
              </span>
              <p className="text-[11px] text-slate-700 leading-normal bg-[#FAF9F5] p-3.5 rounded-xl border border-[#BFA66A]/15 italic">
                "{selectedConflict.detailed_explanation}"
              </p>
            </div>

            {/* Mini details table */}
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="p-2.5 bg-slate-50 border border-slate-200/50 rounded-xl">
                <span className="text-[8px] font-mono text-slate-400 font-bold uppercase block">Storage Hub</span>
                <span className="font-bold font-mono text-slate-700 capitalize block truncate">{selectedConflict.where_happens}</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200/50 rounded-xl">
                <span className="text-[8px] font-mono text-slate-400 font-bold uppercase block">Affected Location</span>
                <span className="font-bold font-mono text-slate-700 block truncate" title={selectedConflict.affected_location}>
                  {selectedConflict.affected_location}
                </span>
              </div>
            </div>

            {/* Side by side snapshot diff */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-xs bg-white">
                <div className="bg-[#1F1E19] px-3.5 py-2 flex items-center justify-between">
                  <span className="text-[9px] font-mono text-slate-300 font-black tracking-wider uppercase">
                    Snapshot A: Database Canonical
                  </span>
                  <span className="text-[8px] font-bold bg-[#FAF6EA] border border-[#BFA66A]/30 px-1.5 py-0.5 rounded text-[#8A5A00]">
                    Existing Key
                  </span>
                </div>
                <div className="p-3 bg-[#FAF9F5] overflow-x-auto h-full min-h-[140px]">
                  {typeof selectedConflict.existing_snapshot === 'object' ? (
                    <pre className="bg-[#12110F] text-slate-200 text-[10px] font-mono p-3 rounded-lg overflow-x-auto leading-relaxed border border-[#BFA66A]/20 h-full">
                      {JSON.stringify(selectedConflict.existing_snapshot, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-[11px] text-slate-700 leading-relaxed font-mono p-3 bg-[#FAF6EA]/30 border border-[#BFA66A]/15 rounded-lg whitespace-pre-wrap h-full">
                      {selectedConflict.existing_snapshot}
                    </p>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-xs bg-white">
                <div className="bg-[#1D1B17] px-3.5 py-2 flex items-center justify-between">
                  <span className="text-[9px] font-mono text-slate-300 font-black tracking-wider uppercase">
                    Snapshot B: Ingestion Buffer
                  </span>
                  <span className="text-[8px] font-bold bg-[#F3E2A7] border border-[#B88719]/30 px-1.5 py-0.5 rounded text-[#111111]">
                    Incoming Stream
                  </span>
                </div>
                <div className="p-3 bg-[#FAF9F5] overflow-x-auto h-full min-h-[140px]">
                  {typeof selectedConflict.incoming_snapshot === 'object' ? (
                    <pre className="bg-[#12110F] text-slate-200 text-[10px] font-mono p-3 rounded-lg overflow-x-auto leading-relaxed border border-[#BFA66A]/20 h-full">
                      {JSON.stringify(selectedConflict.incoming_snapshot, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-[11px] text-slate-700 leading-relaxed font-mono p-3 bg-[#FAF6EA]/30 border border-[#BFA66A]/15 rounded-lg whitespace-pre-wrap h-full">
                      {selectedConflict.incoming_snapshot}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Resolution form / locked archive view */}
            <div className="border-t border-[#BFA66A]/15 pt-4 space-y-4">
              {selectedConflict.status === 'pending' ? (
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-[#8A5A00] font-mono block">
                    Choose Reconciliation Action Strategy
                  </label>
                  <p className="text-[10px] text-slate-400 italic">
                    Select one canonical strategy to reconcile these records. Unallowed options are automatically disabled.
                  </p>

                  <div className="grid grid-cols-1 gap-2 pt-1 font-sans">
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('keep_existing')}
                      disabled={isMethodDisabled('keep_existing', selectedConflict.conflict_type)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer",
                        selectedMethod === 'keep_existing'
                          ? "border-[#B88719] bg-[#FFFBF0] shadow-sm ring-1 ring-[#B88719]"
                          : "border-slate-200 bg-white hover:bg-slate-50/50",
                        isMethodDisabled('keep_existing', selectedConflict.conflict_type) && "opacity-35 cursor-not-allowed bg-slate-50 border-slate-200"
                      )}
                    >
                      <span className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", selectedMethod === 'keep_existing' ? "bg-amber-600 animate-pulse" : "bg-slate-300")} />
                        Keep Stored (Canonical Snapshot A)
                      </span>
                      <span className="text-[10px] text-slate-500 leading-normal block pl-3.5">
                        Retains local Snapshot A, discarding incoming files completely.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('keep_incoming')}
                      disabled={isMethodDisabled('keep_incoming', selectedConflict.conflict_type)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer",
                        selectedMethod === 'keep_incoming'
                          ? "border-[#B88719] bg-[#FFFBF0] shadow-sm ring-1 ring-[#B88719]"
                          : "border-slate-200 bg-white hover:bg-slate-50/50",
                        isMethodDisabled('keep_incoming', selectedConflict.conflict_type) && "opacity-35 cursor-not-allowed bg-slate-50 border-slate-200"
                      )}
                    >
                      <span className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", selectedMethod === 'keep_incoming' ? "bg-amber-600 animate-pulse" : "bg-slate-300")} />
                        Over-write (Active Snapshot B)
                      </span>
                      <span className="text-[10px] text-slate-500 leading-normal block pl-3.5">
                        Supersedes database values and commits new ingestion stream raw records directly.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('merge_custom')}
                      disabled={isMethodDisabled('merge_custom', selectedConflict.conflict_type)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer",
                        selectedMethod === 'merge_custom'
                          ? "border-[#B88719] bg-[#FFFBF0] shadow-sm ring-1 ring-[#B88719]"
                          : "border-slate-200 bg-white hover:bg-slate-50/50",
                        isMethodDisabled('merge_custom', selectedConflict.conflict_type) && "opacity-35 cursor-not-allowed bg-slate-50 border-slate-200"
                      )}
                    >
                      <span className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", selectedMethod === 'merge_custom' ? "bg-amber-600 animate-pulse" : "bg-slate-300")} />
                        Guided Merge (Coexisting Hybrid Synthesis)
                      </span>
                      <span className="text-[10px] text-slate-500 leading-normal block pl-3.5">
                        Invokes AI-assisted pipeline to fuse Snapshot A and B using your custom prompt instructions.
                      </span>
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#8A5A00] font-mono block">
                      AI Directive and Synthesis Prompt Guidelines
                    </label>
                    <textarea
                      value={resolutionInstruction}
                      onChange={(e) => setResolutionInstruction(e.target.value)}
                      placeholder="e.g. Please override EU values with German tax exceptions for region-locked German IPs..."
                      className="w-full h-20 bg-white border border-slate-200 p-3 text-xs text-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#B88719] focus:border-[#B88719] transition-all font-mono leading-relaxed"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-[#FAF9F5] p-4 rounded-xl border border-[#BFA66A]/25 space-y-4 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#8A5A00] font-bold">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="uppercase font-mono text-[9px] tracking-widest">Locked Archive Record</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider block">Completed AI Prompt</span>
                    <p className="text-slate-700 italic border-l-2 border-[#BFA66A]/45 pl-2.5 leading-normal">
                      {selectedConflict.resolution_instruction || 'Standard automated baseline bypass.'}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-100 rounded-lg space-y-1">
                    <span className="text-[8px] font-mono text-slate-400 font-bold uppercase block">Determined Canonical Action</span>
                    <div className="text-xs font-bold text-[#111111] flex items-center gap-1.5 capitalize">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>{selectedConflict.selected_resolution_method?.replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                  {selectedConflict.status === 'resolved' ? (
                    <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                      <div>
                        <span>RESOLVED TIME:</span>
                        <span className="block font-bold text-slate-700 mt-0.5">{selectedConflict.resolved_at}</span>
                      </div>
                      <div>
                        <span>AUDITED BY:</span>
                        <span className="block font-bold text-slate-700 mt-0.5">{selectedConflict.resolved_by}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-200/60 text-purple-700 font-bold">
                      Awaiting batch commit run. Snapshot reconciliation scheduled for worker fleet cycle.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </DetailDrawer>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-amber-600 text-[10px] font-black tracking-widest uppercase mb-1 font-mono">
            <ShieldAlert className="w-4 h-4 text-amber-500 animate-pulse" />
            Integrity Conflict Workspace
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Conflicts Center</h1>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            Real-time reconciliation of content contradictions, metadata overlaps, and schema exceptions generated during pipeline ingestion.
          </p>
        </div>
      </div>

      {/* METRIC BANNER OVERVIEWS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div 
          onClick={() => {
            setActiveTab('pending');
            setPendingView('batches');
            setSelectedConflict(null);
          }}
          className={cn(
            "bg-white border rounded-2xl p-5 flex items-center justify-between shadow-2xs cursor-pointer transition-all hover:shadow-md",
            activeTab === 'pending' ? "border-[#BFA66A] ring-1 ring-[#BFA66A]" : "border-slate-200"
          )}
        >
          <div>
            <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">Pending Action</span>
            <h3 className="text-2xl font-bold font-display text-slate-800 mt-1">{pendingCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center font-bold font-mono">
            P
          </div>
        </div>

        <div 
          onClick={() => {
            setActiveTab('awaiting');
            setSelectedConflict(null);
          }}
          className={cn(
            "bg-white border rounded-2xl p-5 flex items-center justify-between shadow-xs cursor-pointer transition-all hover:shadow-md",
            activeTab === 'awaiting' ? "border-[#BFA66A] ring-1 ring-[#BFA66A]" : "border-slate-200"
          )}
        >
          <div>
            <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">Awaiting AI Sync</span>
            <h3 className="text-2xl font-bold font-display text-slate-800 mt-1">{awaitingCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 flex items-center justify-center font-bold font-mono font-sans">
            A
          </div>
        </div>

        <div 
          onClick={() => {
            setActiveTab('resolved');
            setSelectedConflict(null);
          }}
          className={cn(
            "bg-white border rounded-2xl p-5 flex items-center justify-between shadow-2xs cursor-pointer transition-all hover:shadow-md",
            activeTab === 'resolved' ? "border-[#BFA66A] ring-1 ring-[#BFA66A]" : "border-slate-200"
          )}
        >
          <div>
            <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">Resolved Syncs</span>
            <h3 className="text-2xl font-bold font-display text-green-700 mt-1">{resolvedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 flex items-center justify-center font-bold font-mono font-sans">
            R
          </div>
        </div>
      </div>

      {/* TIER FILTER BAR & SEARCH DIRECTLY COMPOSITED */}
      <div className="bg-[#FFFDF8] border border-[#BFA66A]/20 p-5 rounded-2xl flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#8A5A00] opacity-80 font-mono">
            Integrity Status Selection
          </span>
          <div className="flex flex-wrap gap-2.5">
            {(['pending', 'awaiting', 'resolved'] as const).map(tab => {
              const labelMap = {
                pending: `Pending (${pendingCount})`,
                awaiting: `Awaiting AI (${awaitingCount})`,
                resolved: `Resolved (${resolvedCount})`
              };
              return (
                <button 
                  key={tab} 
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedConflict(null);
                    // Select first batch default when switching to pending
                    if (tab === 'pending') {
                      setSelectedBatchId('BATCH-001');
                      setPendingView('batches');
                    }
                  }}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                    tab === activeTab 
                      ? "bg-[#B88719] text-white shadow-md shadow-[#B88719]/15" 
                      : "bg-white border border-[#BFA66A]/30 text-[#8A5A00] hover:bg-[#FFF9E8]/20"
                  )}
                >
                  {labelMap[tab]}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="border-t border-[#BFA66A]/15 pt-3.5 flex items-center">
          <div className="relative group w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A5A00] opacity-65 group-focus-within:opacity-100 transition-opacity" />
            <input 
              type="text" 
              placeholder="Filter list by ID, location, or type..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-[#BFA66A]/35 text-[#111111] placeholder:text-slate-400 rounded-2xl pl-12 pr-6 py-2.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#B88719] focus:border-[#B88719] transition-all font-mono" 
            />
          </div>
        </div>
      </div>

      {/* LAYOUT CONTAINER: INTERACTIVE DRILL-DOWN FLOW FOR BATCHES VS CONFLICTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {activeTab === 'pending' && pendingView === 'batches' && (
          /* FULL-WIDTH BATCHES SELECTION TABLE */
          <div className="lg:col-span-12 space-y-4">
            <div className="border border-[#C49A28]/35 rounded-3xl overflow-hidden bg-[#FDF2CE]/60 shadow-[0_4px_24px_rgba(184,135,25,0.06)]">
              <div className="p-5.5 bg-[#F5E098]/40 border-b border-[#C49A28]/25 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-black text-[#5A4209]/80 uppercase tracking-widest block">
                    Ingestion Batches
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Select a batch of ingested documents to explore, compare, and reconcile conflicts
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-bold uppercase py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 block">
                    KB.Batches ({batches.length})
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EDD070]/30 text-[9px] font-black text-[#5A4209]/90 uppercase tracking-widest border-b border-[#C49A28]/25">
                      <th className="px-6 py-4">Batch Identity / Name</th>
                      <th className="px-6 py-4">Extracted Date</th>
                      <th className="px-6 py-4 text-right">Pending Conflicts</th>
                      <th className="px-6 py-4 text-right font-black">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C49A28]/15 text-[#111111]">
                    {batches.map((batch) => {
                      const sizeCount = getBatchPendingCount(batch.id);
                      return (
                        <tr
                          key={batch.id}
                          onClick={() => {
                            setSelectedBatchId(batch.id);
                            setPendingView('conflicts');
                          }}
                          className="group bg-[#FDF2CE]/40 hover:bg-[#F5D96A]/25 transition-all cursor-pointer"
                        >
                          <td className="px-6 py-5">
                            <div className="font-sans text-xs font-bold text-[#111111] group-hover:text-[#B88719] transition-colors flex items-center gap-2">
                              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>{batch.name}</span>
                            </div>
                            <div className="text-[9px] text-[#777] font-mono mt-0.5">{batch.id}</div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-xs text-slate-600 font-mono flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{batch.date}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <span className={cn(
                              "px-2.5 py-1 text-[10px] font-mono font-black rounded-full border inline-block",
                              sizeCount > 0 
                                ? "bg-amber-100 text-amber-700 border-amber-300"
                                : "bg-green-100 text-green-700 border-green-300"
                            )}>
                              {sizeCount} pending
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBatchId(batch.id);
                                setPendingView('conflicts');
                              }}
                              className="px-3 py-1.5 bg-[#FFF9E8] border border-[#BFA66A]/45 hover:bg-[#B88719] hover:text-white rounded-lg text-[10px] font-bold text-[#8A5A00] uppercase tracking-wider transition-all inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Explore Batch</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONFLICTS DATA TABLE (OR SIDE-BY-SIDE SPLIT VIEW IF CONFLICT SELECTED) */}
        {(activeTab !== 'pending' || pendingView === 'conflicts') && (
          <div className="lg:col-span-12 space-y-4">
              {activeTab === 'pending' && (
                <button
                  onClick={() => {
                    setPendingView('batches');
                    setSelectedConflict(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#BFA66A]/35 hover:bg-[#FFF9E8]/20 rounded-xl text-xs font-bold text-[#8A5A00] transition-all cursor-pointer shadow-2xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Ingestion Batches</span>
                </button>
              )}

              <div className="border border-[#BFA66A]/20 rounded-3xl overflow-hidden bg-white shadow-[0_4px_24px_rgba(184,135,25,0.02)]">
                <div className="p-4 bg-[#FFFDF8] border-b border-[#BFA66A]/15 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-black text-[#5A4209]/80 uppercase tracking-widest block">
                      {activeTab === 'pending' 
                        ? `${batches.find(b => b.id === selectedBatchId)?.name || 'Batch'} Conflicts`
                        : 'Reconciliation Registry'
                      }
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {filteredConflicts.length} item{filteredConflicts.length !== 1 && 's'} listed
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold uppercase py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 block">
                      KB.Conflicts
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FFFDF8] text-[9px] font-black text-[#5A4209]/80 uppercase tracking-widest border-b border-[#BFA66A]/20">
                        <th className="px-4 py-3">Conflict Identity</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Storage Hub</th>
                        <th className="px-3 py-3">Severity</th>
                        <th className={cn("px-3 py-3", selectedConflict && "hidden xl:table-cell")}>Detected</th>
                        <th className="px-4 py-3 text-right font-black">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#BFA66A]/10 text-[#111111]">
                      {filteredConflicts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-8 py-16 text-center text-slate-500 text-xs font-mono bg-white">
                            No conflicts registered under this criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredConflicts.map((c) => {
                          const isSelected = selectedConflict?.conflict_id === c.conflict_id;
                          return (
                            <tr 
                              key={c.conflict_id} 
                              onClick={() => handleOpenConflict(c)}
                              className={cn(
                                "group transition-all duration-150 cursor-pointer",
                                isSelected 
                                  ? "bg-[#FFF9E8] border-l-2 border-l-[#B88719]" 
                                  : "hover:bg-[#FFF9E8]/20"
                              )}
                            >
                              {/* Conflict Identity Column */}
                              <td className="px-4 py-4">
                                <div className="font-mono text-xs font-bold text-[#111111] group-hover:text-[#B88719] transition-colors flex items-center gap-1">
                                  <FolderOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{c.conflict_id}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-sans mt-0.5 truncate max-w-[120px]">{c.tenant_id}</div>
                              </td>

                              {/* Conflict Type Wording */}
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-1 font-sans">
                                  <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="text-[11px] font-bold text-slate-700 capitalize truncate max-w-[120px]">
                                    {getConflictTypeLabel(c.conflict_type)}
                                  </span>
                                </div>
                              </td>

                              {/* Storage Hub Source */}
                              <td className="px-4 py-4 font-mono text-xs text-slate-600 capitalize">
                                <div className="flex items-center gap-1">
                                  {c.where_happens === 'vector database' ? (
                                    <Database className="w-3 h-3 text-blue-500 shrink-0" />
                                  ) : (
                                    <Network className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  )}
                                  <span className="text-[11px] truncate max-w-[100px]">{c.where_happens}</span>
                                </div>
                              </td>

                              {/* Severity Badge */}
                              <td className="px-3 py-4">
                                {renderSeverityBadge(c.severity)}
                              </td>

                              {/* Detected At Timer */}
                              <td className="px-3 py-4 text-xs text-slate-500 font-mono">
                                <div className="flex items-center gap-1 text-[10px]">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{c.detected_at}</span>
                                </div>
                              </td>

                              {/* Explicit Button Action */}
                              <td className="px-4 py-4 text-right">
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleOpenConflict(c); 
                                  }}
                                  className={cn(
                                    "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all inline-flex items-center gap-0.5 cursor-pointer",
                                    isSelected
                                      ? "bg-[#B88719] text-white shadow-xs"
                                      : "bg-[#FFF9E8] border border-[#BFA66A]/45 hover:bg-[#B88719] hover:text-white text-[#8A5A00]"
                                  )}
                                >
                                  <span>{isSelected ? 'Active' : 'Review'}</span>
                                  <ChevronRight className="w-2.5 h-2.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
        )}


      </div>

    </div>
  );
};

export default ConflictWorkspace;
