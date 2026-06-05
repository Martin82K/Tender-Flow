import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryCall = {
  method: string;
  args: unknown[];
};

class QueryBuilderMock {
  calls: QueryCall[] = [];

  constructor(
    readonly table: string,
    private readonly result: { data?: unknown; error?: unknown } = { data: [], error: null },
  ) {}

  select(...args: unknown[]) {
    this.calls.push({ method: "select", args });
    return this;
  }

  order(...args: unknown[]) {
    this.calls.push({ method: "order", args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: "eq", args });
    return this;
  }

  is(...args: unknown[]) {
    this.calls.push({ method: "is", args });
    return this;
  }

  limit(...args: unknown[]) {
    this.calls.push({ method: "limit", args });
    return this;
  }

  update(...args: unknown[]) {
    this.calls.push({ method: "update", args });
    return this;
  }

  insert(...args: unknown[]) {
    this.calls.push({ method: "insert", args });
    return this;
  }

  upsert(...args: unknown[]) {
    this.calls.push({ method: "upsert", args });
    return this;
  }

  delete(...args: unknown[]) {
    this.calls.push({ method: "delete", args });
    return this;
  }

  single() {
    this.calls.push({ method: "single", args: [] });
    return Promise.resolve(this.result);
  }

  maybeSingle() {
    this.calls.push({ method: "maybeSingle", args: [] });
    return Promise.resolve(this.result);
  }

  then<TResult1 = { data?: unknown; error?: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data?: unknown; error?: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

const supabaseMock = vi.hoisted(() => ({
  builders: [] as QueryBuilderMock[],
  results: [] as Array<{ data?: unknown; error?: unknown }>,
  from: vi.fn((table: string) => {
    const defaultResult =
      table === "templates"
        ? {
            data: [
              {
                id: "tpl-1",
                project_id: "project-a",
                name: "Projektová šablona",
                subject: "Poptávka",
                content: "Text",
                is_default: true,
                updated_at: "2026-06-05T10:00:00.000Z",
              },
            ],
            error: null,
          }
        : { data: [], error: null };
    const builder = new QueryBuilderMock(table, supabaseMock.results.shift() ?? defaultResult);
    supabaseMock.builders.push(builder);
    return builder;
  }),
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: { id: "user-1" } },
      }),
    ),
  },
}));

vi.mock("../services/supabase", () => ({
  supabase: supabaseMock,
}));

import { getTemplateById, getTemplates, saveTemplate } from "../services/templateService";

const callsFor = (builder: QueryBuilderMock, method: string) =>
  builder.calls.filter((call) => call.method === method).map((call) => call.args);

