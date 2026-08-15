import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarUpdateStatus } from "@features/desktop-updater/ui/SidebarUpdateStatus";
import type { UpdateStatus } from "@infra/desktop/useElectronUpdater";

const installUpdate = vi.fn();
const checkForUpdates = vi.fn();
const downloadUpdate = vi.fn();

let updaterState: {
  status: UpdateStatus;
  info?: { version: string };
  progress?: { percent: number; transferred: number; total: number };
  error?: string;
};

vi.mock("@infra/desktop/useElectronUpdater", () => ({
  useElectronUpdater: () => ({
    ...updaterState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  }),
}));

describe("SidebarUpdateStatus", () => {
  beforeEach(() => {
    updaterState = { status: "not-available" };
    installUpdate.mockReset();
    checkForUpdates.mockReset();
    downloadUpdate.mockReset();
  });

  it("zobrazuje v klidovém stavu pouze aktuální verzi", () => {
    render(<SidebarUpdateStatus currentVersion="1.9.6" isIndustrialSkin />);

    expect(screen.getByText("v1.9.6")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /restartovat/i })).not.toBeInTheDocument();
  });

  it("zobrazuje průběh stahování a omezí procenta na platný rozsah", () => {
    updaterState = {
      status: "downloading",
      info: { version: "1.9.7" },
      progress: { percent: 142.4, transferred: 80, total: 100 },
    };

    render(<SidebarUpdateStatus currentVersion="1.9.6" isIndustrialSkin />);

    expect(screen.getByRole("status")).toHaveTextContent("Aktualizuji na v1.9.7");
    expect(screen.getByRole("status")).toHaveTextContent("100 %");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("po stažení nabídne jedinou akci restartovat a nainstalovat", () => {
    updaterState = {
      status: "downloaded",
      info: { version: "1.9.7" },
    };

    render(<SidebarUpdateStatus currentVersion="1.9.6" isIndustrialSkin />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Restartovat pro aktualizaci na verzi 1.9.7",
      }),
    );

    expect(installUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("v1.9.6")).not.toBeInTheDocument();
  });

  it("chybu zobrazí nenásilně ve footeru a umožní opakovat kontrolu", () => {
    updaterState = {
      status: "error",
      error: "Síť není dostupná",
    };

    render(<SidebarUpdateStatus currentVersion="1.9.6" isIndustrialSkin />);

    const retry = screen.getByRole("button", { name: "Zkusit aktualizaci znovu" });
    expect(retry).toHaveAttribute(
      "title",
      "Aktualizaci se nepodařilo dokončit. Zkuste kontrolu znovu.",
    );

    fireEvent.click(retry);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
  });
});
