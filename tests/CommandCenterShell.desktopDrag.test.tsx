import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/context/FeatureContext", () => ({
  useFeatures: () => ({
    hasFeature: () => true,
  }),
}));

vi.mock("@features/command-center/hooks/useCommandCenterPreferences", () => ({
  useCommandCenterPreferences: () => ({
    preferences: {
      enabledModules: {},
      moduleSettings: {},
      filterState: {},
      autoLayout: true,
    },
    isModuleEnabled: () => true,
    setModuleSettings: vi.fn(),
    setFilterState: vi.fn(),
    setAutoLayout: vi.fn(),
  }),
}));

vi.mock("@/shared/ui/AccountMenuContext", () => ({
  useAccountMenu: () => <button type="button">Účet</button>,
}));

vi.mock("@/shared/ui/TopbarActionsContext", () => ({
  useTopbarActions: () => <button type="button">Hlas</button>,
}));

vi.mock("@features/command-center/hooks/useModuleSignals", () => ({
  useModuleSignals: () => ({}),
  signalWeight: () => 1,
}));

vi.mock("@features/command-center/CommandCenterSettings", () => ({
  CommandCenterSettings: () => null,
}));

vi.mock("@features/command-center/registry", () => ({
  MODULES: [],
  ZONE_ORDER: [
    "alert",
    "kpi",
    "filter",
    "portfolio",
    "main-primary",
    "main-secondary",
    "tactical",
    "temporal-primary",
    "temporal-secondary",
  ],
}));

import { CommandCenterShell } from "@/features/command-center/CommandCenterShell";

describe("CommandCenterShell desktop drag region", () => {
  it("má drag region na hlavičce a no-drag na akcích", () => {
    const html = renderToStaticMarkup(
      <CommandCenterShell
        projects={[]}
        projectDetails={{}}
        emptyState={<div>Prázdné</div>}
      />,
    );

    expect(html).toContain("-webkit-app-region:drag");
    expect(html).toContain("-webkit-app-region:no-drag");
    expect(html).toContain("Command Center");
  });
});
