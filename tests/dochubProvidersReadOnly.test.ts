import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findGoogleFolder,
  findMicrosoftFolder,
} from "../supabase/functions/_shared/dochub_providers.ts";

describe("DocHub read-only folder lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds an existing Google folder without issuing a write request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      files: [{ id: "folder-1", name: "Betony", webViewLink: "https://drive.google.com/drive/folders/folder-1" }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findGoogleFolder({
      accessToken: "secret-token",
      parentId: "parent-1",
      name: "Betony",
    })).resolves.toMatchObject({ id: "folder-1", name: "Betony" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({ method: "POST" });
  });

  it("follows Google pagination until a stable appProperties match is found", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        files: [{
          id: "name-only",
          name: "Betony",
          webViewLink: "https://drive.google.com/drive/folders/name-only",
        }],
        nextPageToken: "next-page",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        files: [{
          id: "stable-folder",
          name: "Puvodni_nazev",
          webViewLink: "https://drive.google.com/drive/folders/stable-folder",
          appProperties: {
            dochubProjectId: "project-1",
            dochubKind: "tender",
            dochubKey: "category-1",
          },
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findGoogleFolder({
      accessToken: "secret-token",
      parentId: "parent-1",
      name: "Betony",
      appProperties: {
        dochubProjectId: "project-1",
        dochubKind: "tender",
        dochubKey: "category-1",
      },
    })).resolves.toMatchObject({ id: "stable-folder" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(secondUrl.searchParams.get("pageToken")).toBe("next-page");
    expect(fetchMock.mock.calls.every((call) => call[1]?.method !== "POST")).toBe(true);
  });

  it("stops cyclic Google pagination before unbounded requests", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      files: [],
      nextPageToken: "same-page",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findGoogleFolder({
      accessToken: "secret-token",
      parentId: "parent-1",
      name: "Betony",
      appProperties: { dochubProjectId: "project-1" },
    })).rejects.toThrow("Drive pagination limit exceeded");
    expect(fetchMock).toHaveBeenCalledTimes(100);
  });

  it("finds an existing Microsoft folder without issuing a write request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      value: [{ id: "folder-1", name: "Betony", webUrl: "https://tenant.sharepoint.com/folder-1", folder: {} }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findMicrosoftFolder({
      accessToken: "secret-token",
      driveId: "drive-1",
      parentId: "parent-1",
      name: "Betony",
    })).resolves.toMatchObject({ id: "folder-1", name: "Betony" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({ method: "POST" });
  });

  it("follows safe Microsoft Graph pagination until the folder is found", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/drives/drive-1/items/parent-1/children?$skiptoken=next",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{ id: "folder-2", name: "Betony", webUrl: "https://tenant.sharepoint.com/folder-2", folder: {} }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findMicrosoftFolder({
      accessToken: "secret-token",
      driveId: "drive-1",
      parentId: "parent-1",
      name: "Betony",
    })).resolves.toMatchObject({ id: "folder-2" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every((call) => call[1]?.method !== "POST")).toBe(true);
  });

  it("rejects a Microsoft pagination link outside Graph", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      value: [],
      "@odata.nextLink": "https://evil.example/steal-token",
    }), { status: 200 })));

    await expect(findMicrosoftFolder({
      accessToken: "secret-token",
      driveId: "drive-1",
      parentId: "parent-1",
      name: "Betony",
    })).rejects.toThrow("Unsafe Graph pagination URL");
  });

  it("stops cyclic Microsoft pagination before unbounded requests", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({
        value: [],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/drives/drive-1/items/parent-1/children?$skiptoken=same",
      }), { status: 200 }),
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findMicrosoftFolder({
      accessToken: "secret-token",
      driveId: "drive-1",
      parentId: "parent-1",
      name: "Betony",
    })).rejects.toThrow("Graph pagination limit exceeded");
    expect(fetchMock).toHaveBeenCalledTimes(100);
  });
});
