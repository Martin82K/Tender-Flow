import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  getBearerToken,
  isAllowedUpdateBlobPath,
  rewriteLatestYamlForUpdateProxy,
  verifySupabaseAccessToken,
} from "@/api/updates/win/_lib";

const toBase64Url = (value: string): string =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const createToken = (payload: Record<string, unknown>, secret: string): string => {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${header}.${body}.${signature}`;
};

describe("update API helpery", () => {
  it("správně přečte bearer token", () => {
    expect(getBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(getBearerToken(undefined)).toBeNull();
    expect(getBearerToken("Basic aaa")).toBeNull();
  });

  it("ověří HS256 supabase token", () => {
    const secret = "test-secret";
    const token = createToken(
      {
        sub: "user-1",
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      secret
    );
    const payload = verifySupabaseAccessToken(token, secret);
    expect(payload?.sub).toBe("user-1");
  });

  it("odmítne expirovaný token", () => {
    const secret = "test-secret";
    const token = createToken(
      {
        sub: "user-1",
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      secret
    );
    expect(verifySupabaseAccessToken(token, secret)).toBeNull();
  });

  it("povolí jen cesty releases/win", () => {
    expect(isAllowedUpdateBlobPath("releases/win/latest.yml")).toBe(true);
    expect(isAllowedUpdateBlobPath("releases/win/1.0.0/app.exe")).toBe(true);
    expect(isAllowedUpdateBlobPath("../secret.txt")).toBe(false);
    expect(isAllowedUpdateBlobPath("releases/mac/latest.yml")).toBe(false);
  });

  it("přepíše latest.yml na interní stream endpoint", () => {
    const input = `version: 1.2.3
path: Tender-Flow-Setup-1.2.3.exe
files:
  - url: Tender-Flow-Setup-1.2.3.exe
    sha512: abc
`;
    const output = rewriteLatestYamlForUpdateProxy(input);
    expect(output).toContain("path: file?path=releases%2Fwin%2FTender-Flow-Setup-1.2.3.exe");
    expect(output).toContain("url: file?path=releases%2Fwin%2FTender-Flow-Setup-1.2.3.exe");
  });
});
