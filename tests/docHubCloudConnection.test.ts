import { describe, expect, it } from "vitest";

import {
  canOpenProjectDocHub,
  getDocHubCloudConnection,
  replaceDocHubCloudFallbackUrl,
  sanitizeDocHubSettings,
} from "@shared/dochub/cloudConnection";
import { resolveCloudDocHubConnection } from "../supabase/functions/_shared/dochub_connection";
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
});
