import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "index.css"), "utf8");
const commandCenterCss = readFileSync(join(process.cwd(), "features/command-center/command-center.css"), "utf8");
const sidebarSource = readFileSync(join(process.cwd(), "components/Sidebar.tsx"), "utf8");
const tenderPlanSource = readFileSync(join(process.cwd(), "features/projects/ui/TenderPlan.tsx"), "utf8");
const projectOverviewSource = readFileSync(join(process.cwd(), "features/projects/ui/ProjectOverviewNew.tsx"), "utf8");
const projectScheduleSource = readFileSync(join(process.cwd(), "features/projects/ui/ProjectSchedule.tsx"), "utf8");
const pipelineSource = readFileSync(join(process.cwd(), "components/Pipeline.tsx"), "utf8");
const contactsSource = readFileSync(join(process.cwd(), "features/contacts/Contacts.tsx"), "utf8");
const documentsSource = readFileSync(join(process.cwd(), "components/projectLayoutComponents/ProjectDocuments.tsx"), "utf8");
const docsLinkSectionSource = readFileSync(join(process.cwd(), "components/projectLayoutComponents/documents/DocsLinkSection.tsx"), "utf8");
const priceListsSectionSource = readFileSync(join(process.cwd(), "components/projectLayoutComponents/documents/PriceListsSection.tsx"), "utf8");
const accountMenuSource = readFileSync(join(process.cwd(), "shared/ui/UserAccountMenu.tsx"), "utf8");
const notificationBellSource = readFileSync(join(process.cwd(), "features/notifications/ui/NotificationBell.tsx"), "utf8");
const notificationCenterSource = readFileSync(join(process.cwd(), "features/notifications/ui/NotificationCenter.tsx"), "utf8");
const notificationItemSource = readFileSync(join(process.cwd(), "features/notifications/ui/NotificationItem.tsx"), "utf8");
const modalSource = readFileSync(join(process.cwd(), "shared/ui/Modal.tsx"), "utf8");
const categoryFormModalSource = readFileSync(join(process.cwd(), "components/pipelineComponents/CategoryFormModal.tsx"), "utf8");
const contractEditDialogSource = readFileSync(join(process.cwd(), "features/projects/contracts/forms/ContractEditDialog.tsx"), "utf8");
const contractsDashboardSource = readFileSync(join(process.cwd(), "features/projects/contracts/dashboard/ContractsDashboard.tsx"), "utf8");
const contractListPanelSource = readFileSync(join(process.cwd(), "features/projects/contracts/list/ContractListPanel.tsx"), "utf8");
const contractWorkspaceSource = readFileSync(join(process.cwd(), "features/projects/contracts/workspace/ContractWorkspace.tsx"), "utf8");
const settingsSource = readFileSync(join(process.cwd(), "features/settings/Settings.tsx"), "utf8");
const organizationDashboardSource = readFileSync(join(process.cwd(), "features/organization/ui/OrganizationDashboard.tsx"), "utf8");
const orgOverviewSource = readFileSync(join(process.cwd(), "features/organization/ui/OrgOverviewTab.tsx"), "utf8");
const orgBillingSource = readFileSync(join(process.cwd(), "features/organization/ui/OrgBillingTab.tsx"), "utf8");
const projectManagerSource = readFileSync(join(process.cwd(), "features/projects/ProjectManager.tsx"), "utf8");
const tasksPageSource = readFileSync(join(process.cwd(), "features/tasks/ui/TasksPage.tsx"), "utf8");
const tenantOverviewSource = readFileSync(join(process.cwd(), "features/projects/ProjectOverview.tsx"), "utf8");
const statusDistributionChartSource = readFileSync(join(process.cwd(), "shared/ui/overview/StatusDistributionChart.tsx"), "utf8");
const budgetDeviationGaugeSource = readFileSync(join(process.cwd(), "shared/ui/overview/BudgetDeviationGauge.tsx"), "utf8");
const appContentSource = readFileSync(join(process.cwd(), "app/AppContent.tsx"), "utf8");

const cssBlockFor = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocks = [...css.matchAll(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "gs"))];
  return blocks.map((match) => match.groups?.body ?? "").find((body) => body.includes("background:")) ?? "";
};

