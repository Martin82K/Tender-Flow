import { beforeEach, describe, expect, it, vi } from "vitest";

import { organizationService } from "../services/organizationService";

const supabaseMocks = vi.hoisted(() => {
  const createSignedUrl = vi.fn();
  const upload = vi.fn();
  const remove = vi.fn();
  const from = vi.fn(() => ({
    createSignedUrl,
    upload,
    remove,
  }));

  return {
    rpc: vi.fn(),
    storage: {
      from,
    },
    createSignedUrl,
    upload,
    remove,
    from,
  };
});

vi.mock("../services/supabase", () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
    storage: supabaseMocks.storage,
  },
}));

describe("organizationService branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("vrátí signed URL pro logo organizace", async () => {
    supabaseMocks.rpc.mockResolvedValueOnce({
      data: [
        {
          organization_id: "org-1",
          organization_name: "Baustav",
          member_role: "admin",
          domain_whitelist: ["baustav.cz"],
          logo_path: "organizations/org-1/logo.png",
        },
      ],
      error: null,
    });
    supabaseMocks.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://cdn.example/logo" },
      error: null,
    });

    const result = await organizationService.getOrganizationLogoUrl("org-1");

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_my_organizations");
    expect(supabaseMocks.from).toHaveBeenCalledWith("organization-branding");
    expect(supabaseMocks.createSignedUrl).toHaveBeenCalledWith(
      "organizations/org-1/logo.png",
      3600,
    );
    expect(result).toBe("https://cdn.example/logo");
  });

  it("nahraje validní logo a uloží cestu přes RPC", async () => {
    const file = new File(["ok"], "logo.png", { type: "image/png" });

    supabaseMocks.upload.mockResolvedValueOnce({ error: null });
    supabaseMocks.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        data: [
          {
            organization_id: "org-1",
            logo_path: "organizations/org-1/logo.png",
          },
        ],
        error: null,
      });
    supabaseMocks.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://cdn.example/logo.png" },
      error: null,
    });

    const result = await organizationService.uploadOrganizationLogo("org-1", file);

    expect(supabaseMocks.upload).toHaveBeenCalledWith(
      "organizations/org-1/logo.png",
      file,
      expect.objectContaining({
        upsert: true,
        contentType: "image/png",
      }),
    );
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("set_organization_logo_path", {
      org_id_input: "org-1",
      logo_path_input: "organizations/org-1/logo.png",
    });
    expect(result.logoPath).toBe("organizations/org-1/logo.png");
    expect(result.logoUrl).toBe("https://cdn.example/logo.png");
  });

  it("vrátí e-mailový branding organizace včetně signed URL", async () => {
    supabaseMocks.rpc.mockResolvedValueOnce({
      data: [
        {
          organization_id: "org-1",
          organization_name: "Baustav",
          member_role: "admin",
          email_logo_path: "organizations/org-1/email-logo.png",
          email_signature_company_name: "BAU-STAV a.s.",
          email_signature_company_address: "Loketská 344/12",
          email_signature_company_meta: "IČ: 147 05 877",
          email_signature_disclaimer_html: "<p>Disclaimer</p>",
        },
      ],
      error: null,
    });
    supabaseMocks.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://cdn.example/email-logo.png" },
      error: null,
    });

    const result = await organizationService.getOrganizationEmailBranding("org-1");

    expect(result).toMatchObject({
      emailLogoPath: "organizations/org-1/email-logo.png",
      emailLogoUrl: "https://cdn.example/email-logo.png",
      companyName: "BAU-STAV a.s.",
    });
  });

  it("nahraje validní e-mailové logo a uloží cestu přes RPC", async () => {
    const file = new File(["ok"], "email-logo.png", { type: "image/png" });

    supabaseMocks.upload.mockResolvedValueOnce({ error: null });
    supabaseMocks.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        data: [
          {
            organization_id: "org-1",
            email_logo_path: "organizations/org-1/email-logo.png",
          },
        ],
        error: null,
      });
    supabaseMocks.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://cdn.example/email-logo.png" },
      error: null,
    });

    const result = await organizationService.uploadOrganizationEmailLogo("org-1", file);

    expect(supabaseMocks.upload).toHaveBeenCalledWith(
      "organizations/org-1/email-logo.png",
      file,
      expect.objectContaining({
        upsert: true,
        contentType: "image/png",
      }),
    );
    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      "set_organization_email_logo_path",
      {
        org_id_input: "org-1",
        email_logo_path_input: "organizations/org-1/email-logo.png",
      },
    );
    expect(result.logoUrl).toBe("https://cdn.example/email-logo.png");
  });

  it("odmítne upload nepovoleného typu", async () => {
    const file = new File(["bad"], "logo.gif", { type: "image/gif" });

    await expect(
      organizationService.uploadOrganizationLogo("org-1", file),
    ).rejects.toThrow(/Nepodporovaný formát loga/i);
  });

  it("odmítne upload příliš velkého souboru", async () => {
    const bigBlob = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], {
      type: "image/png",
    });
    const file = new File([bigBlob], "big.png", { type: "image/png" });

    await expect(
      organizationService.uploadOrganizationLogo("org-1", file),
    ).rejects.toThrow(/Maximální velikost je 2 MB/i);
  });

  it("smaže existující logo a vynuluje metadata", async () => {
    supabaseMocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            organization_id: "org-1",
            logo_path: "organizations/org-1/logo.png",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ error: null });
    supabaseMocks.remove.mockResolvedValueOnce({ error: null });

    await organizationService.removeOrganizationLogo("org-1");

    expect(supabaseMocks.remove).toHaveBeenCalledWith(["organizations/org-1/logo.png"]);
    expect(supabaseMocks.rpc).toHaveBeenLastCalledWith("set_organization_logo_path", {
      org_id_input: "org-1",
      logo_path_input: null,
    });
  });

  it("uloží textové části e-mailového brandingu přes RPC", async () => {
    supabaseMocks.rpc.mockResolvedValueOnce({ error: null });

    await organizationService.saveOrganizationEmailBranding("org-1", {
      companyName: "BAU-STAV a.s.",
      companyAddress: "Loketská 344/12",
      companyMeta: "IČ: 147 05 877",
      disclaimerHtml: "<p>Disclaimer</p>",
    });

    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      "set_organization_email_branding",
      expect.objectContaining({
        org_id_input: "org-1",
        company_name_input: "BAU-STAV a.s.",
        company_address_input: "Loketská 344/12",
        company_meta_input: "IČ: 147 05 877",
        disclaimer_html_input: "<p>Disclaimer</p>",
      }),
    );
  });
});
