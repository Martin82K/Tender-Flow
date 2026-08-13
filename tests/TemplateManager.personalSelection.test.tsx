import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TemplateManager } from "@features/projects/documents/ui/TemplateManager";
import type { ProjectDetails, Template } from "../types";

const mockTemplate = vi.hoisted(() => ({
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "project-1",
  name: "Moje šablona",
  subject: "Poptávka",
  content: "Dobrý den",
  isDefault: true,
  lastModified: "2026-08-13",
}));

const template: Template = mockTemplate;

vi.mock("../services/templateService", () => ({
  getTemplates: vi.fn().mockResolvedValue([mockTemplate]),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));

describe("TemplateManager personal selection", () => {
  it("během ukládání nepovolí dvojité vytvoření osobní kopie", async () => {
    let finishSelection: (() => void) | undefined;
    const onSelectTemplate = vi.fn(
      () => new Promise<void>((resolve) => {
        finishSelection = resolve;
      }),
    );
    const project = {
      id: "project-1",
      title: "Pyrum",
      categories: [],
    } as ProjectDetails;

    render(
      <TemplateManager
        project={project}
        onSelectTemplate={onSelectTemplate}
      />,
    );

    const selectButton = await screen.findByRole("button", {
      name: /Použít tuto šablonu/,
    });
    fireEvent.click(selectButton);
    fireEvent.click(selectButton);

    expect(onSelectTemplate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Ukládám volbu/ })).toBeDisabled();

    finishSelection?.();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Použít tuto šablonu/ })).toBeEnabled();
    });
  });
});
