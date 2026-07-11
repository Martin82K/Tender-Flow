import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";
import type { ContractWithDetails } from "@/types";

const state = vi.hoisted(() => ({
  identity: null as AuthIdentity | null,
  legacyUser: null as AuthIdentity | null,
  updateVendorRating: vi.fn(),
  updateContract: vi.fn(),
}));

vi.mock("@shared/auth/AuthIdentityContext", () => ({
  useAuthIdentity: () => state.identity,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: state.legacyUser }),
}));

vi.mock("@features/projects/contracts/api", () => ({
  contractMutationsApi: {
    updateVendorRating: state.updateVendorRating,
    updateContract: state.updateContract,
  },
}));

import { VendorRatingDialog } from "@features/projects/contracts/forms/VendorRatingDialog";

const userA: AuthIdentity = {
  id: "user-a",
  email: "a@example.com",
  role: "user",
};
const userB: AuthIdentity = {
  id: "user-b",
  email: "b@example.com",
  role: "admin",
};
const demoUser: AuthIdentity = {
  id: "demo-user",
  email: "demo@example.com",
  role: "demo",
};

const makeContract = (
  overrides: Partial<ContractWithDetails> = {},
): ContractWithDetails =>
  ({
    id: "contract-1",
    vendorName: "Dodavatel s.r.o.",
    vendorRating: 3,
    vendorRatingNote: "Původní poznámka",
    vendorRatingAt: "2026-07-10T10:00:00.000Z",
    ...overrides,
  }) as ContractWithDetails;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const renderDialog = (
  options: {
    contract?: ContractWithDetails;
    onSaved?: () => Promise<void> | void;
  } = {},
) => {
  const onSaved = options.onSaved ?? vi.fn();
  const onClose = vi.fn();
  const view = render(
    <VendorRatingDialog
      contract={options.contract ?? makeContract()}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  return { ...view, onClose, onSaved };
};

describe("VendorRatingDialog auth boundary", () => {
  beforeEach(() => {
    state.identity = userA;
    state.legacyUser = demoUser;
    state.updateVendorRating.mockReset();
    state.updateVendorRating.mockResolvedValue(undefined);
    state.updateContract.mockReset();
    state.updateContract.mockResolvedValue(undefined);
  });

  it("saves a trimmed rating through the dedicated server boundary", async () => {
    const onSaved = vi.fn();
    renderDialog({ onSaved });

    fireEvent.click(screen.getByRole("button", { name: "Hodnocení 4 z 5" }));
    fireEvent.change(screen.getByPlaceholderText(/Kvalita/), {
      target: { value: "  Spolehlivý dodavatel  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));

    await waitFor(() =>
      expect(state.updateVendorRating).toHaveBeenCalledWith("contract-1", {
        rating: 4,
        note: "Spolehlivý dodavatel",
      }),
    );
    expect(state.updateContract).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("clears rating metadata through the dedicated server boundary", async () => {
    const onSaved = vi.fn();
    renderDialog({ onSaved });

    fireEvent.click(screen.getByRole("button", { name: "Smazat hodnocení" }));

    await waitFor(() =>
      expect(state.updateVendorRating).toHaveBeenCalledWith("contract-1", {
        rating: null,
        note: null,
      }),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("preserves a trimmed note when the star rating is cleared", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Hodnocení 3 z 5" }));
    fireEvent.change(screen.getByPlaceholderText(/Kvalita/), {
      target: { value: "  Pouze poznámka  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));

    await waitFor(() =>
      expect(state.updateVendorRating).toHaveBeenCalledWith("contract-1", {
        rating: null,
        note: "Pouze poznámka",
      }),
    );
  });

  it.each([
    ["missing", null, "CONTRACT_VENDOR_RATING_AUTH_REQUIRED"],
    ["demo", demoUser, "CONTRACT_VENDOR_RATING_DEMO_READ_ONLY"],
    ["empty id", { ...userA, id: "   " }, "CONTRACT_VENDOR_RATING_AUTH_REQUIRED"],
  ])("blocks %s identity before any mutation", (_label, identity, errorCode) => {
    state.identity = identity;
    state.legacyUser = userA;
    renderDialog();

    expect(screen.getByText(new RegExp(errorCode))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uložit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Smazat hodnocení" })).toBeDisabled();
    expect(state.updateVendorRating).not.toHaveBeenCalled();
    expect(state.updateContract).not.toHaveBeenCalled();
  });

  it("sanitizes a backend failure and keeps the dialog open", async () => {
    state.updateVendorRating.mockRejectedValue(
      new Error("token=secret raw backend payload"),
    );
    const onSaved = vi.fn();
    renderDialog({ onSaved });

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));

    expect(
      await screen.findByText(/CONTRACT_VENDOR_RATING_SAVE_FAILED/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/token=secret/)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("ignores a stale successful completion after an identity switch", async () => {
    const request = deferred<void>();
    state.updateVendorRating.mockReturnValue(request.promise);
    state.updateContract.mockReturnValue(request.promise);
    const onSaved = vi.fn();
    const view = renderDialog({ onSaved });

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    state.identity = userB;
    view.rerender(
      <VendorRatingDialog
        contract={makeContract()}
        onClose={view.onClose}
        onSaved={onSaved}
      />,
    );
    await act(async () => {
      request.resolve();
      await request.promise;
    });

    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Uložit" })).not.toBeDisabled();
  });

  it("does not surface a stale failure to the next identity", async () => {
    const request = deferred<void>();
    state.updateVendorRating.mockReturnValue(request.promise);
    state.updateContract.mockReturnValue(request.promise);
    const view = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    state.identity = userB;
    view.rerender(
      <VendorRatingDialog
        contract={makeContract()}
        onClose={view.onClose}
        onSaved={view.onSaved}
      />,
    );
    await act(async () => {
      request.reject(new Error("private stale failure"));
      try {
        await request.promise;
      } catch {
        // The component handles the rejection; this await only flushes it.
      }
    });

    expect(screen.queryByText(/SAVE_FAILED/)).not.toBeInTheDocument();
    expect(screen.queryByText(/private stale failure/)).not.toBeInTheDocument();
  });

  it("does not run a completion callback after unmount", async () => {
    const request = deferred<void>();
    state.updateVendorRating.mockReturnValue(request.promise);
    const onSaved = vi.fn();
    const view = renderDialog({ onSaved });

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    view.unmount();
    await act(async () => {
      request.resolve();
      await request.promise;
    });

    expect(onSaved).not.toHaveBeenCalled();
  });
});
