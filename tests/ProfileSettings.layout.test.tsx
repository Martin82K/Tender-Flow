import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSettings } from "../features/settings/ProfileSettings";

const queryClientMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

const uiMocks = vi.hoisted(() => ({
  showAlert: vi.fn(),
  showConfirm: vi.fn().mockResolvedValue(true),
}));

const authMocks = vi.hoisted(() => ({
  updatePreferences: vi.fn(),
}));

const userProfileServiceMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

const organizationServiceMocks = vi.hoisted(() => ({
  getMyOrgRequestStatus: vi.fn(),
  requestOrgJoinByEmail: vi.fn(),
}));

const contactStatusServiceMocks = vi.hoisted(() => ({
  addContactStatus: vi.fn(),
  updateContactStatus: vi.fn(),
  deleteContactStatus: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => queryClientMocks,
}));

vi.mock("../context/UIContext", () => ({
  useUI: () => uiMocks,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authMocks,
}));

vi.mock("../services/userProfileService", () => ({
  userProfileService: userProfileServiceMocks,
}));

vi.mock("../services/organizationService", () => ({
  organizationService: organizationServiceMocks,
}));

vi.mock("../services/contactStatusService", () => contactStatusServiceMocks);

vi.mock("@/hooks/useElectronUpdater", () => ({
  useElectronUpdater: () => ({
    checkForUpdates: vi.fn(),
    status: "not-available",
    info: null,
    error: null,
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
  }),
}));

vi.mock("../features/settings/BiometricSettings", () => ({
  BiometricSettings: ({ className = "" }: { className?: string }) => (
    <div className={className}>Biometrické přihlášení</div>
  ),
}));

describe("ProfileSettings layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    userProfileServiceMocks.getProfile.mockResolvedValue({
      displayName: "Martin Kalkuš",
      signatureName: "Martin Kalkuš",
      signatureRole: "technik přípravy staveb",
      signaturePhone: "+420 123 456 789",
      signaturePhoneSecondary: "+420 777 300 042",
      signatureEmail: "martin@example.com",
      signatureGreeting: "S pozdravem",
    });

    organizationServiceMocks.getMyOrgRequestStatus.mockResolvedValue(null);
    organizationServiceMocks.requestOrgJoinByEmail.mockResolvedValue(undefined);
    contactStatusServiceMocks.addContactStatus.mockResolvedValue(true);
    contactStatusServiceMocks.updateContactStatus.mockResolvedValue(true);
    contactStatusServiceMocks.deleteContactStatus.mockResolvedValue(true);
  });

  it("nezobrazuje volbu barvy pozadí", async () => {
    render(
      <ProfileSettings
        theme="system"
        onSetTheme={vi.fn()}
        primaryColor="#607AFB"
        onSetPrimaryColor={vi.fn()}
        contactStatuses={[]}
        onUpdateStatuses={vi.fn()}
        onDeleteContacts={vi.fn()}
        contacts={[]}
        user={{
          id: "user-1",
          email: "martin@example.com",
          role: "admin",
          preferences: {
            autoShortenProjectDocs: false,
          },
        }}
      />
    );

    expect(await screen.findByText("Vzhled aplikace")).toBeInTheDocument();
    expect(screen.getByText("Biometrické přihlášení")).toBeInTheDocument();
    expect(screen.queryByText("Barva pozadí")).not.toBeInTheDocument();
  });
});
