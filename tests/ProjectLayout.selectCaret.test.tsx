import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/ui/Header", () => ({
  Header: ({
    children,
    title,
    helpSlot,
    searchValue,
    onSearchChange,
  }: {
    children?: React.ReactNode;
    title?: string;
    helpSlot?: React.ReactNode;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
  }) => (
    <div>
      <h1>{title}</h1>
      <input aria-label="Hledat v projektu" value={searchValue ?? ''} onChange={event => onSearchChange?.(event.target.value)}/>
      {children}
      {helpSlot}
    </div>
  ),
}));

vi.mock("@features/projects/pipeline/Pipeline", () => ({ Pipeline: () => <div /> }));
vi.mock("@features/projects/budget/ui/ConstructionBudget", () => ({
  ConstructionBudget: ({ searchQuery, onSearchChange }: { searchQuery: string; onSearchChange: (value: string) => void }) => <div>
    <span>Dotaz: {searchQuery}</span>
    <button onClick={() => onSearchChange('')}>Hledání ×</button>
    <button onClick={() => onSearchChange('')}>Vymazat všechny filtry</button>
  </div>,
}));
vi.mock("@/features/projects/ui/TenderPlan", () => ({ TenderPlan: () => <div /> }));
vi.mock("@/features/projects/ui/ProjectSchedule", () => ({ ProjectSchedule: () => <div /> }));
vi.mock("@/features/projects/ui/ProjectOverviewNew", () => ({ ProjectOverviewNew: () => <div /> }));
vi.mock("@features/projects/documents/ui/ProjectDocuments", () => ({ ProjectDocuments: () => <div /> }));
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
  it.each(['Hledání ×', 'Vymazat všechny filtry'])('keeps header and budget query synchronized after %s', name => {
    render(<ProjectLayout projectId="p-1" projectDetails={{title:'Projekt A',location:'',finishDate:'',siteManager:''}} onUpdateDetails={() => undefined} onAddCategory={() => undefined} activeTab="budget" onTabChange={() => undefined} contacts={[]} statuses={[]} onUpdateContact={() => undefined}/>);
    const input = screen.getByRole('textbox', { name: 'Hledat v projektu' });
    fireEvent.change(input, { target: { value: 'beton' } });
    expect(input).toHaveValue('beton');
    expect(screen.getByText('Dotaz: beton')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name }));
    expect(input).toHaveValue('');
    expect(screen.getByText('Dotaz:')).toBeVisible();
  });
  beforeEach(() => {
    localStorage.clear();
  });

  it("používá skinovaný výběr s jedinou vlastní šipkou", () => {
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

    const select = screen.getByRole("combobox", { name: "Navigace projektu" });
    expect(select).toHaveClass("tf-themed-select-trigger");
    expect(select.querySelectorAll(".material-symbols-outlined")).toHaveLength(1);
  });

  it("ponechá mobilní výběr a odstraní duplicitní desktopové záložky", () => {
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
    expect(screen.getByRole("combobox", { name: "Navigace projektu" })).toHaveClass("tf-themed-select-trigger");
    expect(screen.queryByRole("button", { name: /Harmonogram/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Přepnout na klasický skin")).not.toBeInTheDocument();
  });
});
it('redirects a demo budget deep link before mounting the RPC-backed component', async () => {
 const {startDemoSession,endDemoSession}=await import('@/services/demoData');const onTabChange=vi.fn();startDemoSession();
 try {
  render(<ProjectLayout projectId="p-1" projectDetails={{title:'Demo',location:'',finishDate:'',siteManager:''}} onUpdateDetails={()=>undefined} onAddCategory={()=>undefined} activeTab="budget" onTabChange={onTabChange} contacts={[]} statuses={[]} onUpdateContact={()=>undefined}/>);
  expect(screen.queryByText('Dotaz:')).not.toBeInTheDocument();
  expect(onTabChange).toHaveBeenCalledWith('overview');
 } finally {endDemoSession();}
});
