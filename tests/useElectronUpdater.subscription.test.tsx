import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const adapterMocks = vi.hoisted(() => ({
  getStatus: vi.fn(async () => ({ status: "not-available" as const })),
  onStatusChange: vi.fn(() => vi.fn()),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
}));

vi.mock("@infra/platform/platformAdapter", () => ({
  updaterAdapter: adapterMocks,
}));

import { useElectronUpdater } from "@infra/desktop/useElectronUpdater";

const Consumer = () => {
  useElectronUpdater();
  return null;
};

describe("useElectronUpdater", () => {
  it("sdílí jediný IPC subscription mezi více komponentami", async () => {
    render(
      <>
        <Consumer />
        <Consumer />
      </>,
    );

    await waitFor(() => {
      expect(adapterMocks.getStatus).toHaveBeenCalledTimes(1);
    });
    expect(adapterMocks.onStatusChange).toHaveBeenCalledTimes(1);
  });
});
