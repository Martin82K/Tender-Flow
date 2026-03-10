import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionFeaturesManagement } from "@/features/settings/SubscriptionFeaturesManagement";

const mocks = vi.hoisted(() => ({
  listFeatures: vi.fn(),
  listTierFlags: vi.fn(),
  setTierFlag: vi.fn(),
  createFeature: vi.fn(),
  updateFeature: vi.fn(),
  deleteFeature: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
}));

vi.mock("@/services/subscriptionFeaturesService", () => ({
  subscriptionFeaturesService: {
    listFeatures: mocks.listFeatures,
    listTierFlags: mocks.listTierFlags,
    setTierFlag: mocks.setTierFlag,
    createFeature: mocks.createFeature,
    updateFeature: mocks.updateFeature,
    deleteFeature: mocks.deleteFeature,
  },
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({
    showAlert: mocks.showAlert,
    showConfirm: mocks.showConfirm,
  }),
}));

describe("SubscriptionFeaturesManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listFeatures.mockResolvedValue([
      {
        key: "export_pdf",
        name: "Export do PDF",
        description: "Export přehledů/projektu do PDF",
        category: "Export",
        sortOrder: 30,
      },
      {
        key: "ai_insights",
        name: "AI Insights",
        description: "AI analýza (Dashboard)",
        category: "AI",
        sortOrder: 50,
      },
    ]);
    mocks.listTierFlags.mockResolvedValue([
      { tier: "free", featureKey: "export_pdf", enabled: false },
      { tier: "starter", featureKey: "export_pdf", enabled: true },
      { tier: "pro", featureKey: "export_pdf", enabled: true },
      { tier: "enterprise", featureKey: "export_pdf", enabled: true },
    ]);
    mocks.createFeature.mockResolvedValue(undefined);
    mocks.setTierFlag.mockResolvedValue(undefined);
    mocks.updateFeature.mockResolvedValue(undefined);
    mocks.deleteFeature.mockResolvedValue(undefined);
    mocks.showConfirm.mockResolvedValue(true);
  });

  it("zobrazuje systémové AI moduly právě jednou ve skupině AI bez zvláštního horního bloku", async () => {
    render(<SubscriptionFeaturesManagement />);

    expect(await screen.findByRole("heading", { name: "AI" })).toBeInTheDocument();
    expect(screen.queryByText("AI moduly podle předplatného")).not.toBeInTheDocument();
    expect(screen.getAllByText("Povolit Viki")).toHaveLength(1);
    expect(screen.getAllByText("Povolit OCR")).toHaveLength(1);
  });

  it("nezobrazuje odstraněný AI Insights ani když ještě dorazí z databáze", async () => {
    render(<SubscriptionFeaturesManagement />);

    await screen.findByText("Povolit Viki");
    expect(screen.queryByText("AI Insights")).not.toBeInTheDocument();
  });

  it("při zapnutí Viki nejdřív založí feature a pak uloží flag tarifu", async () => {
    mocks.listFeatures.mockResolvedValue([]);
    mocks.listTierFlags.mockResolvedValue([]);

    render(<SubscriptionFeaturesManagement />);

    fireEvent.click(await screen.findByRole("button", { name: "Povolit Viki – Free" }));

    await waitFor(() => {
      expect(mocks.createFeature).toHaveBeenCalledWith({
        key: "ai_viki",
        name: "Povolit Viki",
        description: "Přístup k AI asistentce Viki a jejím analytickým funkcím.",
        category: "AI moduly",
        sortOrder: 51,
      });
    });

    expect(mocks.setTierFlag).toHaveBeenCalledWith("free", "ai_viki", false);
    expect(mocks.setTierFlag).toHaveBeenCalledWith("starter", "ai_viki", false);
    expect(mocks.setTierFlag).toHaveBeenCalledWith("pro", "ai_viki", false);
    expect(mocks.setTierFlag).toHaveBeenCalledWith("enterprise", "ai_viki", false);
    expect(mocks.setTierFlag).toHaveBeenCalledWith("admin", "ai_viki", true);
    expect(mocks.setTierFlag).toHaveBeenCalledWith("free", "ai_viki", true);
  });

  it("otevře boční panel a uloží úpravu běžné funkce", async () => {
    render(<SubscriptionFeaturesManagement />);

    fireEvent.click((await screen.findByText("Export do PDF")).closest('[role="button"]')!);

    const panel = await screen.findByText("Detail funkce");
    expect(panel).toBeInTheDocument();

    const descriptionInput = screen.getByLabelText("Popis");
    fireEvent.change(descriptionInput, {
      target: { value: "Nový popis exportu do PDF" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Uložit/ }));

    await waitFor(() => {
      expect(mocks.updateFeature).toHaveBeenCalledWith("export_pdf", {
        name: "Export do PDF",
        description: "Nový popis exportu do PDF",
        category: "Export",
        sortOrder: 30,
      });
    });
  });

  it("u systémové funkce zakáže smazání a uzamkne název", async () => {
    render(<SubscriptionFeaturesManagement />);

    fireEvent.click((await screen.findByText("Povolit Viki")).closest('[role="button"]')!);

    const panel = await screen.findByRole("complementary");
    const deleteButton = within(panel).getByRole("button", { name: /Smazat/ });
    const nameInput = screen.getByLabelText("Název") as HTMLInputElement;

    expect(deleteButton).toBeDisabled();
    expect(nameInput).toBeDisabled();
  });
});
