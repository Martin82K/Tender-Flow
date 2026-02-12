import { describe, expect, it } from "vitest";
import { isSafePublicHttpUrlForExternalShortener } from "../utils/docHub";

describe("isSafePublicHttpUrlForExternalShortener", () => {
  it("allows public https url", () => {
    expect(
      isSafePublicHttpUrlForExternalShortener("https://example.com/path")
    ).toBe(true);
  });

  it("blocks localhost url", () => {
    expect(
      isSafePublicHttpUrlForExternalShortener("http://localhost:3000/admin")
    ).toBe(false);
  });

  it("blocks loopback ipv4", () => {
    expect(
      isSafePublicHttpUrlForExternalShortener("http://127.0.0.1:8080")
    ).toBe(false);
  });

  it("blocks private ipv4", () => {
    expect(
      isSafePublicHttpUrlForExternalShortener("http://192.168.1.42/internal")
    ).toBe(false);
  });

  it("blocks ipv6 loopback", () => {
    expect(
      isSafePublicHttpUrlForExternalShortener("http://[::1]:3000/internal")
    ).toBe(false);
  });

  it("blocks non-http schemes and file paths", () => {
    expect(
      isSafePublicHttpUrlForExternalShortener("file:///Users/test/secret.pdf")
    ).toBe(false);
    expect(isSafePublicHttpUrlForExternalShortener("C:\\Projects\\Docs")).toBe(
      false
    );
    expect(
      isSafePublicHttpUrlForExternalShortener("\\\\server\\share\\docs")
    ).toBe(false);
  });
});
