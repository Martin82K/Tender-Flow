import { describe, expect, it } from "vitest";
import { mapVisibleProjects } from "@features/projects/model/projectVisibility";

const projectRows = [
  {
    id: "owner-project",
    name: "Vlastní projekt",
    location: "Praha",
    status: "tender",
    archived_original_status: null,
    is_demo: false,
    owner_id: "user-1",
  },
  {
    id: "shared-project",
    name: "Sdílený projekt",
    location: null,
    status: "realization",
    archived_original_status: "tender",
    is_demo: false,
    owner_id: "user-2",
  },
  {
    id: "foreign-project",
    name: "Cizí projekt",
    location: "Brno",
    status: "archived",
    archived_original_status: "realization",
    is_demo: false,
    owner_id: "user-3",
  },
  {
    id: "demo-project",
    name: "Demo projekt",
    location: "",
    status: null,
    archived_original_status: null,
    is_demo: true,
    owner_id: null,
  },
] as const;

const metadataRows = [
  {
    project_id: "owner-project",
    owner_email: "owner@example.com",
    shared_with_emails: [],
  },
  {
    project_id: "shared-project",
    owner_email: "other@example.com",
    shared_with_emails: ["  USER@Example.COM  "],
  },
  {
    project_id: "foreign-project",
    owner_email: "foreign@example.com",
    shared_with_emails: ["someone-else@example.com"],
  },
] as const;

describe("project visibility mapping", () => {
  it("returns owner, normalized explicit share, and demo while rejecting foreign projects", () => {
    const projects = mapVisibleProjects(projectRows, metadataRows, {
      userId: "user-1",
      userEmail: " user@example.com ",
    });

    expect(projects.map((project) => project.id)).toEqual([
      "owner-project",
      "shared-project",
      "demo-project",
    ]);
  });

  it("preserves mapped project fields and established defaults", () => {
    const projects = mapVisibleProjects(projectRows, metadataRows, {
      userId: "user-1",
      userEmail: "user@example.com",
    });

    expect(projects).toEqual([
      {
        id: "owner-project",
        name: "Vlastní projekt",
        location: "Praha",
        status: "tender",
        archivedOriginalStatus: null,
        isDemo: false,
        ownerId: "user-1",
        ownerEmail: "owner@example.com",
        sharedWith: [],
      },
      {
        id: "shared-project",
        name: "Sdílený projekt",
        location: "",
        status: "realization",
        archivedOriginalStatus: "tender",
        isDemo: false,
        ownerId: "user-2",
        ownerEmail: "other@example.com",
        sharedWith: ["  USER@Example.COM  "],
      },
      {
        id: "demo-project",
        name: "Demo projekt",
        location: "",
        status: "realization",
        archivedOriginalStatus: null,
        isDemo: true,
        ownerId: null,
        ownerEmail: undefined,
        sharedWith: undefined,
      },
    ]);
  });

  it("fails closed for empty identity and incomplete metadata", () => {
    const rowsWithMissingOwner = [
      {
        id: "missing-owner",
        name: "Bez vlastníka",
        location: "",
        status: "tender",
        archived_original_status: null,
        is_demo: false,
        owner_id: null,
      },
    ];

    expect(
      mapVisibleProjects(rowsWithMissingOwner, [], {
        userId: "",
        userEmail: "",
      }),
    ).toEqual([]);
    expect(
      mapVisibleProjects(projectRows, [], {
        userId: "unrelated-user",
        userEmail: "user@example.com",
      }).map((project) => project.id),
    ).toEqual(["demo-project"]);
  });

  it("does not mutate database rows or metadata arrays", () => {
    const rows = projectRows.map((row) => ({ ...row }));
    const metadata = metadataRows.map((row) => ({
      ...row,
      shared_with_emails: [...row.shared_with_emails],
    }));
    const rowsSnapshot = structuredClone(rows);
    const metadataSnapshot = structuredClone(metadata);

    mapVisibleProjects(rows, metadata, {
      userId: "user-1",
      userEmail: "user@example.com",
    });

    expect(rows).toEqual(rowsSnapshot);
    expect(metadata).toEqual(metadataSnapshot);
  });
});
