import { describe, expect, it } from "vitest";
import {
  buildDocHubPersonalLocationKey,
  createDocHubProjectMarker,
  parseDocHubPersonalLocation,
  parseDocHubProjectMarker,
  normalizeDocHubOnlineUrl,
  resolveEffectiveLocalRoot,
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
      version: 1,
      userId: "user-a",
      projectId: "project-1",
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

  it("validates the project marker before accepting a synchronized folder", () => {
    const marker = createDocHubProjectMarker("project-1", "2026-08-07T12:00:00.000Z");

    expect(parseDocHubProjectMarker(marker, "project-1")?.projectId).toBe("project-1");
    expect(parseDocHubProjectMarker(marker, "project-2")).toBeNull();
    expect(parseDocHubProjectMarker("not-json", "project-1")).toBeNull();
  });

  it("accepts only HTTPS links from supported cloud folder providers", () => {
    expect(normalizeDocHubOnlineUrl("https://drive.google.com/drive/folders/abc")).toContain("drive.google.com");
    expect(normalizeDocHubOnlineUrl("https://tenant.sharepoint.com/shared/folder")).toContain("sharepoint.com");
    expect(normalizeDocHubOnlineUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeDocHubOnlineUrl("https://evil.example/folder")).toBeNull();
  });
});
