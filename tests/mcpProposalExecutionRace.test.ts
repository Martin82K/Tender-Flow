import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { executeProposal } from "../server/mcp/tenderFlowMcp.js";

type ProposalRow = {
  id: string;
  user_id: string;
  client_id: string;
  status: string;
  expires_at: string;
  confirmation_text: string;
  execute_token_hash: null;
  change_type: "create_task";
  change_payload: {
    type: "create_task";
    title: string;
  };
  execution_result: unknown;
};

const createStatefulSupabase = () => {
  const proposal: ProposalRow = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "user-1",
    client_id: "client-1",
    status: "confirmed",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    confirmation_text:
      "POTVRZUJI MCP ZMĚNU 11111111-1111-4111-8111-111111111111: create_task",
    execute_token_hash: null,
    change_type: "create_task",
    change_payload: { type: "create_task", title: "Race test" },
    execution_result: null,
  };
  const taskRows: Array<Record<string, unknown>> = [];
  const idempotencyRows: Array<Record<string, unknown>> = [];

  const proposalQuery = (operation: "select" | "update", values?: Record<string, unknown>) => {
    const filters = new Map<string, unknown>();
    const api = {
      select: () => api,
      eq: (column: string, value: unknown) => {
        filters.set(column, value);
        return api;
      },
      maybeSingle: async () => {
        const matches = [...filters].every(([column, value]) =>
          proposal[column as keyof ProposalRow] === value
        );
        if (!matches) return { data: null, error: null };
        if (operation === "update" && values) Object.assign(proposal, values);
        return { data: { ...proposal }, error: null };
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        api.maybeSingle().then(resolve, reject),
    };
    return api;
  };

  const supabase = {
    from(table: string) {
      if (table === "mcp_change_proposals") {
        return {
          select: () => proposalQuery("select"),
          update: (values: Record<string, unknown>) => proposalQuery("update", values),
        };
      }
      if (table === "mcp_idempotency_keys") {
        return {
          select: () => {
            const filters = new Map<string, unknown>();
            const api = {
              eq: (column: string, value: unknown) => {
                filters.set(column, value);
                return api;
              },
              maybeSingle: async () => ({
                data: idempotencyRows.find((row) =>
                  [...filters].every(([column, value]) => row[column] === value)
                ) ?? null,
                error: null,
              }),
            };
            return api;
          },
          insert: async (row: Record<string, unknown>) => {
            idempotencyRows.push(row);
            return { data: row, error: null };
          },
        };
      }
      if (table === "tasks") {
        return {
          insert(taskPayload: Record<string, unknown>) {
            return {
              select() { return this; },
              async single() {
                const task = { id: `task-${taskRows.length + 1}`, ...taskPayload };
                taskRows.push(task);
                return { data: task, error: null };
              },
            };
          },
        };
      }
      if (table === "projects") {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() { return { data: { id: "project-1" }, error: null }; },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { proposal, taskRows, idempotencyRows, supabase };
};

describe("MCP proposal execution claim", () => {
  const executeConcurrently = async (idempotencyKeys: [string, string]) => {
    const { proposal, taskRows, supabase } = createStatefulSupabase();
    const auth = { userId: "user-1", clientId: "client-1" };
    const common = {
      proposalId: proposal.id,
      confirmationText: proposal.confirmation_text,
    };

    const outcomes = await Promise.allSettled([
      executeProposal(supabase as never, auth, {
        ...common,
        idempotencyKey: idempotencyKeys[0],
      }),
      executeProposal(supabase as never, auth, {
        ...common,
        idempotencyKey: idempotencyKeys[1],
      }),
    ]);

    expect(taskRows).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);

    return { proposal, taskRows, supabase, auth, common };
  };

  it("creates at most one task for concurrent execution with different keys", async () => {
    await executeConcurrently(["parallel-key-a", "parallel-key-b"]);
  });

  it("creates at most one task for concurrent execution with the same key", async () => {
    await executeConcurrently(["parallel-shared-key", "parallel-shared-key"]);
  });

  it("returns an executed proposal without repeating its side effect", async () => {
    const { proposal, taskRows, supabase, auth, common } = await executeConcurrently([
      "parallel-key-a",
      "parallel-key-b",
    ]);

    const retry = await executeProposal(supabase as never, auth, {
      ...common,
      idempotencyKey: "later-retry-key",
    });

    expect(taskRows).toHaveLength(1);
    expect(retry.data.status).toBe("executed");
    expect(proposal.status).toBe("executed");
  });

  it("allows the executing lifecycle state in the versioned migration", () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const migrationPath = path.join(
      testDirectory,
      "../supabase/migrations/20260813110433_add_mcp_proposal_executing_status.sql",
    );
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("'executing'");
    expect(migration).toContain("mcp_change_proposals_status_check");
    expect(migration).not.toContain("SECURITY DEFINER");
  });
});
