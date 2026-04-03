import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/ui/Header", () => ({
  Header: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/shared/ui/projects/Pipeline", () => ({ Pipeline: () => <div /> }));
vi.mock("@/shared/ui/projects/TenderPlan", () => ({ TenderPlan: () => <div /> }));
vi.mock("@/shared/ui/projects/ProjectSchedule", () => ({ ProjectSchedule: () => <div /> }));
vi.mock("@/shared/ui/projects/ProjectOverviewNew", () => ({ ProjectOverviewNew: () => <div /> }));
vi.mock("@/shared/ui/projects/ProjectDocuments", () => ({ ProjectDocuments: () => <div /> }));
vi.mock("@/shared/ui/projects/Contracts", () => ({ Contracts: () => <div /> }));

vi.mock("@/context/FeatureContext", () => ({
  useFeatures: () => ({
    hasFeature: () => true,
  }),
}));

import { ProjectLayout } from "../features/projects/ProjectLayout";

describe("ProjectLayout mobile select", () => {
  it("pouziva select styl bez nativni sipky", () => {
    render(
      <ProjectLayout
        projectId="p-1"
        projectDetails={{ title: "Projekt A", location: "", finishDate: "", siteManager: "" }}
        onUpdateDetails={() => undefined}
        onAddCategory={() => undefined}
        activeTab="overview"
        onTabChange={() => undefined}
        contacts={[]}
        statuses={[]}
        onUpdateContact={() => undefined}
      />,
    );

    const select = screen.getByDisplayValue("Přehled");
    expect(select.className).toContain("select-no-native-arrow");
  });
});
