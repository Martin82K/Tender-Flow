import React, { useEffect, useMemo, useState } from "react";
import { organizationService, type OrganizationJoinRequest, type OrganizationMember, type OrganizationSummary } from "../../services/organizationService";
import { useUI } from "../../context/UIContext";
import { formatOrgRole, getUserLabel, getUserSortKey, isOrgOwnerRole } from "../../utils/organizationUtils";
import { userManagementService } from "../../services/userManagementService";

export const OrganizationSettings: React.FC = () => {
  const { showAlert, showConfirm } = useUI();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [requests, setRequests] = useState<OrganizationJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<{ user_id: string; email: string; display_name?: string | null }[]>([]);
  const [manualAddEmail, setManualAddEmail] = useState("");
  const [manualAddStatus, setManualAddStatus] = useState<"idle" | "unknown" | "ok">("idle");
  const [notAuthorized, setNotAuthorized] = useState(false);

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.organization_id === selectedOrgId) || null,
    [organizations, selectedOrgId],
  );
  const isOwner = isOrgOwnerRole(selectedOrg?.member_role);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((req) => {
      const name = req.display_name?.toLowerCase() || "";
      return req.email.toLowerCase().includes(query) || name.includes(query);
    });
  }, [requests, search]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query
      ? members.filter((member) => {
          const name = member.display_name?.toLowerCase() || "";
          return member.email.toLowerCase().includes(query) || name.includes(query);
        })
      : members;
    const roleRank: Record<OrganizationMember["role"], number> = {
      owner: 0,
      admin: 1,
      member: 2,
    };
    return [...base].sort((a, b) => {
      const roleDiff = roleRank[a.role] - roleRank[b.role];
      if (roleDiff !== 0) return roleDiff;
      const aLabel = getUserSortKey(a.email, a.display_name);
      const bLabel = getUserSortKey(b.email, b.display_name);
      return aLabel.localeCompare(bLabel, "cs-CZ");
    });
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
      const membersData = await organizationService.getOrganizationMembers(orgId);
      setMembers(membersData);

      try {
        if (isOrgOwnerRole(organizations.find((o) => o.organization_id === orgId)?.member_role)) {
          const requestsData = await organizationService.getOrganizationJoinRequests(orgId);
          setRequests(requestsData.filter((req) => req.status === "pending"));
          const usersData = await userManagementService.getAllUsers();
          setAllUsers(
            usersData.map((u) => ({
              user_id: u.user_id,
              email: u.email,
              display_name: u.display_name,
            })),
          );
        } else {
          setRequests([]);
          setAllUsers([]);
          setNotAuthorized(true);
        }
      } catch (error) {
        console.error("Failed to load join requests:", error);
        setRequests([]);
      }
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

  const renderUserTargetNode = (label: string, email: string) => (
    <>
      <span className="text-orange-400 font-semibold">{label}</span>
      {label !== email && <span className="text-slate-400"> ({email})</span>}
    </>
  );

  const handleApprove = async (requestId: string, email: string, displayName?: string | null) => {
    const label = getUserLabel(email, displayName);
    const ok = await showConfirm({
      title: "Schválit žádost?",
      message: "",
      messageNode: (
        <>
          Opravdu chcete schválit žádost uživatele{" "}
          {renderUserTargetNode(label, email)}?
        </>
      ),
      variant: "danger",
      confirmLabel: "Schválit",
      cancelLabel: "Zrušit",
    });
    if (!ok) return;
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

  const handleReject = async (requestId: string, email: string, displayName?: string | null) => {
    const label = getUserLabel(email, displayName);
    const ok = await showConfirm({
      title: "Zamítnout žádost?",
      message: "",
      messageNode: (
        <>
          Opravdu chcete zamítnout žádost uživatele{" "}
          {renderUserTargetNode(label, email)}?
        </>
      ),
      variant: "danger",
      confirmLabel: "Zamítnout",
      cancelLabel: "Zrušit",
    });
    if (!ok) return;
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

  const handleRoleChange = async (
    userId: string,
    role: "admin" | "member",
    email: string,
    displayName?: string | null,
  ) => {
    if (!selectedOrgId) return;
    const label = getUserLabel(email, displayName);
    const ok = await showConfirm({
      title: "Změnit roli?",
      message: "",
      messageNode: (
        <>
          Opravdu chcete nastavit roli{" "}
          <span className="text-orange-400 font-semibold">{role === "admin" ? "Administrátor" : "Člen"}</span> pro
          uživatele {renderUserTargetNode(label, email)}?
        </>
      ),
      variant: "danger",
      confirmLabel: "Potvrdit",
      cancelLabel: "Zrušit",
    });
    if (!ok) return;
    try {
      await organizationService.updateOrganizationMemberRole(selectedOrgId, userId, role);
      await loadOrgData(selectedOrgId);
      showAlert({
        title: "Hotovo",
        message: "Role byla změněna.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to update role:", error);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se změnit roli.",
        variant: "danger",
      });
    }
  };

  const handleTransferOwnership = async (userId: string) => {
    if (!selectedOrgId) return;
    try {
      await organizationService.transferOrganizationOwnership(selectedOrgId, userId);
      await loadOrganizations();
      await loadOrgData(selectedOrgId);
      showAlert({
        title: "Hotovo",
        message: "Vlastnictví bylo předáno.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to transfer ownership:", error);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se předat vlastnictví.",
        variant: "danger",
      });
    }
  };
  const handleManualAdd = async () => {
    const email = manualAddEmail.trim().toLowerCase();
    if (!email || !selectedOrgId) return;
    if (!eligibleEmailSet.has(email)) {
      showAlert({
        title: "Uživatel nenalezen",
        message: "Nejdřív se musí uživatel zaregistrovat.",
        variant: "warning",
      });
      setManualAddStatus("unknown");
      return;
    }
    const label = getUserLabel(
      email,
      allUsers.find((u) => u.email.toLowerCase() === email)?.display_name,
    );
    const ok = await showConfirm({
      title: "Přidat uživatele?",
      message: "",
      messageNode: (
        <>
          Opravdu chcete přidat uživatele {renderUserTargetNode(label, email)} do organizace?
        </>
      ),
      variant: "danger",
      confirmLabel: "Přidat",
      cancelLabel: "Zrušit",
    });
    if (!ok) return;
    try {
      await organizationService.addOrganizationMemberByEmail(
        selectedOrgId,
        email,
        "member",
      );
      setManualAddEmail("");
      setManualAddStatus("idle");
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

  const eligibleEmailSet = useMemo(() => {
    return new Set(eligibleUsers.map((u) => u.email.toLowerCase()));
  }, [eligibleUsers]);

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
          placeholder="Vyhledat uživatele podle jména nebo emailu"
          className="flex-1 h-10 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
        />
      </div>

      {notAuthorized && (
        <div className="mb-6 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Schvalování a správa rolí je dostupná pouze vlastníkovi organizace.
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
                        {req.display_name && (
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {req.display_name}
                          </div>
                        )}
                        <div className="text-xs text-slate-400">
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
                          onClick={() => handleApprove(req.request_id, req.email, req.display_name)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/40"
                        >
                          Potvrdit
                        </button>
                        <button
                          type="button"
                          disabled={processingRequestId === req.request_id}
                          onClick={() => handleReject(req.request_id, req.email, req.display_name)}
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
                  {member.display_name && (
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {member.display_name}
                    </div>
                  )}
                  <div className="text-xs text-slate-400">
                    {member.email}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatOrgRole(member.role)} · Přidán {new Date(member.joined_at).toLocaleDateString("cs-CZ")}
                  </div>
                  {isOwner && member.role !== "owner" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRoleChange(member.user_id, "admin", member.email, member.display_name)}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600"
                      >
                        Nastavit admin
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRoleChange(member.user_id, "member", member.email, member.display_name)}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600"
                      >
                        Nastavit člen
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const targetLabel = getUserLabel(member.email, member.display_name);
                          const ok = await showConfirm({
                            title: "Předat vlastnictví?",
                            message: "",
                            messageNode: (
                              <>
                                Opravdu chcete předat vlastnictví této organizace uživateli{" "}
                                {renderUserTargetNode(targetLabel, member.email)}? Tuto akci lze
                                vrátit pouze dalším předáním.
                              </>
                            ),
                            variant: "danger",
                            confirmLabel: "Předat",
                            cancelLabel: "Zrušit",
                          });
                          if (ok) {
                            handleTransferOwnership(member.user_id);
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/40"
                      >
                        Předat vlastnictví
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Schválit uživatele bez žádosti
          </h3>
          <p className="text-xs text-slate-500">
            Použijte v případě, že se žádost nevytvořila automaticky.
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <input
                type="email"
                value={manualAddEmail}
                onChange={(e) => {
                  const next = e.target.value;
                  setManualAddEmail(next);
                  const normalized = next.trim().toLowerCase();
                  if (!normalized) {
                    setManualAddStatus("idle");
                    return;
                  }
                  setManualAddStatus(eligibleEmailSet.has(normalized) ? "ok" : "unknown");
                }}
                list="org-user-suggestions"
                placeholder="Zadejte email uživatele"
                className="h-10 w-full rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200"
              />
              {manualAddStatus !== "idle" && (
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      manualAddStatus === "ok"
                        ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {manualAddStatus === "ok" ? "Registrován" : "Neregistrován"}
                  </span>
                  <span className="ml-2 text-[11px] text-slate-400">
                    {manualAddStatus === "ok"
                      ? "Uživatel je registrovaný."
                      : "Nejdřív se musí zaregistrovat."}
                  </span>
                </div>
              )}
            </div>
            <datalist id="org-user-suggestions">
              {eligibleUsers.map((user) => (
                <option
                  key={user.user_id}
                  value={user.email}
                  label={user.display_name ? `${user.display_name} · ${user.email}` : user.email}
                />
              ))}
            </datalist>
            <button
              type="button"
              onClick={handleManualAdd}
              disabled={!manualAddEmail.trim()}
              className="h-10 px-4 rounded-lg text-sm font-medium bg-emerald-600 text-white disabled:opacity-50"
            >
              Přidat
            </button>
          </div>
        </div>
      )}

      {selectedOrg?.domain_whitelist?.length ? (
        <div className="mt-6 text-xs text-slate-500">
          Domény v organizaci: {selectedOrg.domain_whitelist.join(", ")}
        </div>
      ) : null}

    </section>
  );
};
