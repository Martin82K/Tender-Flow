import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectConsoleError, expectConsoleWarn } from "./utils/consoleGuard";

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

  rpc(...args: unknown[]) {
    this.calls.push({ method: "rpc", args });
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
  rpc: vi.fn(() =>
    Promise.resolve({
      data: {
        id: "saved-template-1",
        project_id: "project-a",
        name: "Nová šablona",
        subject: "Poptávka",
        content: "Text",
        is_default: true,
        updated_at: "2026-08-13T10:00:00.000Z",
      },
      error: null,
    }),
  ),
}));

vi.mock("../services/supabase", () => ({
  supabase: supabaseMock,
}));

import {
  getProjectTemplateSelection,
  getTemplateById,
  getTemplates,
  saveProjectTemplateSelection,
  saveTemplate,
} from "../services/templateService";

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
    supabaseMock.results.push({ data: null, error: null });

    await expect(getTemplateById("tpl-1", { projectId: "project-b" })).resolves.toBeUndefined();

    const templatesQuery = supabaseMock.builders[0];
    expect(callsFor(templatesQuery!, "eq")).toContainEqual(["id", "tpl-1"]);
    expect(callsFor(templatesQuery!, "eq")).toContainEqual(["project_id", "project-b"]);
    expect(supabaseMock.builders).toHaveLength(1);
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

    expect(supabaseMock.rpc).toHaveBeenCalledWith("save_scoped_template", {
      p_template_id: null,
      p_project_id: "project-a",
      p_name: "Nová šablona",
      p_subject: "Poptávka",
      p_content: "Text",
      p_is_default: true,
    });
  });

  it("ukládá osobní volbu šablony odděleně podle uživatele, stavby a typu", async () => {
    const templateId = "11111111-1111-4111-8111-111111111111";
    supabaseMock.results.push(
      {
        data: {
          id: templateId,
          project_id: "project-a",
          name: "Projektová šablona",
          subject: "Poptávka",
          content: "Text",
          is_default: true,
        },
        error: null,
      },
      { data: null, error: null },
    );

    await expect(
      saveProjectTemplateSelection("project-a", "inquiry", {
        id: templateId,
        projectId: "project-a",
        name: "Projektová šablona",
        subject: "Poptávka",
        content: "Text",
        isDefault: true,
        lastModified: "2026-08-13",
      }),
    ).resolves.toEqual(expect.objectContaining({ id: templateId }));

    const selectionWrite = supabaseMock.builders.find(
      (builder) => builder.table === "project_template_selections",
    );
    expect(callsFor(selectionWrite!, "upsert")[0]?.[0]).toEqual({
      project_id: "project-a",
      user_id: "user-1",
      template_kind: "inquiry",
      template_id: templateId,
    });
  });

  it("načítá pouze osobní volbu aktuálního uživatele", async () => {
    supabaseMock.results.push({ data: { template_id: "tpl-1" }, error: null });

    await getProjectTemplateSelection("project-a", "materialInquiry");

    const selectionRead = supabaseMock.builders[0];
    expect(selectionRead.table).toBe("project_template_selections");
    expect(callsFor(selectionRead, "eq")).toContainEqual(["project_id", "project-a"]);
    expect(callsFor(selectionRead, "eq")).toContainEqual(["user_id", "user-1"]);
    expect(callsFor(selectionRead, "eq")).toContainEqual(["template_kind", "materialInquiry"]);
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
    expectConsoleWarn("No default templates found in database");
    expectConsoleError("Error copying default templates:");
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
