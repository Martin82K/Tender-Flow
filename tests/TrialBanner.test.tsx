import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrialBanner } from "@features/subscription/ui/TrialBanner";

describe("TrialBanner", () => {
  it("shows remaining trial days for an Enterprise trial", () => {
    render(
      <TrialBanner
        currentPlan="enterprise"
        isLoading={false}
        planStatus="trial"
        planExpiresAt={new Date(Date.now() + 3 * 86_400_000).toISOString()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Zkušební období: zbývají 3 dny/);
    expect(screen.getByRole("status")).toHaveTextContent(/Enterprise licenci/);
  });

  it("hides after expiry or when the account is not on trial", () => {
    const expired = render(
      <TrialBanner
        currentPlan="enterprise"
        isLoading={false}
        planStatus="trial"
        planExpiresAt={new Date(Date.now() - 86_400_000).toISOString()}
      />,
    );
    expect(expired.queryByRole("status")).not.toBeInTheDocument();
    expired.unmount();

    const active = render(
      <TrialBanner
        currentPlan="enterprise"
        isLoading={false}
        planStatus="active"
        planExpiresAt={new Date(Date.now() + 3 * 86_400_000).toISOString()}
      />,
    );
    expect(active.queryByRole("status")).not.toBeInTheDocument();
  });
});
