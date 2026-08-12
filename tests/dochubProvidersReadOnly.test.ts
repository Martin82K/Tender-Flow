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
});
