import React, { useEffect, useMemo, useState } from "react";
import { organizationService, type OrganizationJoinRequest, type OrganizationMember, type OrganizationSummary } from "../../services/organizationService";
import { useUI } from "../../context/UIContext";
import { formatOrgRole, isOrgAdminRole } from "../../utils/organizationUtils";
import { userManagementService } from "../../services/userManagementService";

export const OrganizationSettings: React.FC = () => {
  const { showAlert } = useUI();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [requests, setRequests] = useState<OrganizationJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<{ user_id: string; email: string }[]>([]);
  const [manualAddUserId, setManualAddUserId] = useState("");
  const [notAuthorized, setNotAuthorized] = useState(false);

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.organization_id === selectedOrgId) || null,
    [organizations, selectedOrgId],
  );

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((req) => req.email.toLowerCase().includes(query));
  }, [requests, search]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => member.email.toLowerCase().includes(query));
  }, [members, search]);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const data = await organizationService.getMyOrganizations();
      setOrganizations(data);
      if (data.length > 0) {
        setSelectedOrgId(data[0].organization_id);
      }
    } catch (error) {
      console.error("Failed to load organizations:", error);
      showAlert({
        title: "Chyba",
        message: "Nelze načíst organizace.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOrgData = async (orgId: string) => {
    setLoading(true);
    setNotAuthorized(false);
    try {
      const org = organizations.find((o) => o.organization_id === orgId);
      const isAdminRole = isOrgAdminRole(org?.member_role);

      if (!isAdminRole) {
        setMembers([]);
        setRequests([]);
        setAllUsers([]);
        setNotAuthorized(true);
        return;
      }

      const membersData = await organizationService.getOrganizationMembers(orgId);
      setMembers(membersData);

      try {
        const requestsData = await organizationService.getOrganizationJoinRequests(orgId);
        setRequests(requestsData.filter((req) => req.status === "pending"));
      } catch (error) {
        console.error("Failed to load join requests:", error);
        setRequests([]);
      }

      const usersData = await userManagementService.getAllUsers();
      setAllUsers(usersData.map((u) => ({ user_id: u.user_id, email: u.email })));
    } catch (error) {
      console.error("Failed to load org data:", error);
      showAlert({
        title: "Chyba",
        message: "Nelze načíst členy nebo žádosti.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      loadOrgData(selectedOrgId);
    }
  }, [selectedOrgId]);

  const handleApprove = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      await organizationService.approveJoinRequest(requestId);
      await loadOrgData(selectedOrgId);
      showAlert({
        title: "Hotovo",
        message: "Uživatel byl potvrzen v organizaci.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to approve request:", error);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se potvrdit uživatele.",
        variant: "danger",
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      await organizationService.rejectJoinRequest(requestId);
      await loadOrgData(selectedOrgId);
      showAlert({
        title: "Hotovo",
        message: "Žádost byla zamítnuta.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to reject request:", error);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se zamítnout žádost.",
        variant: "danger",
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleManualAdd = async () => {
    if (!manualAddUserId || !selectedOrgId) return;
    try {
      await organizationService.addOrganizationMember(selectedOrgId, manualAddUserId, "member");
      setManualAddUserId("");
      await loadOrgData(selectedOrgId);
      showAlert({
        title: "Hotovo",
        message: "Uživatel byl přidán do organizace.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to add org member:", error);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se přidat uživatele.",
        variant: "danger",
      });
    }
  };

  const eligibleUsers = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.user_id));
    const pendingIds = new Set(requests.map((r) => r.user_id));
    return allUsers.filter((u) => !memberIds.has(u.user_id) && !pendingIds.has(u.user_id));
  }, [allUsers, members, requests]);

  if (loading && organizations.length === 0) {
    return (
      <div className="flex justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-emerald-400">domain</span>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Organizace
        </h2>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Potvrzujte uživatele v organizaci a získáte úplný přístup k datům
        subdodavatelů i staveb.
      </p>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="h-10 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
        >
          {organizations.map((org) => (
            <option key={org.organization_id} value={org.organization_id}>
              {org.organization_name} ({formatOrgRole(org.member_role)})
            </option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Vyhledat uživatele podle emailu"
          className="flex-1 h-10 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
        />
      </div>

      {notAuthorized && (
        <div className="mb-6 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Nemáte roli administrátora v této organizaci. Pro schvalování požádejte vlastníka o roli admin.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Čekající žádosti
          </h3>
          {filteredRequests.length === 0 ? (
            <div className="text-sm text-slate-500">Žádné čekající žádosti.</div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <div key={req.request_id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {req.email}
                    </div>
                    <div className="text-xs text-slate-500">
                      Požádáno {new Date(req.created_at).toLocaleDateString("cs-CZ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={processingRequestId === req.request_id}
                      onClick={() => handleApprove(req.request_id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/40"
                    >
                      Potvrdit
                    </button>
                    <button
                      type="button"
                      disabled={processingRequestId === req.request_id}
                      onClick={() => handleReject(req.request_id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/40"
                    >
                      Zamítnout
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Členové organizace
          </h3>
          {filteredMembers.length === 0 ? (
            <div className="text-sm text-slate-500">Žádní členové.</div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div key={member.user_id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {member.email}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatOrgRole(member.role)} · Přidán {new Date(member.joined_at).toLocaleDateString("cs-CZ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Schválit uživatele bez žádosti
        </h3>
        <p className="text-xs text-slate-500">
          Použijte v případě, že se žádost nevytvořila automaticky.
        </p>
        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={manualAddUserId}
            onChange={(e) => setManualAddUserId(e.target.value)}
            className="h-10 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
          >
            <option value="">Vyberte uživatele</option>
            {eligibleUsers.map((user) => (
              <option key={user.user_id} value={user.user_id}>
                {user.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleManualAdd}
            disabled={!manualAddUserId}
            className="h-10 px-4 rounded-lg text-sm font-medium bg-emerald-600 text-white disabled:opacity-50"
          >
            Přidat
          </button>
        </div>
      </div>

      {selectedOrg?.domain_whitelist?.length ? (
        <div className="mt-6 text-xs text-slate-500">
          Domény v organizaci: {selectedOrg.domain_whitelist.join(", ")}
        </div>
      ) : null}
    </section>
  );
};
