import React from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import { navigate } from "@shared/routing/router";
import { buildAppUrl } from "@shared/routing/routeUtils";
import { CommandCenterShell } from "./CommandCenterShell";
import "./command-center.css";

const EmptyPortfolio: React.FC = () => (
  <div className="cc-empty">
    <div className="cc-empty__icon" aria-hidden>
      ◆
    </div>
    <h2 className="cc-empty__title">Zatím tu nic není</h2>
    <p className="cc-empty__desc">
      Command Center zobrazí přehled jakmile budete mít alespoň jednu aktivní zakázku.
      Začněte tím, že založíte první stavbu.
    </p>
    <button
      type="button"
      className="cc-btn cc-btn--primary"
      onClick={() => navigate(buildAppUrl("project-management"))}
    >
      Vytvořit první zakázku
    </button>
  </div>
);

export const CommandCenter: React.FC = () => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const activeProjects = state.projects.filter((p) => p.status !== "archived");

  return (
    <CommandCenterShell
      isEmptyPortfolio={activeProjects.length === 0}
      emptyState={<EmptyPortfolio />}
    />
  );
};

export default CommandCenter;
