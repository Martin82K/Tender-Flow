import React, { useState, useEffect } from 'react';
import { orgSubscriptionRpc } from '@/infra/org-billing/orgSubscriptionRpc';
import { getTierLabel, getTierBadgeClass, getDisplayTiers } from '@/config/subscriptionTiers';

type OrgRow = Awaited<ReturnType<typeof orgSubscriptionRpc.getAllOrganizationsAdmin>>[number];

interface EditState {
  tier: string;
  maxSeats: number;
  reason: string;
}

export const AdminOrganizationsPanel: React.FC = () => {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ tier: '', maxSeats: 1, reason: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadOrgs = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await orgSubscriptionRpc.getAllOrganizationsAdmin();
      setOrgs(data);
    } catch (err: any) {
      console.error('[AdminOrganizationsPanel] Failed to load:', err);
      setMessage({ type: 'error', text: `Chyba při načítání organizací: ${err?.message || String(err)}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrgs(); }, []);

  const startEdit = (org: OrgRow) => {
    setEditingOrgId(org.org_id);
    setEditState({
      tier: org.override_tier || org.subscription_tier || 'free',
      maxSeats: org.max_seats,
      reason: org.override_reason || '',
    });
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingOrgId(null);
  };

  const handleSave = async (orgId: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await orgSubscriptionRpc.adminUpdateOrgSubscription(
        orgId,
        editState.tier || null,
        editState.maxSeats,
        editState.reason || null,
      );
      setEditingOrgId(null);
      await loadOrgs();
      setMessage({ type: 'success', text: 'Organizace aktualizována.' });
    } catch (err) {
      console.error('[AdminOrganizationsPanel] Save failed:', err);
      setMessage({ type: 'error', text: 'Chyba při ukládání.' });
    } finally {
      setSaving(false);
    }
  };

  const filteredOrgs = orgs.filter(o =>
    o.org_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tiers = getDisplayTiers();

  return (
    <section className="bg-white dark:bg-slate-950 dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-slate-950/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">domain</span>
        Správa organizací
        <span className="ml-2 px-2.5 py-1 bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/30">
          Admin
        </span>
      </h2>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat organizaci..."
            className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="material-symbols-outlined animate-spin text-slate-400 text-[32px]">sync</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/50">
                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                  Organizace
                </th>
                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                  Plán
                </th>
                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                  Max. licencí
                </th>
                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                  Obsazeno
                </th>
                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                  Status
                </th>
                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 italic">
                    Žádné organizace nenalezeny
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => {
                  const isEditing = editingOrgId === org.org_id;
                  const effectiveTier = org.override_tier || org.subscription_tier || 'free';

                  return (
                    <tr
                      key={org.org_id}
                      className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Org name */}
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                            {(org.org_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {org.org_name || '(bez názvu)'}
                            </span>
                            {org.override_tier && (
                              <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded border border-amber-500/30">
                                OVERRIDE
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="py-3 px-2">
                        {isEditing ? (
                          <select
                            value={editState.tier}
                            onChange={(e) => setEditState(s => ({ ...s, tier: e.target.value }))}
                            className="rounded-lg bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600/50 px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:border-primary/50 focus:outline-none min-w-[120px]"
                          >
                            {tiers.map((t) => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg ${getTierBadgeClass(effectiveTier as any)}`}>
                            {getTierLabel(effectiveTier as any)}
                          </span>
                        )}
                      </td>

                      {/* Max seats */}
                      <td className="py-3 px-2">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            max={9999}
                            value={editState.maxSeats}
                            onChange={(e) => setEditState(s => ({ ...s, maxSeats: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="w-20 rounded-lg bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600/50 px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:border-primary/50 focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {org.max_seats}
                          </span>
                        )}
                      </td>

                      {/* Used seats */}
                      <td className="py-3 px-2">
                        <span className={`text-sm font-medium ${
                          org.billable_seats >= org.max_seats
                            ? 'text-red-500'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {org.billable_seats} / {org.max_seats}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-2">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          org.subscription_status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : org.subscription_status === 'trial'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500'
                        }`}>
                          {org.subscription_status || 'active'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editState.reason}
                              onChange={(e) => setEditState(s => ({ ...s, reason: e.target.value }))}
                              placeholder="Důvod..."
                              className="w-32 rounded-lg bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600/50 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:border-primary/50 focus:outline-none"
                            />
                            <button
                              onClick={() => handleSave(org.org_id)}
                              disabled={saving}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/80 transition-colors disabled:opacity-50"
                            >
                              {saving ? 'Ukládám...' : 'Uložit'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                              Zrušit
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(org)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Upravit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
        <span className="text-xs text-slate-500">
          Zobrazeno {filteredOrgs.length} z {orgs.length} organizací
        </span>
        <button
          onClick={loadOrgs}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
        >
          <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          Obnovit
        </button>
      </div>
    </section>
  );
};
