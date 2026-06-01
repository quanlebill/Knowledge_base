import React, { useState } from 'react';
import {
  Key, Plus, RefreshCw, XCircle, Eye, EyeOff, Copy,
  AlertCircle, CheckCircle2, Clock, Shield,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { DetailDrawer } from '../../shared/DetailDrawer';

const API_KEYS = [
  {
    id: 'ak1', name: 'Production Ingestion Key', prefix: 'sk-prod-Xa4z',
    scope: 'full_access', created_by: 'linh.nguyen', tenant: 'GlobalCorp',
    last_used_at: '2m ago', expires_at: '2026-12-31', revoked_at: null, rotated_from: null,
  },
  {
    id: 'ak2', name: 'Read-Only Analytics', prefix: 'sk-ro-Bc9k',
    scope: 'read_only', created_by: 'sarah.chen', tenant: 'FinanceHub',
    last_used_at: '1h ago', expires_at: '2026-09-01', revoked_at: null, rotated_from: null,
  },
  {
    id: 'ak3', name: 'Admin Provisioning', prefix: 'sk-adm-Df2m',
    scope: 'admin_platform', created_by: 'linh.nguyen', tenant: 'GlobalCorp',
    last_used_at: '3d ago', expires_at: '2026-06-30', revoked_at: null, rotated_from: null,
  },
  {
    id: 'ak4', name: 'CI/CD Pipeline Key (rotated)', prefix: 'sk-ci-Xp8n',
    scope: 'full_access', created_by: 'bot-ci', tenant: 'GlobalCorp',
    last_used_at: '7d ago', expires_at: '2026-03-01', revoked_at: '2026-03-05 09:12', rotated_from: null,
  },
];

const SCOPE_COLOR: Record<string, string> = {
  full_access:    'bg-[#FFF3E0] text-[#E65100] border-[#FFCC80]',
  read_only:      'bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]',
  admin_platform: 'bg-[#EDE7F6] text-[#4527A0] border-[#CE93D8]',
};

export const APIKeysPanel = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (prefix: string, id: string) => {
    navigator.clipboard.writeText(`${prefix}...`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <>
      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#111111]">API Keys</h3>
              <p className="text-xs text-[#5A5A5A] mt-0.5">
                Programmatic access keys — bcrypt-hashed, table <code className="font-mono bg-[#F4E8C3] px-1 rounded">api_keys</code>. Raw key shown once on creation.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#111111] text-white rounded-xl text-xs font-bold hover:bg-[#2a2a2a] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create Key
            </button>
          </div>

          <div className="space-y-2">
            {API_KEYS.map(key => {
              const isRevoked = !!key.revoked_at;
              const isRevealed = revealKey === key.id;
              return (
                <div
                  key={key.id}
                  className={cn(
                    'p-4 bg-white border rounded-2xl transition-all',
                    isRevoked ? 'border-red-200 opacity-60' : 'border-[#E8DFC8] hover:border-[#B88719]',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center border shrink-0',
                        isRevoked ? 'bg-red-50 border-red-200 text-red-400' : 'bg-[#F4E8C3] border-[#BFA66A] text-[#B88719]',
                      )}>
                        <Key className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#111111]">{key.name}</span>
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border', SCOPE_COLOR[key.scope])}>
                            {key.scope}
                          </span>
                          {isRevoked && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                              REVOKED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <code className="text-[10px] font-mono text-[#777]">
                            {isRevealed ? key.prefix + 'xxxxxxxxxxxxxxxx' : key.prefix + '...'}
                          </code>
                          <span className="text-[10px] text-[#999]">{key.tenant}</span>
                          <span className="text-[10px] text-[#999]">by {key.created_by}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-[#777]">Last used</div>
                        <div className="text-xs font-bold text-[#111111]">{key.last_used_at}</div>
                      </div>
                      {!isRevoked && (
                        <>
                          <button
                            onClick={() => setRevealKey(isRevealed ? null : key.id)}
                            className="p-2 text-[#777] hover:text-[#111111] transition-colors"
                            title={isRevealed ? 'Hide' : 'Reveal prefix'}
                          >
                            {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleCopy(key.prefix, key.id)}
                            className="p-2 text-[#777] hover:text-[#B88719] transition-colors"
                          >
                            {copiedId === key.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setRotateTarget(key.id)}
                            className="p-2 text-[#777] hover:text-[#B88719] transition-colors"
                            title="Rotate key"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-[#777] hover:text-red-500 transition-colors" title="Revoke">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {isRevoked && (
                        <span className="text-[10px] text-red-400 font-mono">{key.revoked_at}</span>
                      )}
                    </div>
                  </div>

                  {!isRevoked && (
                    <div className="mt-3 pt-3 border-t border-[#F0E8D4] flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-[#999]" />
                        <span className="text-[10px] text-[#777]">Expires {key.expires_at}</span>
                      </div>
                      {key.rotated_from && (
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 text-[#B88719]" />
                          <span className="text-[10px] text-[#B88719]">Rotated from previous key</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 p-3 bg-[#F8F5EC] border border-[#E8DFC8] rounded-xl">
            <p className="text-[11px] text-[#777] leading-relaxed">
              <strong className="text-[#111111]">Security:</strong> Raw API keys are never stored — only <code className="font-mono bg-[#F4E8C3] px-1 rounded">bcrypt(key)</code> hash is saved in DB.
              The <code className="font-mono bg-[#F4E8C3] px-1 rounded">key_prefix</code> is displayed for identification only.
              Rotation creates a new key and links via <code className="font-mono bg-[#F4E8C3] px-1 rounded">rotated_from</code> for audit chain.
            </p>
          </div>
        </section>
      </div>

      {/* Create Key Drawer */}
      <DetailDrawer
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create API Key"
        subtitle="Programmatic access credential"
        icon={Key}
        size="sm"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button className="btn-primary">Generate Key</button>
          </div>
        }
      >
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider mb-1.5">Key Name</label>
            <input placeholder="CI/CD Pipeline Key" className="w-full px-3 py-2 bg-white border border-[#D6C79F] rounded-xl text-sm text-[#111111] focus:outline-none focus:border-[#B88719]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider mb-1.5">Scope</label>
            <select className="w-full px-3 py-2 bg-white border border-[#D6C79F] rounded-xl text-sm text-[#111111] focus:outline-none focus:border-[#B88719]">
              <option value="read_only">read_only</option>
              <option value="full_access">full_access</option>
              <option value="admin_platform">admin_platform</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider mb-1.5">Expiry Date</label>
            <input type="date" className="w-full px-3 py-2 bg-white border border-[#D6C79F] rounded-xl text-sm text-[#111111] focus:outline-none focus:border-[#B88719]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider mb-1.5">Tenant</label>
            <select className="w-full px-3 py-2 bg-white border border-[#D6C79F] rounded-xl text-sm text-[#111111] focus:outline-none focus:border-[#B88719]">
              <option>GlobalCorp</option>
              <option>FinanceHub</option>
              <option>EuroTrust</option>
            </select>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">The raw API key is shown only once after creation. Copy and store it securely.</p>
          </div>
        </div>
      </DetailDrawer>

      {/* Rotate Confirm Drawer */}
      <DetailDrawer
        isOpen={!!rotateTarget}
        onClose={() => setRotateTarget(null)}
        title="Rotate API Key"
        subtitle="This will create a new key and link it via rotated_from"
        icon={RefreshCw}
        size="sm"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setRotateTarget(null)} className="btn-secondary">Cancel</button>
            <button className="btn-primary">Confirm Rotation</button>
          </div>
        }
      >
        <div className="p-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 mb-1">Impact</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                A new key will be generated. The old key will be invalidated after a 24-hour grace period.
                The rotation chain is preserved via <code className="font-mono bg-amber-100 px-1 rounded">rotated_from</code> FK for audit purposes.
              </p>
            </div>
          </div>
        </div>
      </DetailDrawer>
    </>
  );
};
