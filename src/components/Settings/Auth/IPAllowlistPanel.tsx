import React, { useState } from 'react';
import { Globe, Plus, Trash2, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { DetailDrawer } from '../../shared/DetailDrawer';

const ALLOWLIST = [
  { id: 'ip1', cidr: '10.0.0.0/24',    label: 'Corporate VPN – APAC',     tenant: 'GlobalCorp',  is_active: true,  created_by: 'linh.nguyen', created_at: '2026-04-01' },
  { id: 'ip2', cidr: '192.168.10.0/24', label: 'Office Network – SG',      tenant: 'GlobalCorp',  is_active: true,  created_by: 'linh.nguyen', created_at: '2026-04-01' },
  { id: 'ip3', cidr: '172.16.0.0/16',  label: 'Finance Internal Range',    tenant: 'FinanceHub',  is_active: true,  created_by: 'sarah.chen',  created_at: '2026-03-15' },
  { id: 'ip4', cidr: '203.0.113.0/24', label: 'EU Compliance Gateway',     tenant: 'EuroTrust',   is_active: false, created_by: 'admin',       created_at: '2026-02-10' },
];

export const IPAllowlistPanel = () => {
  const [showAdd, setShowAdd] = useState(false);
  const [newCidr, setNewCidr] = useState('');
  const [newLabel, setNewLabel] = useState('');

  return (
    <>
      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#111111]">IP / CIDR Allowlist</h3>
              <p className="text-xs text-[#5A5A5A] mt-0.5">
                Enforced at Kong Gateway via IP restriction plugin — table <code className="font-mono bg-[#F4E8C3] px-1 rounded">ip_allowlists</code>
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#111111] text-white rounded-xl text-xs font-bold hover:bg-[#2a2a2a] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add CIDR
            </button>
          </div>

          <div className="p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">
              IP Allowlisting is enforced by <strong>Kong IP restriction plugin</strong>, not Keycloak. Changes take effect after Kong Admin API sync.
            </p>
          </div>

          <div className="space-y-2">
            {ALLOWLIST.map(rule => (
              <div
                key={rule.id}
                className={cn(
                  'flex items-center justify-between p-4 bg-white border rounded-2xl transition-all',
                  rule.is_active ? 'border-[#E8DFC8] hover:border-[#B88719]' : 'border-[#EEEEEE] opacity-60',
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center border shrink-0',
                    rule.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-[#F4F4F4] border-[#DDD] text-[#999]',
                  )}>
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-bold text-[#111111]">{rule.cidr}</code>
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                        rule.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F4F4F4] text-[#999]',
                      )}>
                        {rule.is_active ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-[#777]">{rule.label}</span>
                      <span className="text-[10px] text-[#B88719] font-bold">{rule.tenant}</span>
                      <span className="text-[10px] text-[#999]">by {rule.created_by}</span>
                    </div>
                  </div>
                </div>
                <button className="p-2 text-[#DDD] hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <DetailDrawer
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add IP / CIDR Rule"
        subtitle="Network allowlist entry"
        icon={Globe}
        size="sm"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button className="btn-primary">Add Rule</button>
          </div>
        }
      >
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider mb-1.5">CIDR</label>
            <input
              value={newCidr}
              onChange={e => setNewCidr(e.target.value)}
              placeholder="10.0.0.0/24"
              className="w-full px-3 py-2 bg-white border border-[#D6C79F] rounded-xl text-sm font-mono text-[#111111] focus:outline-none focus:border-[#B88719]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider mb-1.5">Label</label>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Corporate VPN – HCM"
              className="w-full px-3 py-2 bg-white border border-[#D6C79F] rounded-xl text-sm text-[#111111] focus:outline-none focus:border-[#B88719]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider mb-1.5">Tenant</label>
            <select className="w-full px-3 py-2 bg-white border border-[#D6C79F] rounded-xl text-sm text-[#111111] focus:outline-none focus:border-[#B88719]">
              <option>GlobalCorp</option>
              <option>FinanceHub</option>
              <option>EuroTrust</option>
            </select>
          </div>
        </div>
      </DetailDrawer>
    </>
  );
};
