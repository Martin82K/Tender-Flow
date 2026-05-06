import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/ui/Header", () => ({
  Header: ({
    children,
    title,
    helpSlot,
  }: {
    children?: React.ReactNode;
    title?: string;
    helpSlot?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
      {helpSlot}
    </div>
  ),
}));

vi.mock("@/shared/ui/projects/Pipeline", () => ({ Pipeline: () => <div /> }));
vi.mock("@/shared/ui/projects/TenderPlan", () => ({ TenderPlan: () => <div /> }));
vi.mock("@/features/projects/ui/ProjectSchedule", () => ({ ProjectSchedule: () => <div /> }));
vi.mock("@/shared/ui/projects/ProjectOverviewNew", () => ({ ProjectOverviewNew: () => <div /> }));
vi.mock("@/shared/ui/projects/ProjectDocuments", () => ({ ProjectDocuments: () => <div /> }));
vi.mock("@features/projects/contracts/ContractsModule", () => ({
  ContractsModule: () => <div />,
}));
vi.mock("@features/tasks", () => ({
  TaskCreateButton: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children || "Úkol"}</button>
  ),
}));
vi.mock("@features/help", () => ({
  HelpButton: () => <button type="button">Nápověda</button>,
}));

vi.mock("@/context/FeatureContext", () => ({
  useFeatures: () => ({
    hasFeature: () => true,
  }),
}));

import { ProjectLayout } from "../features/projects/ProjectLayout";

describe("ProjectLayout mobile select", () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it("zachova horni projektove menu i pri vychozim industrial skinu", () => {
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

    expect(screen.getByRole("heading", { name: "Projekt A" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Přehled").className).toContain("select-no-native-arrow");
    expect(screen.getByRole("button", { name: /Harmonogram/i })).toBeInTheDocument();
    expect(screen.queryByText("Přepnout na klasický skin")).not.toBeInTheDocument();
  });
});
