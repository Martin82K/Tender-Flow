/**
 * @deprecated Replaced by features/organization/ui/OrganizationDashboard.tsx
 * which provides a sub-tabbed dashboard (overview, members, billing, branding).
 */
import React, { useEffect, useMemo, useState } from "react";
import { sanitizeEmailDisclaimerHtml, buildEmailSignature } from "@/shared/email/signature";
import {
  organizationService,
  type OrganizationJoinRequest,
  type OrganizationMember,
  type OrganizationSummary,
  type OrganizationUnlockerTimeSavings,
} from "../../services/organizationService";
import { useUI } from "../../context/UIContext";
import { formatOrgRole, getUserLabel, getUserSortKey, isOrgOwnerRole } from "../../utils/organizationUtils";
import { userManagementService } from "../../services/userManagementService";

const TIME_SAVINGS_DAYS_BACK = 30;
const MINUTES_PER_UNLOCKED_SHEET = 2;
const MEMBERS_COLLAPSED_LIMIT = 3;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
const LOGO_MAX_WIDTH_PX = 4000;
const LOGO_MAX_HEIGHT_PX = 4000;

const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (restMinutes === 0) return `${hours} h`;
  return `${hours} h ${restMinutes} min`;
};

const validateLogoFile = async (file: File): Promise<void> => {
  if (!LOGO_ALLOWED_MIME_TYPES.includes(file.type as (typeof LOGO_ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Nepodporovaný formát. Povolené: PNG, JPG, WEBP, SVG.");
  }

  if (file.size > LOGO_MAX_BYTES) {
    throw new Error("Soubor je příliš velký. Maximální velikost je 2 MB.");
  }

  if (file.type === "image/svg+xml") {
    return;
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (image.width <= 0 || image.height <= 0) {
          reject(new Error("Nepodařilo se ověřit rozměry obrázku."));
          return;
        }
        if (image.width > LOGO_MAX_WIDTH_PX || image.height > LOGO_MAX_HEIGHT_PX) {
          reject(
            new Error(
              `Rozměry loga jsou příliš velké. Maximum je ${LOGO_MAX_WIDTH_PX}x${LOGO_MAX_HEIGHT_PX}px.`,
            ),
          );
          return;
        }
        resolve();
      };
      image.onerror = () => {
        reject(new Error("Soubor není validní obrázek."));
      };
      image.src = imageUrl;
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

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
  const [timeSavings, setTimeSavings] = useState<OrganizationUnlockerTimeSavings | null>(null);
  const [isLoadingTimeSavings, setIsLoadingTimeSavings] = useState(false);
  const [areMembersExpanded, setAreMembersExpanded] = useState(false);
  const [brandingLogoUrl, setBrandingLogoUrl] = useState<string | null>(null);
  const [isLoadingBrandingLogo, setIsLoadingBrandingLogo] = useState(false);
  const [isUploadingBrandingLogo, setIsUploadingBrandingLogo] = useState(false);
  const [isRemovingBrandingLogo, setIsRemovingBrandingLogo] = useState(false);
  const [emailBrandingLogoUrl, setEmailBrandingLogoUrl] = useState<string | null>(null);
  const [isLoadingEmailBrandingLogo, setIsLoadingEmailBrandingLogo] = useState(false);
  const [isUploadingEmailBrandingLogo, setIsUploadingEmailBrandingLogo] = useState(false);
  const [isRemovingEmailBrandingLogo, setIsRemovingEmailBrandingLogo] = useState(false);
  const [isSavingEmailBranding, setIsSavingEmailBranding] = useState(false);
  const [emailBrandingForm, setEmailBrandingForm] = useState({
    companyName: "",
    companyAddress: "",
    companyMeta: "",
    disclaimerHtml: "",
  });

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.organization_id === selectedOrgId) || null,
    [organizations, selectedOrgId],
  );
  const isOwner = isOrgOwnerRole(selectedOrg?.member_role);
  const canManageBranding =
    selectedOrg?.member_role === "owner" || selectedOrg?.member_role === "admin";

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

  const hasSearchQuery = search.trim().length > 0;
  const canCollapseMembers = !hasSearchQuery && filteredMembers.length > MEMBERS_COLLAPSED_LIMIT;
  const visibleMembers = canCollapseMembers && !areMembersExpanded
    ? filteredMembers.slice(0, MEMBERS_COLLAPSED_LIMIT)
    : filteredMembers;
  const hiddenMembersCount = filteredMembers.length - visibleMembers.length;

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
    setIsLoadingTimeSavings(true);
    setIsLoadingBrandingLogo(true);
    setIsLoadingEmailBrandingLogo(true);
    try {
      const membersData = await organizationService.getOrganizationMembers(orgId);
      setMembers(membersData);

      try {
        const timeSavingsData = await organizationService.getOrganizationUnlockerTimeSavings(
          orgId,
          TIME_SAVINGS_DAYS_BACK,
          MINUTES_PER_UNLOCKED_SHEET,
        );
        setTimeSavings(timeSavingsData);
      } catch (error) {
        console.error("Failed to load unlocker time savings:", error);
        setTimeSavings(null);
      } finally {
        setIsLoadingTimeSavings(false);
      }

      try {
        const logoUrl = await organizationService.getOrganizationLogoUrl(orgId, {
          expiresInSeconds: 1800,
        });
        setBrandingLogoUrl(logoUrl);
      } catch (error) {
        console.error("Failed to load organization logo:", error);
        setBrandingLogoUrl(null);
      } finally {
        setIsLoadingBrandingLogo(false);
      }

      try {
        const emailBranding = await organizationService.getOrganizationEmailBranding(
          orgId,
          {
            expiresInSeconds: 1800,
          },
        );
        setEmailBrandingLogoUrl(emailBranding?.emailLogoUrl || null);
        setEmailBrandingForm({
          companyName: emailBranding?.companyName || "",
          companyAddress: emailBranding?.companyAddress || "",
          companyMeta: emailBranding?.companyMeta || "",
          disclaimerHtml: emailBranding?.disclaimerHtml || "",
        });
      } catch (error) {
        console.error("Failed to load organization email branding:", error);
        setEmailBrandingLogoUrl(null);
        setEmailBrandingForm({
          companyName: "",
          companyAddress: "",
          companyMeta: "",
          disclaimerHtml: "",
        });
      } finally {
        setIsLoadingEmailBrandingLogo(false);
      }

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
      setIsLoadingTimeSavings(false);
      setIsLoadingBrandingLogo(false);
      setIsLoadingEmailBrandingLogo(false);
      showAlert({
        title: "Chyba",
        message: "Nelze načíst členy nebo žádosti.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const emailSignaturePreview = buildEmailSignature({
    profile: {
      displayName: "Ukázkový uživatel",
      signatureName: "Martin Kalkuš",
      signatureRole: "technik přípravy staveb",
      signaturePhone: "+420 353 561 325",
      signaturePhoneSecondary: "+420 777 300 042",
      signatureEmail: "kalkus@baustav.cz",
      signatureGreeting: "S pozdravem",
    },
    branding: {
      emailLogoPath: null,
      emailLogoUrl: emailBrandingLogoUrl,
      companyName: emailBrandingForm.companyName || null,
      companyAddress: emailBrandingForm.companyAddress || null,
      companyMeta: emailBrandingForm.companyMeta || null,
      disclaimerHtml: emailBrandingForm.disclaimerHtml || null,
      fontFamily: null,
      fontSize: null,
    },
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      setAreMembersExpanded(false);
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
        variant: "danger",
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

  const handleBrandingLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !selectedOrgId || !canManageBranding) return;

    try {
      await validateLogoFile(file);
      setIsUploadingBrandingLogo(true);
      const result = await organizationService.uploadOrganizationLogo(selectedOrgId, file);
      setBrandingLogoUrl(result.logoUrl);
      showAlert({
        title: "Hotovo",
        message: "Logo organizace bylo uloženo.",
        variant: "success",
      });
      await loadOrganizations();
    } catch (error) {
      console.error("Failed to upload organization logo:", error);
      showAlert({
        title: "Chyba",
        message:
          error instanceof Error
            ? error.message
            : "Nepodařilo se nahrát logo organizace.",
        variant: "danger",
      });
    } finally {
      setIsUploadingBrandingLogo(false);
    }
  };

  const handleBrandingLogoRemove = async () => {
    if (!selectedOrgId || !canManageBranding) return;
    const ok = await showConfirm({
      title: "Smazat logo?",
      message: "Logo bude odstraněno z oficiálních formulářů této organizace.",
      variant: "danger",
      confirmLabel: "Smazat",
      cancelLabel: "Zrušit",
    });
    if (!ok) return;

    try {
      setIsRemovingBrandingLogo(true);
      await organizationService.removeOrganizationLogo(selectedOrgId);
      setBrandingLogoUrl(null);
      showAlert({
        title: "Hotovo",
        message: "Logo organizace bylo smazáno.",
        variant: "success",
      });
      await loadOrganizations();
    } catch (error) {
      console.error("Failed to remove organization logo:", error);
      showAlert({
        title: "Chyba",
        message:
          error instanceof Error
            ? error.message
            : "Nepodařilo se smazat logo organizace.",
        variant: "danger",
      });
    } finally {
      setIsRemovingBrandingLogo(false);
    }
  };

  const handleEmailBrandingLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !selectedOrgId || !canManageBranding) return;

    try {
      await validateLogoFile(file);
      setIsUploadingEmailBrandingLogo(true);
      const result = await organizationService.uploadOrganizationEmailLogo(
        selectedOrgId,
        file,
      );
      setEmailBrandingLogoUrl(result.logoUrl);
      showAlert({
        title: "Hotovo",
        message: "E-mailové logo bylo uloženo.",
        variant: "success",
      });
      await loadOrganizations();
    } catch (error) {
      console.error("Failed to upload organization email logo:", error);
      showAlert({
        title: "Chyba",
        message:
          error instanceof Error
            ? error.message
            : "Nepodařilo se nahrát e-mailové logo.",
        variant: "danger",
      });
    } finally {
      setIsUploadingEmailBrandingLogo(false);
    }
  };

  const handleEmailBrandingLogoRemove = async () => {
    if (!selectedOrgId || !canManageBranding) return;
    const ok = await showConfirm({
      title: "Smazat e-mailové logo?",
      message: "Logo bude odstraněno z e-mailového podpisu organizace.",
      variant: "danger",
      confirmLabel: "Smazat",
      cancelLabel: "Zrušit",
    });
    if (!ok) return;

    try {
      setIsRemovingEmailBrandingLogo(true);
      await organizationService.removeOrganizationEmailLogo(selectedOrgId);
      setEmailBrandingLogoUrl(null);
      showAlert({
        title: "Hotovo",
        message: "E-mailové logo bylo smazáno.",
        variant: "success",
      });
      await loadOrganizations();
    } catch (error) {
      console.error("Failed to remove organization email logo:", error);
      showAlert({
        title: "Chyba",
        message:
          error instanceof Error
            ? error.message
            : "Nepodařilo se smazat e-mailové logo.",
        variant: "danger",
      });
    } finally {
      setIsRemovingEmailBrandingLogo(false);
    }
  };

  const handleEmailBrandingSave = async () => {
    if (!selectedOrgId || !canManageBranding) return;

    try {
      setIsSavingEmailBranding(true);
      await organizationService.saveOrganizationEmailBranding(selectedOrgId, {
        companyName: emailBrandingForm.companyName || null,
        companyAddress: emailBrandingForm.companyAddress || null,
        companyMeta: emailBrandingForm.companyMeta || null,
        disclaimerHtml: sanitizeEmailDisclaimerHtml(
          emailBrandingForm.disclaimerHtml,
        ),
      });
      showAlert({
        title: "Hotovo",
        message: "E-mailový branding organizace byl uložen.",
        variant: "success",
      });
      await loadOrganizations();
    } catch (error) {
      console.error("Failed to save organization email branding:", error);
      showAlert({
        title: "Chyba",
        message:
          error instanceof Error
            ? error.message
            : "Nepodařilo se uložit e-mailový branding.",
        variant: "danger",
      });
    } finally {
      setIsSavingEmailBranding(false);
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

  const totalMinutesSaved = timeSavings?.minutes_saved_total ?? 0;
  const rangeMinutesSaved = timeSavings?.minutes_saved_range ?? 0;
  const totalUnlockedSheets = timeSavings?.unlocked_sheets_total ?? 0;
  const rangeUnlockedSheets = timeSavings?.unlocked_sheets_range ?? 0;
  const totalUnlockEvents = timeSavings?.unlock_events_total ?? 0;
  const lastUnlockAt = timeSavings?.last_unlock_at
    ? new Date(timeSavings.last_unlock_at).toLocaleString("cs-CZ")
    : "Nikdy";

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

      <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Branding organizace
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Logo se použije v oficiálních formulářích (PDF exporty protokolů).
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Povolené formáty: PNG, JPG, WEBP, SVG. Max. velikost: 2 MB.
            </p>
          </div>
          {!canManageBranding && (
            <span className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
              Pouze owner/admin
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-36 items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
              {isLoadingBrandingLogo ? (
                <span className="text-xs text-slate-500">Načítám logo...</span>
              ) : brandingLogoUrl ? (
                <img
                  src={brandingLogoUrl}
                  alt={`Logo ${selectedOrg?.organization_name || "organizace"}`}
                  className="max-h-14 max-w-32 object-contain"
                />
              ) : (
                <span className="text-xs text-slate-500">Bez loga</span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {brandingLogoUrl
                ? "Logo je aktivní pro oficiální formuláře."
                : "Prozatím se používá textový fallback."}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                canManageBranding
                  ? "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70"
                  : "cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400"
              }`}
            >
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={!canManageBranding || isUploadingBrandingLogo || isRemovingBrandingLogo}
                onChange={handleBrandingLogoUpload}
                className="hidden"
              />
              {isUploadingBrandingLogo ? "Nahrávám..." : "Nahrát logo"}
            </label>

            <button
              type="button"
              disabled={
                !canManageBranding ||
                !brandingLogoUrl ||
                isUploadingBrandingLogo ||
                isRemovingBrandingLogo
              }
              onClick={handleBrandingLogoRemove}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRemovingBrandingLogo ? "Mažu..." : "Smazat logo"}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              E-mailový branding
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Samostatné logo a firemní patička pro podpis v generovaných e-mailech.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              E-mailové logo je oddělené od běžného loga organizace a nemá fallback.
            </p>
          </div>
          {!canManageBranding && (
            <span className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
              Pouze owner/admin
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/30 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-44 items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70">
                  {isLoadingEmailBrandingLogo ? (
                    <span className="text-xs text-slate-500">Načítám logo...</span>
                  ) : emailBrandingLogoUrl ? (
                    <img
                      src={emailBrandingLogoUrl}
                      alt={`E-mailové logo ${selectedOrg?.organization_name || "organizace"}`}
                      className="max-h-16 max-w-40 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-500">Bez e-mailového loga</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 max-w-xs">
                  {emailBrandingLogoUrl
                    ? "Logo je aktivní pro podpisy v e-mailech."
                    : "Nahrajte samostatné e-mailové logo, aby byl podpis kompletní."}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    canManageBranding
                      ? "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70"
                      : "cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400"
                  }`}
                >
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={
                      !canManageBranding ||
                      isUploadingEmailBrandingLogo ||
                      isRemovingEmailBrandingLogo
                    }
                    onChange={handleEmailBrandingLogoUpload}
                    className="hidden"
                  />
                  {isUploadingEmailBrandingLogo ? "Nahrávám..." : "Nahrát e-mailové logo"}
                </label>

                <button
                  type="button"
                  disabled={
                    !canManageBranding ||
                    !emailBrandingLogoUrl ||
                    isUploadingEmailBrandingLogo ||
                    isRemovingEmailBrandingLogo
                  }
                  onClick={handleEmailBrandingLogoRemove}
                  className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRemovingEmailBrandingLogo ? "Mažu..." : "Smazat e-mailové logo"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Název společnosti
                </label>
                <input
                  type="text"
                  value={emailBrandingForm.companyName}
                  onChange={(e) =>
                    setEmailBrandingForm((prev) => ({
                      ...prev,
                      companyName: e.target.value,
                    }))
                  }
                  disabled={!canManageBranding}
                  placeholder="BAU-STAV a.s."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Firemní metadata
                </label>
                <textarea
                  value={emailBrandingForm.companyMeta}
                  onChange={(e) =>
                    setEmailBrandingForm((prev) => ({
                      ...prev,
                      companyMeta: e.target.value,
                    }))
                  }
                  disabled={!canManageBranding}
                  rows={3}
                  placeholder="IČ: 147 05 877, DIČ: CZ 147 05 877"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Adresa / firemní blok
                </label>
                <textarea
                  value={emailBrandingForm.companyAddress}
                  onChange={(e) =>
                    setEmailBrandingForm((prev) => ({
                      ...prev,
                      companyAddress: e.target.value,
                    }))
                  }
                  disabled={!canManageBranding}
                  rows={3}
                  placeholder="Loketská 344/12&#10;360 06 Karlovy Vary, Czech Republic"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Disclaimer / patička
                </label>
                <textarea
                  value={emailBrandingForm.disclaimerHtml}
                  onChange={(e) =>
                    setEmailBrandingForm((prev) => ({
                      ...prev,
                      disclaimerHtml: e.target.value,
                    }))
                  }
                  disabled={!canManageBranding}
                  rows={8}
                  placeholder="Jakákoliv komunikace uvedená v této zprávě..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60"
                />
                <p className="text-[11px] text-slate-500">
                  Můžete vložit čistý text nebo jednoduché HTML. Při uložení proběhne sanitizace.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canManageBranding || isSavingEmailBranding}
                onClick={handleEmailBrandingSave}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingEmailBranding ? "Ukládám..." : "Uložit e-mailový branding"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/30 p-4">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Náhled podpisu
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div
                className="text-sm text-slate-900 dark:text-white [&_a]:text-slate-900 [&_a]:underline dark:[&_*]:!text-inherit dark:[&_a]:!text-sky-400"
                dangerouslySetInnerHTML={{ __html: emailSignaturePreview.html }}
              />
            </div>
            <div className="mt-3 text-[11px] text-slate-500">
              {emailSignaturePreview.isBrandingComplete
                ? "Podpis obsahuje samostatné e-mailové logo."
                : "Podpis zatím nemá e-mailové logo, branding není kompletní."}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-sky-200/60 dark:border-sky-800/40 bg-sky-50/60 dark:bg-sky-900/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-sky-500">schedule</span>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Úspora času z Excel Unlockeru
          </h3>
        </div>

        {isLoadingTimeSavings ? (
          <div className="text-xs text-slate-500">Načítám statistiky úspory času...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/50 p-3">
                <div className="text-[11px] text-slate-500">Celkem ušetřeno</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{formatMinutes(totalMinutesSaved)}</div>
              </div>
              <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/50 p-3">
                <div className="text-[11px] text-slate-500">Posledních {TIME_SAVINGS_DAYS_BACK} dní</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{formatMinutes(rangeMinutesSaved)}</div>
              </div>
              <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/50 p-3">
                <div className="text-[11px] text-slate-500">Odemčeno listů celkem</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{totalUnlockedSheets}</div>
              </div>
              <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/50 p-3">
                <div className="text-[11px] text-slate-500">Odemčeno listů ({TIME_SAVINGS_DAYS_BACK} dní)</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{rangeUnlockedSheets}</div>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Poslední odemknutí: <span className="text-slate-700 dark:text-slate-300">{lastUnlockAt}</span>
              {" · "}
              Počet odemykacích akcí: <span className="text-slate-700 dark:text-slate-300">{totalUnlockEvents}</span>
              {" · "}
              Výpočet: {MINUTES_PER_UNLOCKED_SHEET} minuty na 1 odemčený list.
            </div>
          </>
        )}
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
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Členové organizace
            </h3>
            {canCollapseMembers && (
              <button
                type="button"
                onClick={() => setAreMembersExpanded((prev) => !prev)}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300/70 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
              >
                {areMembersExpanded ? "Sbalit členy" : `Zobrazit další (${hiddenMembersCount})`}
              </button>
            )}
          </div>
          {filteredMembers.length === 0 ? (
            <div className="text-sm text-slate-500">Žádní členové.</div>
          ) : (
            <div className="space-y-2">
              {visibleMembers.map((member) => (
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