describe("industrial skin tokens", () => {
  it("drží papírovou paletu z HTML předlohy", () => {
    expect(css).toContain("--tf-skin-bg: #f6f4ee");
    expect(css).toContain("--tf-skin-surface-deep: #e6e0d2");
    expect(css).toContain("--tf-skin-surface-muted: #ece8de");
    expect(css).toContain("--tf-skin-card: #ffffff");
    expect(css).toContain("--tf-skin-orange: #ff8a33");
    expect(css).toContain("--tf-skin-orange-deep: #b03a05");
  });

  it("aplikuje blueprint mřížku jako součást skin vrstvy", () => {
    expect(css).toContain("linear-gradient(var(--tf-skin-grid) 1px, transparent 1px)");
    expect(css).toContain("120px 120px");
  });

  it("má samostatné světlé i tmavé industrial tokeny a shell selektory", () => {
    expect(css).toContain('html[data-skin="industrial"]');
    expect(css).toContain('html.dark[data-skin="industrial"]');
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain(".tf-app-main");
    expect(css).toContain(".tf-project-shell");
    expect(css).toContain(".tf-sidebar");
    expect(css).toContain(".tf-topbar");
  });

  it("přepisuje průřezové taby a přepínače mimo classic pill vzhled", () => {
    expect(css).toContain("[data-help-id=\"overview-demand-table\"]");
    expect(css).toContain("[data-help-id=\"pipeline-filters\"]");
    expect(css).toContain("[data-help-id=\"pipeline-view-toggle\"]");
    expect(css).toContain("[data-help-id=\"schedule-controls\"] > div");
    expect(css).toContain("[data-help-id=\"contracts-subtabs\"]");
    expect(css).toContain("[data-help-id=\"contracts-view-toggle\"]");
    expect(css).toContain("[data-help-id=\"contracts-list-filters\"]");
    expect(css).toContain("background: transparent !important");
    expect(css).toContain("border-radius: 0 !important");
  });

  it("industrial projektová navigace drží menší ikony a kompaktní tlačítka", () => {
    expect(css).toContain('html[data-skin="industrial"] .tf-topbar [data-help-id="project-tabs"] button .material-symbols-outlined');
    expect(css).toContain("font-size: 0.9375rem !important");
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="pipeline-view-toggle"] button');
    expect(css).toContain("width: 1.875rem");
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="pipeline-add-category"] .material-symbols-outlined');
    expect(css).toContain("min-height: 2.25rem !important");
    expect(css).toContain("font-size: 0.8125rem !important");
  });

  it("industrial notifikace používají papírový portálový panel bez růžových pillů", () => {
    expect(notificationBellSource).toContain('data-help-id="notification-bell"');
    expect(notificationBellSource).toContain("aria-expanded");
    expect(notificationCenterSource).toContain('data-help-id="notification-center"');
    expect(notificationCenterSource).toContain('data-help-id="notification-center-tabs"');
    expect(notificationItemSource).toContain('data-help-id="notification-item"');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="notification-bell"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="notification-center"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="notification-center-tabs"] button[class*="bg-primary"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="notification-item"]');
    expect(css).toContain("width: min(26rem, calc(100vw - 1rem)) !important");
    expect(css).toContain("box-shadow: inset 0 -1px 0 var(--tf-skin-orange) !important");
  });

  it("skin Smluv má KPI strip, list a detailový rail jako samostatnou vrstvu", () => {
    expect(css).toContain("[data-help-id=\"contracts-kpi-strip\"]");
    expect(css).toContain("[data-help-id=\"contracts-kpi-card\"]");
    expect(contractsDashboardSource).toContain('data-help-id="contracts-dashboard"');
    expect(contractsDashboardSource).toContain('data-help-id="contracts-cashflow-bar"');
    expect(css).toContain("[data-help-id=\"contracts-list-rail\"]");
    expect(css).toContain("[data-help-id=\"contract-detail-shell\"]");
    expect(css).toContain("[data-help-id=\"contract-detail-rail\"]");
    expect(css).toContain("[data-help-id=\"contracts-investor-kpi-card\"]");
    expect(css).toContain("[data-help-id=\"contracts-investor-panel\"]");
    expect(css).toContain("grid-template-columns: minmax(132px, 156px) minmax(0, 1fr)");
  });

  it("industrial dashboard Smluv sjednocuje grafy, badge a KPI barvy do papírové palety", () => {
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="contracts-dashboard"] > [class*="rounded-xl"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="contracts-dashboard"] [class*="rounded-full"][class*="bg-green"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="contracts-dashboard"] [class*="text-green"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="contracts-dashboard"] [class*="bg-blue"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="contracts-cashflow-bar"] > div:nth-child(1)');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="contracts-cashflow-bar"] > div:nth-child(4)');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="contracts-dashboard"] [class*="border-l-blue"]');
    expect(css).toContain("color-mix(in srgb, var(--tf-skin-orange) 78%, var(--tf-skin-surface) 22%)");
  });

  it("industrial přehled stavby používá nový krotší styl KPI z šablony", () => {
    expect(projectOverviewSource).toContain("industrial-kpi-card");
    expect(projectOverviewSource).toContain('data-help-id="overview-section-heading"');
    expect(css).toContain('html[data-skin="industrial"] .industrial-section-title');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="overview-kpi-cards"] .industrial-kpi-card');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="overview-kpi-cards"] .industrial-kpi-card > .absolute');
    expect(css).toContain('font-size: clamp(1.75rem, 1.25rem + 0.9vw, 2.15rem) !important');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="overview-kpi-cards"] .industrial-kpi-card [class*="text-emerald"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="overview-kpi-cards"] .industrial-kpi-card [class*="bg-amber"]');
  });

  it("industrial titulkové ikony nepoužívají barevné gradientové dlaždice", () => {
    expect(projectScheduleSource).toContain('data-help-id="schedule-header-icon"');
    expect(tenderPlanSource).toContain('data-help-id="tender-plan-header-icon"');
    expect(documentsSource).toContain('data-help-id="documents-header-icon"');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="schedule-header-icon"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="tender-plan-header-icon"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="documents-header-icon"]');
    expect(css).toContain("background: transparent !important");
    expect(css).toContain("border-left: 3px solid var(--tf-skin-orange) !important");
    expect(css).toContain("color: var(--tf-skin-orange-deep) !important");
  });

  it("industrial smlouvy sjednocují list a detail mimo zelené/modré/fialové ostrůvky", () => {
    expect(contractListPanelSource).toContain('data-help-id="contracts-list-rail"');
    expect(contractListPanelSource).toContain("from-amber-500 to-green-500");
    expect(contractWorkspaceSource).toContain('data-help-id="contract-detail-shell"');
    expect(css).toContain('html[data-skin="industrial"] .tf-contracts-module [class*="text-green"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-contracts-module span[class*="bg-green"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-contracts-module [class*="bg-gradient-to-r"][class*="from-amber"][class*="to-green"]');
    expect(css).toContain('html[data-skin="industrial"] [data-help-id="contract-detail-shell"] [id^="sec-"] [class*="bg-white"]');
  });

  it("plná industrial CTA drží teplou oranžovou akci bez zelené a cihlové výplně", () => {
    const pipelineCta = cssBlockFor('html[data-skin="industrial"] [data-help-id="pipeline-add-category"]');
    const investorSave = cssBlockFor('html[data-skin="industrial"] [data-help-id="contracts-investor-save"]');

    expect(pipelineCta).toContain("linear-gradient(180deg, #ffb052 0%, var(--tf-skin-orange) 100%)");
    expect(investorSave).toContain("linear-gradient(180deg, #ffb052 0%, var(--tf-skin-orange) 100%)");
    expect(`${pipelineCta}\n${investorSave}`).not.toContain("--tf-skin-green");
    expect(`${pipelineCta}\n${investorSave}`).not.toContain("--tf-skin-orange-deep");
  });

  it("industrial průřez zachová canvas i pro Plán VŘ a Pipeline", () => {
    expect(tenderPlanSource).toContain("tf-tender-plan-view");
    expect(tenderPlanSource).toContain('data-help-id="tender-plan-add"');
    expect(tenderPlanSource).toContain('data-help-id="tender-plan-header-icon"');
    expect(tenderPlanSource).toContain('data-help-id="tender-plan-tip"');
    expect(projectOverviewSource).toContain("tf-project-overview");
    expect(pipelineSource).toContain("tf-pipeline-view");
    expect(contactsSource).toContain("tf-contacts-view");
    expect(contactsSource).toContain('data-help-id="contacts-add"');
    expect(documentsSource).toContain("tf-documents-view");
    expect(css).toContain(".tf-tender-plan-view");
    expect(css).toContain(".tf-pipeline-view");
    expect(css).toContain(".tf-project-overview");
    expect(css).toContain(".tf-contacts-view");
    expect(css).toContain(".tf-documents-view");
    expect(css).toContain('html[data-skin="industrial"] .tf-tender-plan-view');
    expect(css).toContain('html[data-skin="industrial"] .tf-pipeline-view');
  });

  it("industrial sjednocuje barvu tlačítek a Plán VŘ nemá modrozelené badge mimo skin", () => {
    expect(tenderPlanSource).toContain('data-help-id="tender-plan-created-badge"');
    expect(tenderPlanSource).toContain('data-help-id="tender-plan-create-demand"');
    expect(tenderPlanSource).toContain('data-help-id="tender-plan-status-badge"');
    expect(tenderPlanSource).toContain('data-help-id="tender-plan-save-row"');
    expect(css).toContain('button[class*="text-white"][class*="bg-blue"]');
    expect(css).toContain('button[class*="text-white"][class*="bg-emerald"]');
    expect(css).toContain('button[class*="text-white"][class*="bg-violet"]');
    expect(css).toContain('[data-help-id="tender-plan-created-badge"]');
    expect(css).toContain('[data-help-id="tender-plan-create-demand"]');
    expect(css).toContain('[data-help-id="tender-plan-status-badge"]');
    expect(css).toContain("color-mix(in srgb, var(--tf-skin-orange) 8%, var(--tf-skin-surface) 92%)");
  });

  it("industrial Command Center, Subdodavatelé a Dokumenty nepřekrývají canvas bílým pozadím", () => {
    expect(commandCenterCss).toContain('html[data-skin="industrial"] .cc-root');
    expect(commandCenterCss).toContain("background: transparent !important");
    expect(commandCenterCss).toContain("background-image: none !important");
    expect(commandCenterCss).toContain("--cc-surface: color-mix(in srgb, var(--tf-skin-surface) 86%, transparent)");
    expect(css).toContain('html[data-skin="industrial"] .tf-contacts-view');
    expect(css).toContain('html[data-skin="industrial"] .tf-contacts-view [data-help-id="contacts-add"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-contacts-view [data-help-id="contacts-add"] .material-symbols-outlined');
    expect(css).toContain('[data-help-id="contacts-list"]');
    expect(css).toContain('[data-help-id="contacts-cards"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-documents-view');
    expect(css).toContain('[data-help-id="documents-sidebar"]');
  });

  it("industrial Dokumenty převádí zelené, modré a fialové bloky na jednotný papírový akcent", () => {
    expect(documentsSource).toContain('data-help-id="documents-header-icon"');
    expect(documentsSource).toContain('data-help-id="documents-tip"');
    expect(documentsSource).toContain('data-help-id="dochub-setup-alert"');
    expect(docsLinkSectionSource).toContain('data-help-id="documents-link-card"');
    expect(docsLinkSectionSource).toContain('data-help-id="documents-save-link"');
    expect(priceListsSectionSource).toContain('data-help-id="documents-price-list-card"');
    expect(priceListsSectionSource).toContain('data-help-id="documents-dochub-quick-link"');
    expect(css).toContain('[data-help-id="documents-link-card"]');
    expect(css).toContain('[data-help-id="documents-dochub-quick-link"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-documents-view [class*="bg-emerald"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-documents-view [class*="bg-violet"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-documents-view button[class*="bg-emerald"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-documents-view button[class*="bg-violet"]');
    expect(css).toContain("linear-gradient(180deg, #ffb052 0%, var(--tf-skin-orange) 100%)");
  });

  it("industrial sjednocuje pozastávkové bloky ve smluvních modálech", () => {
    expect(contractEditDialogSource).toContain('data-help-id="contracts-retention-fields"');
    expect(contractEditDialogSource).toContain('data-help-id="contracts-retention-short"');
    expect(contractEditDialogSource).toContain('data-help-id="contracts-retention-long"');
    expect(css).toContain('[data-help-id="contracts-retention-short"]');
    expect(css).toContain('[data-help-id="contracts-retention-long"]');
    expect(css).toContain('border-left-color: color-mix(in srgb, var(--tf-skin-orange) 72%, transparent) !important');
  });

  it("industrial uživatelské menu skinuje portálový panel a drží kompaktní velikost", () => {
    expect(accountMenuSource).toContain("tf-account-menu-panel");
    expect(accountMenuSource).toContain("tf-account-menu-avatar");
    expect(accountMenuSource).toContain("w-[min(92vw,280px)]");
    expect(accountMenuSource).toContain("size-10");
    expect(accountMenuSource).toContain("min-h-8");
    expect(accountMenuSource).toContain("accountMeta");
    expect(accountMenuSource).not.toContain("badge-neon");
    expect(accountMenuSource).not.toContain("BOSS");
    expect(css).not.toContain(".badge-neon");
    expect(css).toContain(".tf-account-menu-panel");
    expect(css).toContain(".tf-account-menu-avatar");
    expect(css).toContain('html[data-skin="industrial"] .tf-account-menu-panel');
    expect(css).toContain('html[data-skin="industrial"] .tf-account-menu-panel button[aria-pressed="true"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-account-menu > button[aria-expanded="true"]');
    expect(css).toContain("--tw-ring-color: color-mix(in srgb, var(--tf-skin-surface) 84%, transparent) !important");
  });

  it("industrial modály mají sdílené skin třídy i pro ruční pipeline dialogy", () => {
    expect(modalSource).toContain("tf-modal-overlay");
    expect(modalSource).toContain("tf-modal-panel");
    expect(modalSource).toContain("tf-modal-footer");
    expect(categoryFormModalSource).toContain('data-help-id="pipeline-category-form-modal"');
    expect(categoryFormModalSource).toContain("tf-pipeline-modal-panel");
    expect(css).toContain(".tf-modal-overlay");
    expect(css).toContain(".tf-modal-panel");
    expect(css).toContain(".tf-pipeline-modal-panel");
    expect(css).toContain('html[data-skin="industrial"] .tf-modal-panel button[class*="bg-red"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-modal-panel [class*="rounded-full"][class*="bg-blue"]');
  });

  it("industrial Nastavení skinuje celý shell včetně hlavních tabů a společného sidebaru", () => {
    expect(settingsSource).toContain("tf-settings-view");
    expect(settingsSource).toContain("skin={skin}");
    expect(settingsSource).toContain('data-help-id="settings-content"');
    expect(settingsSource).toContain('data-help-id="settings-main-tabs"');
    expect(settingsSource).toContain('data-help-id="settings-user-workspace"');
    expect(settingsSource).toContain('data-help-id="settings-tools-workspace"');
    expect(settingsSource).toContain('data-help-id="settings-admin-workspace"');
    expect(settingsSource).toContain('data-help-id="settings-sidebar"');
    expect(organizationDashboardSource).toContain('data-help-id="settings-organization-workspace"');
    expect(organizationDashboardSource).toContain('data-help-id="settings-sidebar"');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view [data-help-id="settings-main-tabs"] button');
    expect(css).toContain('border-radius: 0 !important');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view [data-help-id="settings-sidebar"] button');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view :where(input:not([type="checkbox"]):not([type="radio"]), select, textarea)');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view button[class*="text-white"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view :where(main, section) button:not(:disabled):not([class*="text-white"]):not([class*="rounded-full"])');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view :where(main, section) button[class*="border-emerald"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view :where(main, section) span[class*="bg-primary"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view :where(main, section) button:disabled');
    expect(orgOverviewSource).toContain('data-help-id="org-plan-icon"');
    expect(orgBillingSource).toContain('data-help-id="org-plan-icon"');
    expect(orgOverviewSource).toContain('data-help-id="org-license-cta"');
    expect(orgOverviewSource).toContain('data-help-id="org-seat-progress"');
    expect(orgBillingSource).toContain('data-help-id="org-seat-progress"');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view [data-help-id="org-plan-icon"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view [data-help-id="org-license-cta"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-settings-view [data-help-id="org-seat-progress"] > div');
    expect(css).toContain('border-left: 3px solid var(--tf-skin-orange) !important');
  });

  it("zmenšuje industrial submenu ikony ve stavbách", () => {
    expect(sidebarSource).toContain("inline-flex size-7");
    expect(sidebarSource).toContain('data-help-id="sidebar-nav-item"');
    expect(sidebarSource).toContain('data-help-id="sidebar-nav-group-summary"');
    expect(sidebarSource).toContain('data-help-id="sidebar-nav-icon"');
    expect(sidebarSource).toContain('data-help-id="sidebar-new-project"');
    expect(css).toContain('html[data-skin="industrial"] .tf-sidebar [data-help-id="sidebar-nav-item"]');
    expect(css).toContain('[data-active="true"]');
    expect(css).toContain('border-left-color: var(--tf-skin-orange) !important');
    expect(sidebarSource).toContain('data-help-id="project-sidebar-tab"');
    expect(sidebarSource).toContain('data-help-id="project-sidebar-tab-icon"');
    expect(sidebarSource).toContain('text-[13px] w-3.5');
    expect(sidebarSource).toContain("gap-1.5 px-2 py-1");
    expect(css).toContain('html[data-skin="industrial"] .tf-sidebar [data-help-id="project-sidebar-tab-icon"]');
    expect(css).toContain("font-size: 0.9375rem !important");
    expect(css).toContain("width: 0.9375rem !important");
    expect(sidebarSource).not.toContain('text-[14px] w-4');
    expect(sidebarSource).not.toContain('text-[20px] w-4');
  });

  it("industrial TODO menu drží vybraný stav i mimo hover", () => {
    expect(tasksPageSource).toContain('data-help-id="tasks-menu-item"');
    expect(tasksPageSource).toContain('data-help-id="todo-project-item"');
    expect(tasksPageSource).toContain('data-help-id="tasks-mobile-menu-toggle"');
    expect(tasksPageSource).toContain('aria-current={active ? "page" : undefined}');
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain('html[data-skin="industrial"] .tf-tasks-view [data-help-id="tasks-menu"]');
    expect(css).toContain("var(--tf-skin-orange) 10%, var(--tf-skin-surface-muted) 90%");
    expect(css).toContain("var(--tf-skin-surface-muted) 92%, var(--tf-skin-orange) 8%");
    expect(css).toContain("var(--tf-skin-orange) 16%, var(--tf-skin-surface-muted) 84%");
    expect(css).toContain('html[data-skin="industrial"] .tf-tasks-view [data-help-id="tasks-menu-item"][data-active="true"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-tasks-view [data-help-id="todo-project-item"][data-active="true"]');
    expect(css).toContain('color: var(--tf-skin-orange-deep) !important');
  });

  it("industrial Správa staveb a tenant Přehledy převádí okna, tlačítka a modály do stejného skinu", () => {
    expect(appContentSource).toContain("skin={skin}");
    expect(projectManagerSource).toContain("tf-project-manager-view");
    expect(projectManagerSource).toContain("skin={skin}");
    expect(projectManagerSource).toContain('data-help-id="pm-create-section"');
    expect(projectManagerSource).toContain('data-help-id="pm-project-list"');
    expect(projectManagerSource).toContain('data-help-id="pm-project-status-badge"');
    expect(projectManagerSource).toContain("data-status={project.status}");
    expect(projectManagerSource).toContain('data-help-id="pm-project-actions"');
    expect(projectManagerSource).toContain('data-help-id="pm-shared-with-badge"');
    expect(projectManagerSource).toContain('data-help-id="pm-archive-section"');
    expect(projectManagerSource).toContain('data-help-id="pm-edit-modal"');
    expect(projectManagerSource).toContain('data-help-id="pm-share-modal"');
    expect(projectManagerSource).toContain('data-help-id="pm-transfer-modal"');
    expect(projectManagerSource).toContain("tf-modal-overlay");
    expect(projectManagerSource).toContain("tf-modal-panel");
    expect(tenantOverviewSource).toContain("tf-project-overview-view");
    expect(tenantOverviewSource).toContain("skin={skin}");
    expect(tenantOverviewSource).toContain('data-help-id="overview-scope-toggle"');
    expect(tenantOverviewSource).toContain('data-help-id="overview-kpi"');
    expect(tenantOverviewSource).toContain('data-help-id="overview-status-cards"');
    expect(tenantOverviewSource).toContain('data-help-id="overview-supplier-analysis"');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-manager-view');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-overview-view');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-manager-view [data-help-id="pm-create-section"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-manager-view [data-help-id="pm-project-status-badge"][data-status="tender"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-manager-view [data-help-id="pm-project-status-badge"][data-status="realization"]');
    expect(css).toContain("#5da6ff");
    expect(css).toContain('html[data-skin="industrial"] .tf-project-manager-view [data-help-id="pm-project-actions"] button');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-manager-view [data-help-id="pm-shared-with-badge"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-manager-view button[class*="from-emerald"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-overview-view [data-help-id="overview-scope-toggle"]');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-overview-view [data-help-id="overview-kpi"] > div');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-overview-view [data-help-id="overview-status-cards"] > div');
    expect(css).toContain('html[data-skin="industrial"] .tf-project-overview-view [data-help-id="overview-charts"] [class*="from-emerald"]');
    expect(statusDistributionChartSource).toContain('data-help-id="overview-status-distribution-chart"');
    expect(statusDistributionChartSource).toContain("var(--tf-overview-status-sod, #10B981)");
    expect(budgetDeviationGaugeSource).toContain('data-help-id="overview-budget-deviation-gauge"');
    expect(budgetDeviationGaugeSource).toContain("var(--tf-overview-gauge-good, #10B981)");
    expect(css).toContain("--tf-overview-status-rejected");
    expect(css).toContain("--tf-overview-gauge-danger");
  });
});
