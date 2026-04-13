/**
 * OrganizationDashboard
 *
 * Unified organization settings dashboard with sub-tabs:
 * Přehled, Členové, Předplatné, Branding.
 *
 * Replaces the old monolithic OrganizationSettings component.
 */

import React, { useEffect, useState } from 'react';
import {
  organizationService,
  type OrganizationSummary,
} from '@/services/organizationService';
import type { OrgSubTab } from '../model/types';
import { OrgOverviewTab } from './OrgOverviewTab';
import { OrgMembersTab } from './OrgMembersTab';
import { OrgBillingTab } from './OrgBillingTab';
import { OrgBrandingTab } from './OrgBrandingTab';

interface OrganizationDashboardProps {
  activeSubTab: OrgSubTab;
  onSubTabChange: (tab: OrgSubTab) => void;
}

const SUB_TABS: { id: OrgSubTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Přehled', icon: 'dashboard' },
  { id: 'members', label: 'Členové', icon: 'group' },
  { id: 'billing', label: 'Předplatné', icon: 'credit_card' },
  { id: 'branding', label: 'Branding', icon: 'palette' },
];

export const OrganizationDashboard: React.FC<OrganizationDashboardProps> = ({
  activeSubTab,
  onSubTabChange,
}) => {
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrgs = async () => {
      setLoading(true);
      try {
        const orgs = await organizationService.getMyOrganizations();
        setOrganizations(orgs);
        if (orgs.length > 0 && !selectedOrgId) {
          setSelectedOrgId(orgs[0].organization_id);
        }
      } catch (err) {
        console.error('[OrganizationDashboard] Failed to load organizations:', err);
      } finally {
        setLoading(false);
      }
    };
    loadOrgs();
  }, []);

  const selectedOrg = organizations.find(o => o.organization_id === selectedOrgId);
  const isOwner = selectedOrg?.member_role === 'owner';
  const isAdminOrOwner = selectedOrg?.member_role === 'owner' || selectedOrg?.member_role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-primary rounded-full" />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4 block">
          business
        </span>
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
          Nejste členem žádné organizace
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Požádejte správce organizace o pozvánku, nebo vytvořte novou organizaci.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Org selector (if user is in multiple orgs) */}
      {organizations.length > 1 && (
        <div className="mb-6">
          <select
            value={selectedOrgId}
            onChange={e => setSelectedOrgId(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {organizations.map(org => (
              <option key={org.organization_id} value={org.organization_id}>
                {org.organization_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sub-tab navigation */}
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 flex-shrink-0">
          <nav className="flex flex-col gap-2">
            {SUB_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => onSubTabChange(tab.id)}
                className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  activeSubTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">
                    {tab.icon}
                  </span>
                  {tab.label}
                </div>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 overflow-x-hidden">
          {activeSubTab === 'overview' && selectedOrgId && (
            <OrgOverviewTab
              orgId={selectedOrgId}
              orgName={selectedOrg?.organization_name || ''}
              isOwner={isOwner}
              onNavigate={onSubTabChange}
            />
          )}
          {activeSubTab === 'members' && selectedOrgId && (
            <OrgMembersTab
              orgId={selectedOrgId}
              isAdminOrOwner={isAdminOrOwner}
              isOwner={isOwner}
            />
          )}
          {activeSubTab === 'billing' && selectedOrgId && (
            <OrgBillingTab
              orgId={selectedOrgId}
              isOwner={isOwner}
            />
          )}
          {activeSubTab === 'branding' && selectedOrgId && (
            <OrgBrandingTab
              orgId={selectedOrgId}
              isAdminOrOwner={isAdminOrOwner}
            />
          )}
        </main>
      </div>
    </div>
  );
};
