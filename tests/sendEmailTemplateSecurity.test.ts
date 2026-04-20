import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("send-email template security", () => {
  it("escapuje jméno, sanitizuje URL a nepoužívá hardcoded from adresu", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "supabase/functions/send-email/index.ts"),
      "utf8",
    );

    expect(source).toContain("const escapeHtml = (value: string): string =>");
    expect(source).toContain("return value.replace(/[&<>\"']/g, (char) => htmlEscapes[char]);");
    expect(source).toContain("const sanitizeUrl = (value: unknown, fallback: string): string =>");
    expect(source).toContain("const safeUserName = escapeHtml(String(data?.name || \"uživateli\"));");
    expect(source).toContain("const loginUrl = sanitizeUrl(data?.loginUrl, \"https://tenderflow.cz/login\");");
    expect(source).toContain("const resetLink = sanitizeUrl(data?.resetLink, \"#\");");
    expect(source).toContain("from: from ?? DEFAULT_FROM,");
    expect(source).not.toContain("from: \"Martin z Tender Flow <martin@mail.tenderflow.cz>\",");
  });
});
