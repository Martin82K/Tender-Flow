import React from "react";
import { buildAppUrl } from "@shared/routing/routeUtils";
import { navigate } from "@shared/routing/router";
import { useProjectClientCard } from "@features/projects/client/useProjectClientCard";

interface Props {
  projectId?: string;
}

export const ProjectClientCardSummary: React.FC<Props> = ({ projectId }) => {
  const query = useProjectClientCard(projectId);
  if (!projectId) return null;
  const companyName = query.data?.companyName?.trim();
  const value = query.isPending ? "Načítám…" : companyName || "Nevyplněno";
  return (
    <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Objednatel</div>
        <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-200">{value}</div>
      </div>
      <button
        type="button"
        className="shrink-0 text-left text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => navigate(buildAppUrl("project", { projectId, tab: "documents", documentsSubTab: "investor" }))}
      >
        Otevřít kartu
      </button>
    </div>
  );
};
