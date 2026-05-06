import { describe, expect, it, vi } from "vitest";

const platformAdapterMock = vi.hoisted(() => ({
  isDesktop: true,
  platform: { os: "darwin" },
}));

vi.mock("@/services/platformAdapter", () => ({
  default: platformAdapterMock,
  isDesktop: true,
  platformAdapter: platformAdapterMock,
}));

import platformAdapter, {
  isDesktop,
  platformAdapter as namedPlatformAdapter,
} from "@infra/platform/platformAdapter";

describe("infra platform adapter", () => {
  it("zachova default i named exporty z legacy platform adapteru", () => {
    expect(isDesktop).toBe(true);
    expect(platformAdapter).toBe(platformAdapterMock);
    expect(namedPlatformAdapter).toBe(platformAdapterMock);
  });
});
