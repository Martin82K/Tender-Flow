import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrgBrandingTab } from "@/features/organization/ui/OrgBrandingTab";

const organizationServiceMocks = vi.hoisted(() => ({
  getOrganizationLogoUrl: vi.fn(),
  getOrganizationEmailBranding: vi.fn(),
  uploadOrganizationLogo: vi.fn(),
  removeOrganizationLogo: vi.fn(),
  uploadOrganizationEmailLogo: vi.fn(),
  removeOrganizationEmailLogo: vi.fn(),
  saveOrganizationEmailBranding: vi.fn(),
}));

vi.mock("@features/organization/api", () => ({
  organizationService: organizationServiceMocks,
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({
    showAlert: vi.fn(),
  }),
}));

describe("OrgBrandingTab e-mailové logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("v náhledu používá signed URL e-mailového loga, ne běžné logo organizace", async () => {
    organizationServiceMocks.getOrganizationLogoUrl.mockResolvedValue("https://cdn.example/logo.png");
    organizationServiceMocks.getOrganizationEmailBranding.mockResolvedValue({
      emailLogoPath: "organizations/org-1/email-logo.png",
      emailLogoUrl: "https://cdn.example/email-logo.png",
      companyName: "REKO Bazén Aš",
      companyAddress: null,
      companyMeta: null,
      disclaimerHtml: null,
      fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif",
      fontSize: "16px",
    });

    render(<OrgBrandingTab orgId="org-1" isAdminOrOwner />);

    const logo = await screen.findByRole("img", { name: "REKO Bazén Aš" });

    expect(logo).toHaveAttribute("src", "https://cdn.example/email-logo.png");
    await waitFor(() => {
      expect(organizationServiceMocks.getOrganizationLogoUrl).toHaveBeenCalledTimes(1);
    });
  });
});
