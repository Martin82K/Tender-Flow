import React, { useEffect, useMemo, useState } from "react";
import { Header } from "./Header";
import { StatusConfig, Subcontractor } from "../types";
import { navigate, useLocation } from "./routing/router";
import {
  exportContactsToXLSX,
  exportContactsToCSV,
} from "../services/exportService";

// Sub-components
import { AdminSettings } from "./settings/AdminSettings";
import { AISettings } from "./settings/AISettings";
import { ProfileSettings } from "./settings/ProfileSettings";
import { ContactsImportWizard } from "./ContactsImportWizard";
import { ExcelUnlockerProSettings } from "./settings/ExcelUnlockerProSettings";
import { ExcelMergerProSettings } from "./settings/ExcelMergerProSettings";
import { UrlShortener } from "./tools/UrlShortener";
import { ExcelIndexerSettings } from "./settings/ExcelIndexerSettings";
import { McpDiagnostics } from "./settings/McpDiagnostics";
import { AIApiTest } from "./settings/AIApiTest";
import { SubscriptionSettings } from "./settings/SubscriptionSettings";
import { OrganizationSettings } from "./settings/OrganizationSettings";

import { useFeatures } from "../context/FeatureContext";
import { FEATURES } from "../config/features";

interface SettingsProps {
  theme: "light" | "dark" | "system";
  onSetTheme: (theme: "light" | "dark" | "system") => void;
  primaryColor: string;
  onSetPrimaryColor: (color: string) => void;

  contactStatuses: StatusConfig[];
  onUpdateStatuses: (statuses: StatusConfig[]) => void;
  onImportContacts: (
    contacts: Subcontractor[],
    onProgress?: (percent: number) => void,
  ) => Promise<void>;
  onDeleteContacts: (ids: string[]) => void;
  contacts: Subcontractor[];
  isAdmin?: boolean;
  onSaveSettings: () => void;
  user?: any;
}

