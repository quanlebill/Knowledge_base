import React from 'react';
import { History, User, Activity, Search, Filter } from 'lucide-react';
import { DataTable } from './shared/DataTable';
import { StatusBadge } from './shared/StatusBadge';

const AUDIT_LOGS = [
  { id: 'LOG-4829', actor: 'admin@aeroflow.io', action: 'DEPLOY_MODEL', resource: 'gpt-4o-finetuned', timestamp: '10m ago', status: 'SUCCESS' },
  { id: 'LOG-4830', actor: 'system-agent-01', action: 'SCHEMA_UPDATE', resource: 'KB-V2-GOLD', timestamp: '14m ago', status: 'SUCCESS' },
  { id: 'LOG-4831', actor: 'engineer@aeroflow.io', action: 'API_KEY_ROTATION', resource: 'Anthropic Prod', timestamp: '1h ago', status: 'SUCCESS' },
  { id: 'LOG-4832', actor: 'admin@aeroflow.io', action: 'POLICY_OVERRIDE', resource: 'PII-REDACT', timestamp: '2h ago', status: 'WARNING' },
  { id: 'LOG-4833', actor: 'system-worker', action: 'AUTOSCALE_UP', resource: 'US-EAST-WORKERS', timestamp: '4h ago', status: 'SUCCESS' },
];

export const AuditLogsView = () => {
  const columns = [
    { header: 'ID', accessor: 'id' as const, className: 'font-mono text-slate-500' },
    { header: 'Actor', accessor: (l: any) => (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
          <User className="w-3 h-3 text-slate-400" />
        </div>
        <span className="text-sm font-medium text-slate-300">{l.actor}</span>
      </div>
    ) },
    { header: 'Action', accessor: (l: any) => <span className="font-bold text-white uppercase italic">{l.action}</span> },
    { header: 'Resource', accessor: 'resource' as const, className: 'text-slate-400' },
    { header: 'Timestamp', accessor: 'timestamp' as const },
    { header: 'State', accessor: (l: any) => <StatusBadge status={l.status} size="sm" /> },
  ];

  return (
    <DataTable 
      title="Global Audit Ledger"
      subtitle="Immutable trail of all operational and administrative actions"
      data={AUDIT_LOGS}
      columns={columns}
    />
  );
};
