import { describe, expect, it } from "vitest";
import {
  buildDocHubPersonalLocationKey,
  buildSharePointFolderUrl,
  createDocHubProjectMarker,
  isSharePointSharingUrl,
  isDocHubProjectMarkerForDifferentProject,
  parseDocHubPersonalLocation,
  parseDocHubProjectMarker,
  parseDocHubProjectMarkerValue,
  normalizeDocHubOnlineUrl,
  resolveEffectiveLocalRoot,
  resolveValidatedEffectiveLocalRoot,
  validateDocHubPersonalLocation,
} from "@shared/dochub/personalLocation";

describe("DocHub personal location", () => {
  it("isolates saved locations by user and project", () => {
    expect(buildDocHubPersonalLocationKey("user-a", "project-1")).not.toBe(
      buildDocHubPersonalLocationKey("user-b", "project-1"),
    );
    expect(buildDocHubPersonalLocationKey("user-a", "project-1")).not.toBe(
      buildDocHubPersonalLocationKey("user-a", "project-2"),
    );
  });

  it("rejects a saved location belonging to another user or project", () => {
    const serialized = JSON.stringify({
      version: 2,
      userId: "user-a",
      projectId: "project-1",
      connectionId: "root-generation-1",
      rootPath: "C:\\Projects\\Project-1",
      rootName: "Project-1",
      savedAt: "2026-08-07T12:00:00.000Z",
    });

    expect(parseDocHubPersonalLocation(serialized, "user-a", "project-1")?.rootPath)
      .toBe("C:\\Projects\\Project-1");
    expect(parseDocHubPersonalLocation(serialized, "user-b", "project-1")).toBeNull();
    expect(parseDocHubPersonalLocation(serialized, "user-a", "project-2")).toBeNull();
  });

  it("uses a personal root for shared users and never falls back to the owner's path", () => {
    expect(resolveEffectiveLocalRoot({
      isProjectOwner: false,
      projectRootPath: "C:\\Owner\\Project-1",
      personalRootPath: "D:\\Shared\\Project-1",
    })).toBe("D:\\Shared\\Project-1");

    expect(resolveEffectiveLocalRoot({
      isProjectOwner: false,
      projectRootPath: "C:\\Owner\\Project-1",
      personalRootPath: null,
    })).toBe("");
  });

  it("lets the owner keep the legacy project path until a personal mapping exists", () => {
    expect(resolveEffectiveLocalRoot({
      isProjectOwner: true,
      projectRootPath: "C:\\Owner\\Project-1",
      personalRootPath: null,
    })).toBe("C:\\Owner\\Project-1");
  });

  it("fails closed when a previously stored personal mapping is no longer valid", () => {
    expect(resolveValidatedEffectiveLocalRoot({
      isProjectOwner: true,
      projectRootPath: "C:\\Owner\\Project-1",
      personalRootPath: null,
      hadStoredLocation: true,
    })).toBe("");
  });

  it("validates the project marker before accepting a synchronized folder", () => {
    const marker = createDocHubProjectMarker("project-1", "root-generation-1", "2026-08-07T12:00:00.000Z");

    expect(parseDocHubProjectMarker(marker, "project-1", "root-generation-1")?.projectId).toBe("project-1");
    expect(parseDocHubProjectMarker(marker, "project-1", "root-generation-2")).toBeNull();
    expect(parseDocHubProjectMarker(marker, "project-2", "root-generation-1")).toBeNull();
    expect(parseDocHubProjectMarker("not-json", "project-1", "root-generation-1")).toBeNull();
    expect(parseDocHubProjectMarkerValue(createDocHubProjectMarker("project-2", "root-generation-1"))?.projectId)
      .toBe("project-2");
    expect(isDocHubProjectMarkerForDifferentProject(
      parseDocHubProjectMarkerValue(createDocHubProjectMarker("project-2", "root-generation-1")),
      "project-1",
    )).toBe(true);
  });

  it("rejects a stored personal location when its folder or project marker changed", async () => {
    const location = {
      version: 2 as const,
      userId: "user-a",
      projectId: "project-1",
      rootPath: "D:\\Shared\\Project",
      rootName: "Project",
      savedAt: "2026-08-07T12:00:00.000Z",
      connectionId: "root-generation-1",
    };

    await expect(validateDocHubPersonalLocation(location, "project-1", "root-generation-1", {
      folderExists: async () => true,
      readMarker: async () => createDocHubProjectMarker("project-2", "root-generation-1"),
    })).resolves.toBeNull();
    await expect(validateDocHubPersonalLocation(location, "project-1", "root-generation-1", {
      folderExists: async () => false,
      readMarker: async () => createDocHubProjectMarker("project-1", "root-generation-1"),
    })).resolves.toBeNull();
    await expect(validateDocHubPersonalLocation(location, "project-1", "root-generation-1", {
      folderExists: async () => true,
      readMarker: async () => createDocHubProjectMarker("project-1", "root-generation-2"),
    })).resolves.toBeNull();
    await expect(validateDocHubPersonalLocation(location, "project-1", "root-generation-1", {
      folderExists: async () => true,
      readMarker: async () => createDocHubProjectMarker("project-1", "root-generation-1"),
    })).resolves.toEqual(location);
  });

  it("accepts only HTTPS links from supported cloud folder providers", () => {
    expect(normalizeDocHubOnlineUrl("https://drive.google.com/drive/folders/abc")).toContain("drive.google.com");
    expect(normalizeDocHubOnlineUrl("https://tenant.sharepoint.com/shared/folder")).toContain("sharepoint.com");
    expect(normalizeDocHubOnlineUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeDocHubOnlineUrl("https://evil.example/folder")).toBeNull();
  });

  it("builds a SharePoint child URL from a canonical OneDrive folder route", () => {
    expect(buildSharePointFolderUrl(
      "https://tenant.sharepoint.com/personal/user_tenant_cz/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fuser_tenant_cz%2FDocuments%2FPyrum&ga=1",
      "03_Vyberova_rizeni/Haly/Poptávky/Dodavatel s.r.o.",
    )).toBe(
      "https://tenant.sharepoint.com/personal/user_tenant_cz/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fuser_tenant_cz%2FDocuments%2FPyrum%2F03_Vyberova_rizeni%2FHaly%2FPopt%C3%A1vky%2FDodavatel%20s.r.o.",
    );
  });

  it("rejects sharing routes, traversal and non-SharePoint roots", () => {
    expect(isSharePointSharingUrl(
      "https://tenant.sharepoint.com/:f:/g/personal/user_tenant_cz/opaque-share-token",
    )).toBe(true);
    expect(buildSharePointFolderUrl(
      "https://tenant.sharepoint.com/sites/baustav/Forms/AllItems.aspx?id=%2Fsecret",
      "03_Vyberova_rizeni/Haly",
    )).toBeNull();
    expect(buildSharePointFolderUrl(
      "https://tenant.sharepoint.com/:f:/g/personal/user_tenant_cz/opaque-share-token",
      "03_Vyberova_rizeni/Haly",
    )).toBeNull();
    expect(buildSharePointFolderUrl(
      "https://tenant.sharepoint.com/personal/user/_layouts/15/onedrive.aspx?id=%2FDocuments%2F..%2FSecret",
      "03_Vyberova_rizeni/Haly",
    )).toBeNull();
    expect(buildSharePointFolderUrl(
      "https://tenant.sharepoint.com/personal/user/_layouts/15/onedrive.aspx?id=%2FDocuments%2FPyrum&authkey=secret",
      "03_Vyberova_rizeni/Haly",
    )).toBeNull();
    expect(buildSharePointFolderUrl(
      "https://tenant.sharepoint.com/sites/baustav/Shared%20Documents/Pyrum",
      "03_Vyberova_rizeni/../Secret",
    )).toBeNull();
    expect(buildSharePointFolderUrl(
      "https://drive.google.com/drive/folders/root",
      "03_Vyberova_rizeni/Haly",
    )).toBeNull();
  });
});