export const Settings: React.FC<SettingsProps> = ({
  theme,
  onSetTheme,
  primaryColor,
  onSetPrimaryColor,
  contactStatuses,
  onUpdateStatuses,
  onImportContacts,
  onDeleteContacts,
  contacts,
  isAdmin = false,
  onSaveSettings,
  user,
}) => {
  const { search } = useLocation();
  const { hasFeature, isLoading: isFeaturesLoading } = useFeatures();
  type UserSubTab =
    | "profile"
    | "subscription"
    | "contacts"
    | "excelUnlocker"
    | "excelMerger"
    | "urlShortener"
    | "excelIndexer";
  type AdminSubTab = "registration" | "users" | "subscriptions" | "ai";

  // -------------------------------------------------------------------------
  // Routing Logic
  // -------------------------------------------------------------------------
  const settingsRoute = useMemo(() => {
    const params = new URLSearchParams(search);
    const tabParam = params.get("tab");
    const subTabParam = params.get("subTab");
    const tab =
      tabParam === "admin" || tabParam === "user" || tabParam === "organization"
        ? tabParam
        : null;
    let subTab: string | null = null;
    if (tab === "user") {
      subTab =
        subTabParam === "profile" ||
        subTabParam === "subscription" ||
        subTabParam === "contacts" ||
        subTabParam === "excelUnlocker" ||
        subTabParam === "excelMerger" ||
        subTabParam === "urlShortener" ||
        subTabParam === "indexMatcher" ||
        subTabParam === "excelIndexer" ||
        subTabParam === "tools" // legacy
          ? subTabParam
          : null;
    } else if (tab === "admin") {
      subTab =
        subTabParam === "registration" ||
        subTabParam === "users" ||
        subTabParam === "subscriptions" ||
        subTabParam === "ai"
          ? subTabParam
          : null;
    }
    return { tab, subTab };
  }, [search]);

  // Internal State for Tabs (Syncs with URL)
  const [activeTab, setActiveTab] = useState<"user" | "admin" | "organization">(() => {
    if (settingsRoute.tab === "organization") return "organization";
    if (settingsRoute.tab === "admin" && isAdmin) return "admin";
    return "user";
  });
  const [activeUserSubTab, setActiveUserSubTab] = useState<UserSubTab>(() => {
    if (
      settingsRoute.subTab === "subscription" ||
      settingsRoute.subTab === "contacts" ||
      settingsRoute.subTab === "excelMerger" ||
      settingsRoute.subTab === "urlShortener" ||
      settingsRoute.subTab === "indexMatcher" ||
      settingsRoute.subTab === "excelIndexer"
    )
      return settingsRoute.subTab;
    if (settingsRoute.subTab === "excelUnlocker") return settingsRoute.subTab;
    if (settingsRoute.subTab === "tools") return "excelUnlocker";
    return "profile";
  });
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<AdminSubTab>(
    () => {
      if (
        settingsRoute.subTab === "users" ||
        settingsRoute.subTab === "subscriptions" ||
        settingsRoute.subTab === "ai" ||
        settingsRoute.subTab === "organization"
      ) {
        return settingsRoute.subTab;
      }
      return "registration";
    },
  );

  const updateSettingsUrl = (
    next: { tab: "user" | "admin" | "organization"; subTab?: UserSubTab | AdminSubTab },
    opts?: { replace?: boolean },
  ) => {
    const params = new URLSearchParams();
    params.set("tab", next.tab);
    if (next.tab !== "organization") {
      params.set(
        "subTab",
        next.subTab || (next.tab === "user" ? "profile" : "registration"),
      );
    }
    navigate(`/app/settings?${params.toString()}`, {
      replace: opts?.replace ?? true,
    });
  };

  const canContactsImport = hasFeature(FEATURES.CONTACTS_IMPORT);
  const canExcelUnlocker = hasFeature(FEATURES.EXCEL_UNLOCKER);
  const canExcelMerger = hasFeature(FEATURES.EXCEL_MERGER);
  const canUrlShortener = hasFeature(FEATURES.URL_SHORTENER);
  const canExcelIndexer = hasFeature(FEATURES.EXCEL_INDEXER);

  useEffect(() => {
    if (isFeaturesLoading) return;
    if (activeTab !== "user") return;

    const isGated =
      (activeUserSubTab === "contacts" && !canContactsImport) ||
      (activeUserSubTab === "excelUnlocker" && !canExcelUnlocker) ||
      (activeUserSubTab === "excelMerger" && !canExcelMerger) ||
      (activeUserSubTab === "urlShortener" && !canUrlShortener) ||
      (activeUserSubTab === "excelIndexer" && !canExcelIndexer);

    if (!isGated) return;

    setActiveUserSubTab("profile");
    updateSettingsUrl({ tab: "user", subTab: "profile" }, { replace: true });
  }, [
    activeTab,
    activeUserSubTab,
    canContactsImport,
    canExcelMerger,
    canExcelUnlocker,
    canUrlShortener,
    canExcelIndexer,
    isFeaturesLoading,
  ]);

  useEffect(() => {
    if (settingsRoute.tab === "organization") {
      if (activeTab !== "organization") setActiveTab("organization");
      return;
    }

    if (settingsRoute.tab === "admin") {
      if (isAdmin && activeTab !== "admin") setActiveTab("admin");
      const normalizedAdminSubTab =
        (settingsRoute.subTab as AdminSubTab) || "registration";
      if (normalizedAdminSubTab !== activeAdminSubTab)
        setActiveAdminSubTab(normalizedAdminSubTab);
      return;
    }

    // Default to user tab
    if (activeTab !== "user") setActiveTab("user");

    if (settingsRoute.subTab) {
      const normalizedSubTab =
        settingsRoute.subTab === "tools"
          ? "excelUnlocker"
          : (settingsRoute.subTab as any);
      if (normalizedSubTab !== activeUserSubTab)
        setActiveUserSubTab(normalizedSubTab);
    } else if (activeUserSubTab !== "profile") {
      setActiveUserSubTab("profile");
    }
  }, [
    activeAdminSubTab,
    activeTab,
    activeUserSubTab,
    isAdmin,
    settingsRoute.subTab,
    settingsRoute.tab,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen overflow-y-auto">
      <Header
        title="Nastavení"
        subtitle="Konfigurace aplikace a správa staveb"
      />

      <div className="p-4 lg:p-6 xl:p-8 w-full pb-20">
        {/* Main Tab Navigation (Top Level) */}
        <div className="flex items-center gap-4 mb-8 border-b border-slate-200 dark:border-slate-700/50">
          <button
            onClick={() => {
              setActiveTab("user");
              updateSettingsUrl({ tab: "user", subTab: activeUserSubTab });
            }}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "user"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Prostředí uživatele
          </button>
          <button
            onClick={() => {
              setActiveTab("organization");
              updateSettingsUrl({ tab: "organization" });
            }}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "organization"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Organizace
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                setActiveTab("admin");
                updateSettingsUrl({ tab: "admin", subTab: activeAdminSubTab });
              }}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === "admin"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Administrace
            </button>
          )}
        </div>

        {/* --- ADMIN TAB CONTENT --- */}
        {activeTab === "organization" && (
          <div className="animate-fadeIn">
            <OrganizationSettings />
          </div>
        )}

        {activeTab === "admin" && isAdmin && (
          <div className="flex flex-col md:flex-row gap-8 animate-fadeIn">
            <aside className="w-full md:w-64 flex-shrink-0">
              <nav className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    updateSettingsUrl({ tab: "admin", subTab: "registration" })
                  }
                  className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    activeAdminSubTab === "registration"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">
                      admin_panel_settings
                    </span>
                    Registrace
                  </div>
                </button>

                <button
                  onClick={() =>
                    updateSettingsUrl({ tab: "admin", subTab: "users" })
                  }
                  className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    activeAdminSubTab === "users"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">
                      group
                    </span>
                    Uživatelé
                  </div>
                </button>


                <button
                  onClick={() =>
                    updateSettingsUrl({ tab: "admin", subTab: "subscriptions" })
                  }
                  className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    activeAdminSubTab === "subscriptions"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">
                      tune
                    </span>
                    Předplatné
                  </div>
                </button>

                <button
                  onClick={() =>
                    updateSettingsUrl({ tab: "admin", subTab: "ai" })
                  }
                  className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    activeAdminSubTab === "ai"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">
                      auto_awesome
                    </span>
                    AI
                  </div>
                </button>
              </nav>
            </aside>

            <main className="flex-1 min-w-0 overflow-x-hidden">
              {activeAdminSubTab === "registration" && (
                <AdminSettings isAdmin={isAdmin} section="registration" />
              )}
              {activeAdminSubTab === "users" && (
                <AdminSettings isAdmin={isAdmin} section="users" />
              )}
              {activeAdminSubTab === "subscriptions" && (
                <AdminSettings isAdmin={isAdmin} section="subscriptions" />
              )}
              {activeAdminSubTab === "ai" && (
                <>
                  <AISettings isAdmin={isAdmin} />
                  <AIApiTest />
                  <McpDiagnostics isAdmin={isAdmin} />
                </>
              )}
            </main>
          </div>
        )}

        {/* --- USER TAB CONTENT --- */}
        {activeTab === "user" && (
          <div className="flex flex-col md:flex-row gap-8 animate-fadeIn">
            {/* Sidebar Navigation for User Settings */}
            <aside className="w-full md:w-64 flex-shrink-0">
              <nav className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    updateSettingsUrl({ tab: "user", subTab: "profile" })
                  }
                  className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    activeUserSubTab === "profile"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">
                      person
                    </span>
                    Profil a Vzhled
                  </div>
                </button>

                <button
                  onClick={() =>
                    updateSettingsUrl({ tab: "user", subTab: "subscription" })
                  }
                  className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    activeUserSubTab === "subscription"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">
                      credit_card
                    </span>
                    Předplatné
                  </div>
                </button>

                {canContactsImport && (
                  <button
                    onClick={() =>
                      updateSettingsUrl({ tab: "user", subTab: "contacts" })
                    }
                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                      activeUserSubTab === "contacts"
                        ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px]">
                        import_contacts
                      </span>
                      Import Kontaktů
                    </div>
                  </button>
                )}

                {canExcelUnlocker && (
                  <button
                    onClick={() =>
                      updateSettingsUrl({
                        tab: "user",
                        subTab: "excelUnlocker",
                      })
                    }
                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                      activeUserSubTab === "excelUnlocker"
                        ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px]">
                        lock_open
                      </span>
                      Excel Unlocker PRO
                    </div>
                  </button>
                )}

                {canExcelMerger && (
                  <button
                    onClick={() =>
                      updateSettingsUrl({ tab: "user", subTab: "excelMerger" })
                    }
                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                      activeUserSubTab === "excelMerger"
                        ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px]">
                        table_view
                      </span>
                      Excel Merger PRO
                    </div>
                  </button>
                )}

                {canExcelIndexer && (
                  <button
                    onClick={() =>
                      updateSettingsUrl({ tab: "user", subTab: "excelIndexer" })
                    }
                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                      activeUserSubTab === "excelIndexer" ||
                      activeUserSubTab === "indexMatcher"
                        ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px]">
                        join_inner
                      </span>
                      Excel Indexer
                    </div>
                  </button>
                )}

                {canUrlShortener && (
                  <button
                    onClick={() =>
                      updateSettingsUrl({ tab: "user", subTab: "urlShortener" })
                    }
                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                      activeUserSubTab === "urlShortener"
                        ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px]">
                        link
                      </span>
                      URL Zkracovač
                    </div>
                  </button>
                )}
              </nav>
            </aside>

            {/* Content Area */}
            <main className="flex-1 min-w-0 overflow-x-hidden">
              {activeUserSubTab === "profile" && (
                <ProfileSettings
                  theme={theme}
                  onSetTheme={onSetTheme}
                  primaryColor={primaryColor}
                  onSetPrimaryColor={onSetPrimaryColor}
                  contactStatuses={contactStatuses}
                  onUpdateStatuses={onUpdateStatuses}
                  onDeleteContacts={onDeleteContacts}
                  contacts={contacts}
                  user={user}
                />
              )}

              {activeUserSubTab === "subscription" && <SubscriptionSettings />}

              {activeUserSubTab === "contacts" && canContactsImport && (
                <section className="space-y-6">
                  <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-500">
                          contacts
                        </span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                          Správa kontaktů
                        </h2>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500">
                      Import a export databáze dodavatelů a kontaktů
                    </p>
                  </div>

                  {/* Export Section */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-500">
                        download
                      </span>
                      Export databáze
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-2xl">
                      Stáhněte si kompletní databázi kontaktů ve formátu Excel
                      nebo CSV. Export obsahuje všechny dodavatele, kontaktní
                      osoby a detaily.
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() =>
                          exportContactsToXLSX(contacts, contactStatuses)
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 rounded-lg font-medium border border-emerald-200 dark:border-emerald-500/20 transition-all hover:shadow-sm"
                      >
                        <span className="material-symbols-outlined">
                          table_view
                        </span>
                        Stáhnout Excel (.xlsx)
                      </button>

                      <button
                        onClick={() =>
                          exportContactsToCSV(contacts, contactStatuses)
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50 rounded-lg font-medium border border-slate-200 dark:border-slate-700 transition-all hover:shadow-sm"
                      >
                        <span className="material-symbols-outlined">csv</span>
                        Stáhnout CSV
                      </button>
                    </div>
                  </div>

                  {/* Import Section */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-500">
                        upload
                      </span>
                      Import kontaktů
                    </h3>
                    <ContactsImportWizard
                      onImport={onImportContacts}
                      existingContacts={contacts}
                    />
                  </div>
                </section>
              )}

              {activeUserSubTab === "excelUnlocker" && canExcelUnlocker && (
                <ExcelUnlockerProSettings />
              )}

              {activeUserSubTab === "excelMerger" && canExcelMerger && (
                <ExcelMergerProSettings />
              )}

              {activeUserSubTab === "urlShortener" && canUrlShortener && (
                <UrlShortener />
              )}

              {(activeUserSubTab === "excelIndexer" ||
                activeUserSubTab === "indexMatcher") &&
                canExcelIndexer && <ExcelIndexerSettings />}
            </main>
          </div>
        )}
      </div>
    </div>
  );
};
