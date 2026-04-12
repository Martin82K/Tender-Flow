/**
 * OrgMembersTab
 *
 * Organization members management — list, search, add, role change,
 * join requests, and seat info.
 */

import React, { useEffect, useState } from 'react';
import {
  organizationService,
  type OrganizationMember,
  type OrganizationJoinRequest,
} from '@/services/organizationService';
import { getOrgSeatUsage } from '../api/orgBillingService';
import { formatOrgRole, isOrgOwnerRole } from '@/utils/organizationUtils';
import { useUI } from '@/context/UIContext';
import type { OrgSeatUsage } from '../model/types';

interface OrgMembersTabProps {
  orgId: string;
  isAdminOrOwner: boolean;
  isOwner: boolean;
}

export const OrgMembersTab: React.FC<OrgMembersTabProps> = ({
  orgId,
  isAdminOrOwner,
  isOwner,
}) => {
  const { showAlert, showConfirm } = useUI();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [requests, setRequests] = useState<OrganizationJoinRequest[]>([]);
  const [seatUsage, setSeatUsage] = useState<OrgSeatUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [manualAddEmail, setManualAddEmail] = useState('');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersList, requestsList, seats] = await Promise.all([
        organizationService.getOrganizationMembers(orgId),
        isAdminOrOwner ? organizationService.getOrganizationJoinRequests(orgId).catch(() => []) : Promise.resolve([]),
        getOrgSeatUsage(orgId),
      ]);
      setMembers(membersList);
      setRequests(requestsList.filter(r => r.status === 'pending'));
      setSeatUsage(seats);
    } catch (err) {
      console.error('[OrgMembersTab] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [orgId]);

  const handleAddMember = async () => {
    if (!manualAddEmail.trim()) return;
    try {
      await organizationService.addOrganizationMemberByEmail(orgId, manualAddEmail.trim(), 'member');
      showAlert({ title: 'Hotovo', message: 'Člen byl přidán do organizace.', variant: 'success' });
      setManualAddEmail('');
      await loadData();
    } catch (err: any) {
      showAlert({ title: 'Chyba', message: err?.message || 'Nepodařilo se přidat člena.', variant: 'danger' });
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member') => {
    try {
      await organizationService.updateOrganizationMemberRole(orgId, userId, newRole);
      showAlert({ title: 'Hotovo', message: 'Role byla změněna.', variant: 'success' });
      await loadData();
    } catch (err: any) {
      showAlert({ title: 'Chyba', message: err?.message || 'Nepodařilo se změnit roli.', variant: 'danger' });
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      await organizationService.approveJoinRequest(requestId);
      showAlert({ title: 'Hotovo', message: 'Žádost schválena.', variant: 'success' });
      await loadData();
    } catch (err: any) {
      showAlert({ title: 'Chyba', message: err?.message || 'Chyba při schvalování.', variant: 'danger' });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      await organizationService.rejectJoinRequest(requestId);
      showAlert({ title: 'Info', message: 'Žádost odmítnuta.' });
      await loadData();
    } catch (err: any) {
      showAlert({ title: 'Chyba', message: err?.message || 'Chyba při odmítání.', variant: 'danger' });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const filteredMembers = members.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.email || '').toLowerCase().includes(q) ||
      (m.display_name || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-primary rounded-full" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Členové organizace
        </h3>
        <div className="flex gap-2">
          <div className="relative">
            <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hledat členy..."
              className="pl-9 pr-3 py-2 w-56 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          {isAdminOrOwner && (
            <div className="flex gap-2">
              <input
                type="email"
                value={manualAddEmail}
                onChange={e => setManualAddEmail(e.target.value)}
                placeholder="email@firma.cz"
                className="px-3 py-2 w-48 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                onKeyDown={e => e.key === 'Enter' && handleAddMember()}
              />
              <button
                onClick={handleAddMember}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-primary to-primary/90 text-white hover:opacity-90 transition-opacity"
              >
                + Přidat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Seat Info Callout */}
      {seatUsage && (
        <div className="flex items-start gap-3 px-4 py-3 bg-primary/5 border border-primary/15 rounded-xl text-sm text-slate-600 dark:text-slate-400">
          <span className="material-symbols-outlined text-[20px] text-primary flex-shrink-0 mt-0.5">info</span>
          <div>
            Používáte <strong className="text-slate-700 dark:text-slate-300">{seatUsage.billableSeats}</strong> z <strong className="text-slate-700 dark:text-slate-300">{seatUsage.maxSeats}</strong> míst.
            {seatUsage.availableSeats > 0
              ? ` K dispozici ${seatUsage.availableSeats} volných míst.`
              : ' Všechna místa jsou obsazena. Pro přidání dalších členů je potřeba navýšit počet seats.'}
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Člen</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Role</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Přidán</th>
              {isAdminOrOwner && <th className="w-12"></th>}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map(member => {
              const initials = (member.display_name || member.email || '??')
                .split(/[\s@]/)
                .filter(Boolean)
                .slice(0, 2)
                .map(s => s[0]?.toUpperCase())
                .join('');
              const isOwnerMember = isOrgOwnerRole(member.role);

              return (
                <tr key={member.user_id} className="border-b border-slate-100 dark:border-slate-700/30 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {member.display_name || member.email}
                        </div>
                        {member.display_name && (
                          <div className="text-xs text-slate-400">{member.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded ${
                      isOwnerMember
                        ? 'bg-primary/10 text-primary'
                        : member.role === 'admin'
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {formatOrgRole(member.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-slate-500">Aktivní</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {member.joined_at ? new Date(member.joined_at).toLocaleDateString('cs-CZ', { month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  {isAdminOrOwner && (
                    <td className="px-4 py-3">
                      {!isOwnerMember && isOwner && (
                        <select
                          value={member.role}
                          onChange={e => handleRoleChange(member.user_id, e.target.value as 'admin' | 'member')}
                          className="text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-500"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  {search ? 'Žádný člen neodpovídá hledání.' : 'Žádní členové.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Join Requests */}
      {requests.length > 0 && isAdminOrOwner && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-500">mail</span>
            Žádosti o vstup ({requests.length})
          </h4>
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.request_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center text-xs font-bold">
                    {(req.email || '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {req.display_name || req.email}
                    </div>
                    <div className="text-xs text-slate-400">{req.email}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveRequest(req.request_id)}
                    disabled={processingRequestId === req.request_id}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-primary to-primary/90 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Schválit
                  </button>
                  <button
                    onClick={() => handleRejectRequest(req.request_id)}
                    disabled={processingRequestId === req.request_id}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    Odmítnout
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
