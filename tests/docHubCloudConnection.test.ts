import { describe, expect, it } from "vitest";

import { getDocHubCloudConnection } from "@shared/dochub/cloudConnection";
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
});
