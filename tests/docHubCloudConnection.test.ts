import { describe, expect, it, vi } from "vitest";

import {
  canOpenProjectDocHub,
  getDocHubCloudConnection,
  replaceDocHubCloudFallbackUrl,
  sanitizeDocHubSettings,
} from "@shared/dochub/cloudConnection";
import {
  recoverCloudDocHubConnection,
  resolveCloudDocHubConnection,
} from "../supabase/functions/_shared/dochub_connection";
import type { ProjectDetails } from "@/types";

describe("DocHub cloud connection fallback", () => {
  const localProject = {
    id: "project-1",
    title: "Projekt",
    categories: [],
    docHubProvider: "onedrive",
    docHubRootLink: "D:\\Synchronizace\\Projekt",
    docHubRootId: "local:connection-1",
    docHubSettings: {
      gdrive: {
        rootId: "cloud-root",
        rootLink: "https://drive.google.com/drive/folders/cloud-root",
        rootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
      },
    },
  } as ProjectDetails;

  it("vybere zachované Google Drive připojení na klientovi", () => {
    expect(getDocHubCloudConnection(localProject)).toEqual({
      provider: "gdrive",
      rootId: "cloud-root",
      driveId: null,
      rootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
    });
  });

  it("vybere stejnou cloudovou konfiguraci v Edge Function", () => {
    expect(resolveCloudDocHubConnection({
      dochub_provider: "onedrive",
      dochub_root_id: "local:connection-1",
      dochub_drive_id: null,
      dochub_settings: localProject.docHubSettings,
    })).toEqual({
      provider: "gdrive",
      rootId: "cloud-root",
      driveId: null,
    });
  });

  it("odmítne lokální identifikátor vydávaný za cloudové nastavení", () => {
    expect(resolveCloudDocHubConnection({
      dochub_provider: "onedrive",
      dochub_root_id: "local:connection-1",
      dochub_settings: { gdrive: { rootId: "local:spoofed" } },
    })).toBeNull();
  });

  it("obnoví chybějící OneDrive ID read-only z uložené SharePoint URL vlastníka", async () => {
    const getAccessTokenForUser = vi.fn().mockResolvedValue({ accessToken: "owner-token" });
    const resolveMicrosoftSharingUrl = vi.fn().mockResolvedValue({
      id: "resolved-root",
      driveId: "resolved-drive",
    });
    const project = {
      owner_id: "owner-user",
      dochub_provider: "onedrive",
      dochub_root_id: "local:owner-connection",
      dochub_root_web_url: "https://baustavkv-my.sharepoint.com/shared/project-root",
      dochub_settings: {
        onedrive_cloud: {
          rootWebUrl: "https://baustavkv-my.sharepoint.com/shared/project-root",
        },
      },
    };

    await expect(recoverCloudDocHubConnection(project, {
      getAccessTokenForUser,
      getGoogleFolderMeta: vi.fn(),
      parseGoogleFolderId: vi.fn(),
      resolveMicrosoftSharingUrl,
    })).resolves.toEqual({
      provider: "onedrive",
      rootId: "resolved-root",
      driveId: "resolved-drive",
    });
    expect(getAccessTokenForUser).toHaveBeenCalledWith({
      userId: "owner-user",
      provider: "onedrive",
    });
    expect(resolveMicrosoftSharingUrl).toHaveBeenCalledWith({
      accessToken: "owner-token",
      sharingUrl: "https://baustavkv-my.sharepoint.com/shared/project-root",
    });
  });

  it("nepoužije owner token bez platné podporované fallback URL", async () => {
    const getAccessTokenForUser = vi.fn();
    await expect(recoverCloudDocHubConnection({
      owner_id: "owner-user",
      dochub_provider: "onedrive",
      dochub_root_id: "local:owner-connection",
      dochub_root_web_url: "https://evil.example/project-root",
    }, {
      getAccessTokenForUser,
      getGoogleFolderMeta: vi.fn(),
      parseGoogleFolderId: vi.fn(),
      resolveMicrosoftSharingUrl: vi.fn(),
    })).resolves.toBeNull();
    expect(getAccessTokenForUser).not.toHaveBeenCalled();
  });

  it("nepovolí fallback po explicitním odpojení DocHubu", () => {
    expect(canOpenProjectDocHub({
      ...localProject,
      docHubProvider: null,
      docHubStatus: "disconnected",
    }, "")).toBe(false);
    expect(canOpenProjectDocHub({
      ...localProject,
      docHubStatus: "disconnected",
    }, "D:\\Synchronizace\\Projekt")).toBe(false);
  });

  it("zachová otevření staršího připojeného projektu bez uloženého stavu", () => {
    expect(canOpenProjectDocHub({
      ...localProject,
      docHubEnabled: true,
      docHubStatus: undefined,
    }, "D:\\Synchronizace\\Projekt")).toBe(true);
  });

  it("zachová zobrazovaný název cloudové složky s lomítkem", () => {
    expect(sanitizeDocHubSettings({
      gdrive: {
        rootId: "cloud-root",
        rootName: "Projekt / etapa",
        rootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
      },
    }).gdrive?.rootName).toBe("Projekt / etapa");
  });

  it("zachová cloudový název začínající lomítkem", () => {
    expect(sanitizeDocHubSettings({
      gdrive: {
        rootId: "cloud-root",
        rootName: "/Projekt",
        rootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
      },
    }).gdrive?.rootName).toBe("/Projekt");
  });

  it("při změně Google fallbacku zachová nezávislé OneDrive připojení", () => {
    expect(replaceDocHubCloudFallbackUrl({
      gdrive: {
        rootId: "old-google-root",
        rootWebUrl: "https://drive.google.com/drive/folders/old-google-root",
      },
      onedrive_cloud: {
        rootId: "onedrive-root",
        rootWebUrl: "https://contoso.sharepoint.com/sites/project",
      },
    }, "https://drive.google.com/drive/folders/new-google-root")).toEqual({
      gdrive: {
        rootLink: "https://drive.google.com/drive/folders/new-google-root",
        rootWebUrl: "https://drive.google.com/drive/folders/new-google-root",
      },
      onedrive_cloud: {
        rootId: "onedrive-root",
        rootLink: "https://contoso.sharepoint.com/sites/project",
        rootWebUrl: "https://contoso.sharepoint.com/sites/project",
      },
    });
  });

  it("neuloží lokální cestu vydávanou za zobrazovaný název", () => {
    expect(sanitizeDocHubSettings({
      local: { rootName: "C:\\Users\\Owner\\Projekt" },
    }).local).toBeUndefined();
  });

  it("nepoužije staré OneDrive ID pro nový Google fallback", () => {
    const switchedFallbackProject = {
      ...localProject,
      docHubRootWebUrl: "https://drive.google.com/drive/folders/new-google-root",
      docHubSettings: {
        gdrive: {
          rootWebUrl: "https://drive.google.com/drive/folders/new-google-root",
        },
        onedrive_cloud: {
          rootId: "old-onedrive-root",
          driveId: "old-drive",
          rootWebUrl: "https://contoso.sharepoint.com/sites/old",
        },
      },
    } as ProjectDetails;

    expect(getDocHubCloudConnection(switchedFallbackProject)).toBeNull();
    expect(resolveCloudDocHubConnection({
      dochub_provider: "onedrive",
      dochub_root_id: "local:connection-1",
      dochub_root_web_url: switchedFallbackProject.docHubRootWebUrl,
      dochub_settings: switchedFallbackProject.docHubSettings,
    })).toBeNull();
  });

  it("nepoužije staré Google ID pro nový Google fallback", () => {
    const currentFallbackUrl = "https://drive.google.com/drive/folders/new-google-root";
    const staleSettings = {
      gdrive: {
        rootId: "old-google-root",
        rootWebUrl: "https://drive.google.com/drive/folders/old-google-root",
      },
    };
    const switchedFallbackProject = {
      ...localProject,
      docHubRootWebUrl: currentFallbackUrl,
      docHubSettings: staleSettings,
    } as ProjectDetails;

    expect(getDocHubCloudConnection(switchedFallbackProject)).toBeNull();
    expect(resolveCloudDocHubConnection({
      dochub_provider: "onedrive",
      dochub_root_id: "local:connection-1",
      dochub_root_web_url: currentFallbackUrl,
      dochub_settings: staleSettings,
    })).toBeNull();
  });

  it("použije cloudové ID pouze při shodě celé normalizované fallback URL", () => {
    const currentFallbackUrl = "https://drive.google.com/drive/folders/current-root";
    const currentSettings = {
      gdrive: {
        rootId: "current-root",
        rootWebUrl: currentFallbackUrl,
      },
    };
    const currentProject = {
      ...localProject,
      docHubRootWebUrl: currentFallbackUrl,
      docHubSettings: currentSettings,
    } as ProjectDetails;

    expect(getDocHubCloudConnection(currentProject)).toEqual({
      provider: "gdrive",
      rootId: "current-root",
      driveId: null,
      rootWebUrl: currentFallbackUrl,
    });
    expect(resolveCloudDocHubConnection({
      dochub_provider: "onedrive",
      dochub_root_id: "local:connection-1",
      dochub_root_web_url: currentFallbackUrl,
      dochub_settings: currentSettings,
    })).toEqual({
      provider: "gdrive",
      rootId: "current-root",
      driveId: null,
    });
  });

  it("odmítne historické cloudové ID při nepovolené fallback URL", () => {
    const invalidFallbackProject = {
      ...localProject,
      docHubRootWebUrl: "https://evil.example/folder",
    } as ProjectDetails;

    expect(getDocHubCloudConnection(invalidFallbackProject)).toBeNull();
    expect(resolveCloudDocHubConnection({
      dochub_provider: "onedrive",
      dochub_root_id: "local:connection-1",
      dochub_root_web_url: invalidFallbackProject.docHubRootWebUrl,
      dochub_settings: localProject.docHubSettings,
    })).toBeNull();
  });
});
