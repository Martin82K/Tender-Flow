import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backfillMigrationPath = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260216103000_contract_markdown_integrity_backfill.sql",
);

const securityFixMigrationPath = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260224100000_fix_contract_markdown_backlog_view_security.sql",
);

describe("contract markdown backlog view security", () => {
  it("defines backlog view with security_invoker in backfill migration", async () => {
    const sql = await readFile(backfillMigrationPath, "utf8");

    expect(sql).toMatch(
      /CREATE OR REPLACE VIEW\s+contract_markdown_integrity_backlog_v[\s\S]*WITH\s*\(\s*security_invoker\s*=\s*true\s*\)\s*AS/i,
    );
  });

  it("enforces security_invoker in follow-up fix migration", async () => {
    const sql = await readFile(securityFixMigrationPath, "utf8");

    expect(sql).toMatch(
      /ALTER VIEW IF EXISTS\s+public\.contract_markdown_integrity_backlog_v[\s\S]*SET\s*\(\s*security_invoker\s*=\s*true\s*\)/i,
    );
  });
});