describe("templateService project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.builders.length = 0;
    supabaseMock.results.length = 0;
  });

  it("načítá seznam šablon pouze pro aktuální stavbu", async () => {
    await expect(getTemplates({ projectId: "project-a" })).resolves.toHaveLength(1);

    const templatesQuery = supabaseMock.builders.find((builder) => builder.table === "templates");
    expect(templatesQuery).toBeDefined();
    expect(callsFor(templatesQuery!, "eq")).toContainEqual(["project_id", "project-a"]);
    expect(callsFor(templatesQuery!, "is")).not.toContainEqual(["project_id", null]);
  });

  it("nepoužije šablonu ze stejného uživatele bez shody project_id", async () => {
    await getTemplateById("tpl-1", { projectId: "project-b" });

    const templatesQuery = supabaseMock.builders.find((builder) => builder.table === "templates");
    expect(callsFor(templatesQuery!, "eq")).toContainEqual(["id", "tpl-1"]);
    expect(callsFor(templatesQuery!, "eq")).toContainEqual(["project_id", "project-b"]);
  });

  it("ukládá novou výchozí šablonu do scope stavby a ruší default jen ve stejné stavbě", async () => {
    await saveTemplate(
      {
        id: "temp-1",
        projectId: "project-a",
        name: "Nová šablona",
        subject: "Poptávka",
        content: "Text",
        isDefault: true,
        lastModified: "2026-06-05",
      },
      { projectId: "project-a" },
    );

    const updateQuery = supabaseMock.builders.find((builder) =>
      builder.calls.some((call) => call.method === "update"),
    );
    const insertQuery = supabaseMock.builders.find((builder) =>
      builder.calls.some((call) => call.method === "insert"),
    );

    expect(callsFor(updateQuery!, "eq")).toContainEqual(["project_id", "project-a"]);
    expect(callsFor(updateQuery!, "eq")).toContainEqual(["is_default", true]);
    expect(callsFor(insertQuery!, "insert")[0]?.[0]).toMatchObject({
      project_id: "project-a",
      user_id: "user-1",
    });
  });

  it("při prázdné stavbě nejdřív zkopíruje původní uživatelské šablony", async () => {
    supabaseMock.results.push(
      { data: [], error: null },
      {
        data: [
          {
            name: "MK poptávka standard",
            subject: "Poptávka: {NAZEV_STAVBY}",
            content: "Původní vlastní text",
            is_default: true,
            source_template_id: "default-1",
          },
        ],
        error: null,
      },
      { data: null, error: null },
      {
        data: [
          {
            id: "project-template-1",
            project_id: "project-a",
            name: "MK poptávka standard",
            subject: "Poptávka: {NAZEV_STAVBY}",
            content: "Původní vlastní text",
            is_default: true,
            updated_at: "2026-06-05T10:00:00.000Z",
          },
        ],
        error: null,
      },
    );

    await expect(getTemplates({ projectId: "project-a" })).resolves.toEqual([
      expect.objectContaining({
        id: "project-template-1",
        projectId: "project-a",
        content: "Původní vlastní text",
      }),
    ]);

    const legacyQuery = supabaseMock.builders[1];
    const insertQuery = supabaseMock.builders[2];

    expect(callsFor(legacyQuery, "is")).toContainEqual(["project_id", null]);
    expect(callsFor(legacyQuery, "eq")).toContainEqual(["user_id", "user-1"]);
    expect(callsFor(insertQuery, "insert")[0]?.[0]).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        project_id: "project-a",
        name: "MK poptávka standard",
        content: "Původní vlastní text",
      }),
    ]);
    expect(supabaseMock.builders.some((builder) => builder.table === "default_templates")).toBe(false);
  });

  it("při chybějícím project_id sloupci zobrazí původní šablony místo prázdného seznamu", async () => {
    supabaseMock.results.push(
      {
        data: null,
        error: {
          code: "42703",
          message: "column templates.project_id does not exist",
        },
      },
      {
        data: [
          {
            id: "legacy-template-1",
            name: "Původní šablona",
            subject: "Poptávka",
            content: "Legacy text",
            is_default: true,
            updated_at: "2026-06-05T10:00:00.000Z",
          },
        ],
        error: null,
      },
    );

    await expect(getTemplates({ projectId: "project-a" })).resolves.toEqual([
      expect.objectContaining({
        id: "legacy-template-1",
        content: "Legacy text",
      }),
    ]);

    expect(callsFor(supabaseMock.builders[0], "eq")).toContainEqual(["project_id", "project-a"]);
    expect(callsFor(supabaseMock.builders[1], "order")).toContainEqual(["name"]);
  });

  it("vrátí vestavěné vzorové šablony, když nejsou legacy ani databázové defaulty", async () => {
    supabaseMock.results.push(
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: { message: "insert blocked in test" } },
      { data: [], error: null },
      { data: [], error: null },
    );

    await expect(getTemplates({ projectId: "project-a" })).resolves.toEqual([
      expect.objectContaining({
        id: "builtin-inquiry-standard",
        name: "MK poptávka standard",
        projectId: "project-a",
      }),
      expect.objectContaining({
        id: "builtin-material-inquiry",
        name: "poptávka materiály",
        projectId: "project-a",
      }),
    ]);
  });
});
