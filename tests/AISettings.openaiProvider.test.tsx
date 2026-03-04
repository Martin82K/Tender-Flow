import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/settings/VikiCostControl", () => ({
  VikiCostControl: () => <div data-testid="viki-cost-control" />,
}));

const mockSingle = vi.fn(async () => ({ data: null, error: null }));
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockUpdate = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));

vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
      upsert: vi.fn(async () => ({ error: null })),
      eq: mockEq,
      single: mockSingle,
    })),
    functions: {
      invoke: vi.fn(async () => ({ data: { models: [] }, error: null })),
    },
  },
}));

import { AISettings } from "@/features/settings/AISettings";

describe("AISettings OpenAI provider", () => {
  it("umozni zvolit OpenAI pro analyzu a zobrazi odpovidajici API key hint", () => {
    render(<AISettings isAdmin />);

    fireEvent.click(screen.getByRole("button", { name: "OpenAI" }));

    expect(screen.getByDisplayValue("gpt-5-mini")).toBeInTheDocument();
    expect(screen.getByText("OpenAI API Key")).toBeInTheDocument();
  });
});
