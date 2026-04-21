import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import { buildAppUrl } from "@shared/routing/routeUtils";
import { useAllContractsQuery } from "@features/projects/contracts/hooks/useAllContractsQuery";
import type { CommandCenterFilterState, DerivedAction } from "@features/command-center/types";
import { matchesFilter } from "./filterUtils";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEMAND_LIMIT_DAYS = 14;
const CONTRACT_PENDING_DAYS = 3;
const SUPPLIER_RESPONSE_DAYS = 6;
const MIN_SUPPLIERS_PER_CATEGORY = 3;
const INVOICE_DUE_SOON_DAYS = 14;
const RETENTION_RELEASE_SOON_DAYS = 14;

const toDate = (value?: string): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const diffInDays = (target: Date, reference: Date): number =>
  Math.floor((target.getTime() - reference.getTime()) / MS_PER_DAY);

const severityOrder = { critical: 0, warning: 1, info: 2 } as const;

export const useDerivedActions = (filter?: CommandCenterFilterState): DerivedAction[] => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const { projects, allProjectDetails } = state;

  const activeProjectIds = useMemo(
    () => projects.filter((p) => p.status !== "archived").map((p) => p.id),
    [projects],
  );
  const { data: allContracts = [] } = useAllContractsQuery(activeProjectIds);

  const contractsByProject = useMemo(() => {
    const map: Record<string, typeof allContracts> = {};
    for (const c of allContracts) {
      (map[c.projectId] ??= []).push(c);
    }
    return map;
  }, [allContracts]);

  return useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const actions: DerivedAction[] = [];

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (filter && !matchesFilter(project, filter)) continue;

      const details = allProjectDetails[project.id];
      const projectContracts = contractsByProject[project.id] ?? [];

      for (const contract of projectContracts) {
        for (const inv of contract.invoices ?? []) {
          const dueDate = toDate(inv.dueDate);
          if (!dueDate) continue;
          const daysToDue = diffInDays(dueDate, now);
          const isOverdue =
            inv.status === "overdue" ||
            (inv.status === "issued" && inv.dueDate < today);

          if (isOverdue && inv.status !== "paid") {
            actions.push({
              id: `invoice-overdue-${inv.id}`,
              severity: "critical",
              title: `Faktura ${inv.invoiceNumber} je ${Math.abs(daysToDue)} d po splatnosti`,
              subtitle: contract.title,
              projectId: project.id,
              projectName: project.name,
              dueAt: dueDate.toISOString(),
              actionUrl: buildAppUrl("project", {
                projectId: project.id,
                tab: "contracts",
              }),
            });
          } else if (
            (inv.status === "issued" || inv.status === "approved") &&
            daysToDue >= 0 &&
            daysToDue <= INVOICE_DUE_SOON_DAYS
          ) {
            actions.push({
              id: `invoice-due-${inv.id}`,
              severity: daysToDue <= 3 ? "warning" : "info",
              title:
                daysToDue === 0
                  ? `Splatnost ${inv.invoiceNumber} dnes`
                  : `Splatnost ${inv.invoiceNumber} za ${daysToDue} d`,
              subtitle: contract.title,
              projectId: project.id,
              projectName: project.name,
              dueAt: dueDate.toISOString(),
              actionUrl: buildAppUrl("project", {
                projectId: project.id,
                tab: "contracts",
              }),
            });
          }
        }

        if (
          contract.retentionShortStatus !== "released" &&
          contract.retentionShortReleaseOn
        ) {
          const releaseDate = toDate(contract.retentionShortReleaseOn);
          if (releaseDate) {
            const daysTo = diffInDays(releaseDate, now);
            if (daysTo >= 0 && daysTo <= RETENTION_RELEASE_SOON_DAYS) {
              actions.push({
                id: `retention-short-${contract.id}`,
                severity: daysTo <= 3 ? "warning" : "info",
                title:
                  daysTo === 0
                    ? "Uvolnění krátk. pozastávky dnes"
                    : `Uvolnění krátk. pozastávky za ${daysTo} d`,
                subtitle: contract.title,
                projectId: project.id,
                projectName: project.name,
                dueAt: releaseDate.toISOString(),
                actionUrl: buildAppUrl("project", {
                  projectId: project.id,
                  tab: "contracts",
                }),
              });
            }
          }
        }

        if (
          contract.retentionLongStatus !== "released" &&
          contract.retentionLongReleaseOn
        ) {
          const releaseDate = toDate(contract.retentionLongReleaseOn);
          if (releaseDate) {
            const daysTo = diffInDays(releaseDate, now);
            if (daysTo >= 0 && daysTo <= RETENTION_RELEASE_SOON_DAYS) {
              actions.push({
                id: `retention-long-${contract.id}`,
                severity: daysTo <= 3 ? "warning" : "info",
                title:
                  daysTo === 0
                    ? "Uvolnění dlouh. pozastávky dnes"
                    : `Uvolnění dlouh. pozastávky za ${daysTo} d`,
                subtitle: contract.title,
                projectId: project.id,
                projectName: project.name,
                dueAt: releaseDate.toISOString(),
                actionUrl: buildAppUrl("project", {
                  projectId: project.id,
                  tab: "contracts",
                }),
              });
            }
          }
        }
      }

      if (!details) continue;

      const categories = details.categories ?? [];

      for (const category of categories) {
        const bids = details.bids?.[category.id] ?? [];
        const createdAt = toDate(category.createdAt);

        // 14denní limit: poptávka, kde createdAt + 14d - now < 2d
        if (createdAt && category.status !== "closed" && category.status !== "sod") {
          const dueAt = new Date(createdAt.getTime() + DEMAND_LIMIT_DAYS * MS_PER_DAY);
          const daysLeft = diffInDays(dueAt, now);
          if (daysLeft <= 2) {
            actions.push({
              id: `demand-14d-${category.id}`,
              severity: "critical",
              title:
                daysLeft < 0
                  ? `14denní limit překročen (${Math.abs(daysLeft)} d)`
                  : `14denní limit vyprší za ${daysLeft} d`,
              subtitle: category.title,
              projectId: project.id,
              projectName: project.name,
              categoryId: category.id,
              relatedEntity: `category:${category.id}`,
              dueAt: dueAt.toISOString(),
              actionUrl: buildAppUrl("project", {
                projectId: project.id,
                tab: "pipeline",
                categoryId: category.id,
              }),
            });
          }
        }

        // Smlouva čekající na podpis > 3 dny (vítěz bez contracted=true)
        const winner = bids.find((b) => b.status === "sod" && !b.contracted);
        if (winner && category.deadline) {
          const deadline = toDate(category.deadline);
          if (deadline) {
            const daysSince = diffInDays(now, deadline);
            if (daysSince > CONTRACT_PENDING_DAYS) {
              actions.push({
                id: `contract-pending-${category.id}`,
                severity: "warning",
                title: `Smlouva čeká na podpis ${daysSince} d`,
                subtitle: `${winner.companyName} · ${category.title}`,
                projectId: project.id,
                projectName: project.name,
                categoryId: category.id,
                relatedEntity: `bid:${winner.id}`,
                actionUrl: buildAppUrl("project", {
                  projectId: project.id,
                  tab: "contracts",
                }),
              });
            }
          }
        }

        // Kategorie s < 3 dodavateli
        if (
          category.status !== "closed" &&
          category.status !== "sod" &&
          bids.length < MIN_SUPPLIERS_PER_CATEGORY
        ) {
          actions.push({
            id: `low-suppliers-${category.id}`,
            severity: "warning",
            title: `Kategorie má ${bids.length} z min. ${MIN_SUPPLIERS_PER_CATEGORY} dodavatelů`,
            subtitle: category.title,
            projectId: project.id,
            projectName: project.name,
            categoryId: category.id,
            actionUrl: buildAppUrl("project", {
              projectId: project.id,
              tab: "pipeline",
              categoryId: category.id,
            }),
          });
        }

        // Dodavatel neodpověděl > 6 dní (sent, žádná cena)
        for (const bid of bids) {
          if (bid.status === "sent" && !bid.price) {
            const updated = toDate(bid.updateDate) ?? createdAt;
            if (updated) {
              const daysSince = diffInDays(now, updated);
              if (daysSince > SUPPLIER_RESPONSE_DAYS) {
                actions.push({
                  id: `no-response-${bid.id}`,
                  severity: "warning",
                  title: `${bid.companyName} bez odpovědi ${daysSince} d`,
                  subtitle: category.title,
                  projectId: project.id,
                  projectName: project.name,
                  categoryId: category.id,
                  relatedEntity: `bid:${bid.id}`,
                  actionUrl: buildAppUrl("project", {
                    projectId: project.id,
                    tab: "pipeline",
                    categoryId: category.id,
                  }),
                });
              }
            }
          }
        }

        // Blokovaná poptávka — chybí dokumentace (kategorie bez documents a starší než 2 dny)
        if (
          (!category.documents || category.documents.length === 0) &&
          createdAt &&
          diffInDays(now, createdAt) > 2 &&
          category.status !== "closed" &&
          category.status !== "sod"
        ) {
          actions.push({
            id: `blocked-${category.id}`,
            severity: "critical",
            title: "Blokovaná poptávka — chybí PD",
            subtitle: category.title,
            projectId: project.id,
            projectName: project.name,
            categoryId: category.id,
            actionUrl: buildAppUrl("project", {
              projectId: project.id,
              tab: "pipeline",
              categoryId: category.id,
            }),
          });
        }

        // Kontrolní den do 3 dnů (realizationStart)
        const realStart = toDate(category.realizationStart);
        if (realStart) {
          const daysTo = diffInDays(realStart, now);
          if (daysTo >= 0 && daysTo <= 3) {
            actions.push({
              id: `check-day-${category.id}`,
              severity: "info",
              title: daysTo === 0 ? "Kontrolní den dnes" : `Kontrolní den za ${daysTo} d`,
              subtitle: category.title,
              projectId: project.id,
              projectName: project.name,
              categoryId: category.id,
              dueAt: realStart.toISOString(),
              actionUrl: buildAppUrl("project", {
                projectId: project.id,
                tab: "schedule",
              }),
            });
          }
        }
      }
    }

    return actions.sort((a, b) => {
      const sev = severityOrder[a.severity] - severityOrder[b.severity];
      if (sev !== 0) return sev;
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });
  }, [projects, allProjectDetails, contractsByProject, filter]);
};
