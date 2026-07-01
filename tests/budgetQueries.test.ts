import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadExistingProjectBudget,
  loadProjectBudget,
  PROJECT_BUDGET_LOAD_TIMEOUT_MESSAGE,
  PROJECT_BUDGET_LOAD_TIMEOUT_MS,
} from "@/features/budgets/api/budgetQueries";
import { budgetRepository } from "@/features/budgets/api/budgetRepository";

vi.mock("@/features/budgets/api/budgetRepository", () => ({
  budgetRepository: {
    getOrCreateProjectBudget: vi.fn(),
    getProjectBudget: vi.fn(),
  },
}));

describe("budget queries", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("ukončí načítání rozpočtu timeoutem místo nekonečného čekání", async () => {
    vi.useFakeTimers();
    vi.mocked(budgetRepository.getOrCreateProjectBudget).mockReturnValue(new Promise(() => undefined));

    const request = loadProjectBudget("project-1", "Stavba 1");
    const expectation = expect(request).rejects.toThrow(PROJECT_BUDGET_LOAD_TIMEOUT_MESSAGE);

    await vi.advanceTimersByTimeAsync(PROJECT_BUDGET_LOAD_TIMEOUT_MS);

    await expectation;
  });

  it("ukončí načítání existujícího rozpočtu timeoutem místo nekonečného čekání", async () => {
    vi.useFakeTimers();
    vi.mocked(budgetRepository.getProjectBudget).mockReturnValue(new Promise(() => undefined));

    const request = loadExistingProjectBudget("project-1");
    const expectation = expect(request).rejects.toThrow(PROJECT_BUDGET_LOAD_TIMEOUT_MESSAGE);

    await vi.advanceTimersByTimeAsync(PROJECT_BUDGET_LOAD_TIMEOUT_MS);

    await expectation;
  });
});
