import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import { buildAppUrl } from "@shared/routing/routeUtils";
import type { CommandCenterFilterState, DerivedAction } from "@features/command-center/types";
import { matchesFilter } from "./filterUtils";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEMAND_LIMIT_DAYS = 14;
const CONTRACT_PENDING_DAYS = 3;
const SUPPLIER_RESPONSE_DAYS = 6;
const MIN_SUPPLIERS_PER_CATEGORY = 3;

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

  return useMemo(() => {
    const now = new Date();
    const actions: DerivedAction[] = [];

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (filter && !matchesFilter(project, filter)) continue;

      const details = allProjectDetails[project.id];
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
  }, [projects, allProjectDetails, filter]);
};
