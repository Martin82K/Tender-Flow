import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const extractDesktopPublicKeys = (source: string): string[] => {
  const match = source.match(/const publicKeys = \[([\s\S]*?)\];/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map((item) => item[1]);
};

describe("desktop build env security", () => {
  it("přibaluje pouze veřejné Vite hodnoty, nikdy privátní tokeny ani secrety", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts", "write-desktop-build-env.mjs"),
      "utf-8",
    );
    const publicKeys = extractDesktopPublicKeys(source);

    expect(publicKeys).toEqual([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP",
    ]);
    expect(publicKeys.every((key) => key.startsWith("VITE_"))).toBe(true);
    expect(publicKeys.some((key) => /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)/i.test(key))).toBe(false);
    expect(source).toContain("forbiddenPublicKeyPattern");
  });
});
