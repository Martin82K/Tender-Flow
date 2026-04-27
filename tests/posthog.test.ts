import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/types";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  clearCookieConsentDecision,
  setCookieConsentDecision,
} from "@/shared/privacy/cookieConsent";
import type { PosthogConfig } from "@infra/diagnostics/posthog";

const initSpy = vi.fn();
const optInSpy = vi.fn();
const optOutSpy = vi.fn();
const identifySpy = vi.fn();
const resetSpy = vi.fn();
const captureSpy = vi.fn();

const fakePostHog = {
  init: initSpy,
  opt_in_capturing: optInSpy,
  opt_out_capturing: optOutSpy,
  identify: identifySpy,
  reset: resetSpy,
  capture: captureSpy,
};

vi.mock("posthog-js", () => ({
  default: fakePostHog,
}));

const importPosthogModule = async () => {
  return await import("@infra/diagnostics/posthog");
};

const baseConfig: PosthogConfig = {
  enabled: true,
  projectKey: "phc_test_key",
  apiHost: "https://eu.i.posthog.com",
  uiHost: "https://eu.posthog.com",
};

const baseUser: User = {
  id: "user-123",
  name: "Test User",
  email: "user@example.com",
  role: "user",
  subscriptionTier: "pro",
  subscriptionStatus: "active",
  organizationId: "org-7",
  organizationType: "business",
};

describe("posthog telemetry module", () => {
  beforeEach(async () => {
    vi.resetModules();
    initSpy.mockReset();
    optInSpy.mockReset();
    optOutSpy.mockReset();
    identifySpy.mockReset();
    resetSpy.mockReset();
    captureSpy.mockReset();
    window.localStorage.clear();
    clearCookieConsentDecision();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("init does nothing when config.enabled is false", async () => {
    const mod = await importPosthogModule();

    await mod.initPosthog({ ...baseConfig, enabled: false });

    expect(initSpy).not.toHaveBeenCalled();
    mod.identifyPosthog(baseUser);
    mod.capturePosthog("event");
    mod.resetPosthog();
    expect(identifySpy).not.toHaveBeenCalled();
    expect(captureSpy).not.toHaveBeenCalled();
    expect(resetSpy).not.toHaveBeenCalled();
  });

  it("init does nothing when projectKey is empty", async () => {
    const mod = await importPosthogModule();

    await mod.initPosthog({ ...baseConfig, projectKey: "" });

    expect(initSpy).not.toHaveBeenCalled();
  });

  it("init does nothing when projectKey is null", async () => {
    const mod = await importPosthogModule();

    await mod.initPosthog({ ...baseConfig, projectKey: null });

    expect(initSpy).not.toHaveBeenCalled();
  });

  it("init opts out by default and uses provided EU host", async () => {
    const mod = await importPosthogModule();

    await mod.initPosthog(baseConfig);

    expect(initSpy).toHaveBeenCalledTimes(1);
    const [token, options] = initSpy.mock.calls[0];
    expect(token).toBe("phc_test_key");
    expect(options.api_host).toBe("https://eu.i.posthog.com");
    expect(options.ui_host).toBe("https://eu.posthog.com");
    expect(options.opt_out_capturing_by_default).toBe(true);
    expect(options.autocapture).toBe(false);
    expect(options.capture_pageview).toBe(false);
    expect(options.disable_session_recording).toBe(true);
    expect(options.persistence).toBe("localStorage");
  });

  it("init falls back to default hosts when config hosts are blank", async () => {
    const mod = await importPosthogModule();

    await mod.initPosthog({ ...baseConfig, apiHost: "", uiHost: "" });

    const options = initSpy.mock.calls[0][1];
    expect(options.api_host).toBe("https://eu.i.posthog.com");
    expect(options.ui_host).toBe("https://eu.posthog.com");
  });

  it("init is idempotent", async () => {
    const mod = await importPosthogModule();

    await mod.initPosthog(baseConfig);
    await mod.initPosthog(baseConfig);

    expect(initSpy).toHaveBeenCalledTimes(1);
  });

  it("loaded callback opts in when consent already accepted_all", async () => {
    setCookieConsentDecision("accepted_all");
    const mod = await importPosthogModule();

    await mod.initPosthog(baseConfig);
    const options = initSpy.mock.calls[0][1];
    options.loaded(fakePostHog);

    expect(optInSpy).toHaveBeenCalledTimes(1);
  });

  it("loaded callback does NOT opt in when consent is essential_only", async () => {
    setCookieConsentDecision("essential_only");
    const mod = await importPosthogModule();

    await mod.initPosthog(baseConfig);
    const options = initSpy.mock.calls[0][1];
    options.loaded(fakePostHog);

    expect(optInSpy).not.toHaveBeenCalled();
  });

  it("setPosthogConsent('accepted_all') opts in", async () => {
    const mod = await importPosthogModule();
    await mod.initPosthog(baseConfig);

    mod.setPosthogConsent("accepted_all");

    expect(optInSpy).toHaveBeenCalledTimes(1);
    expect(optOutSpy).not.toHaveBeenCalled();
  });

  it("setPosthogConsent('essential_only') opts out", async () => {
    const mod = await importPosthogModule();
    await mod.initPosthog(baseConfig);

    mod.setPosthogConsent("essential_only");

    expect(optOutSpy).toHaveBeenCalledTimes(1);
    expect(optInSpy).not.toHaveBeenCalled();
  });

  it("setPosthogConsent(null) opts out", async () => {
    const mod = await importPosthogModule();
    await mod.initPosthog(baseConfig);

    mod.setPosthogConsent(null);

    expect(optOutSpy).toHaveBeenCalledTimes(1);
  });

  it("identify forwards user id and metadata, not name", async () => {
    const mod = await importPosthogModule();
    await mod.initPosthog(baseConfig);

    mod.identifyPosthog(baseUser);

    expect(identifySpy).toHaveBeenCalledWith("user-123", {
      email: "user@example.com",
      role: "user",
      subscription_tier: "pro",
      subscription_status: "active",
      organization_id: "org-7",
      organization_type: "business",
    });
  });

  it("identify is no-op for demo users", async () => {
    const mod = await importPosthogModule();
    await mod.initPosthog(baseConfig);

    mod.identifyPosthog({ ...baseUser, role: "demo" });

    expect(identifySpy).not.toHaveBeenCalled();
  });

  it("identify is no-op for null user", async () => {
    const mod = await importPosthogModule();
    await mod.initPosthog(baseConfig);

    mod.identifyPosthog(null);

    expect(identifySpy).not.toHaveBeenCalled();
  });

  it("reset calls reset on the client", async () => {
    const mod = await importPosthogModule();
    await mod.initPosthog(baseConfig);

    mod.resetPosthog();

    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it("capture forwards event and properties", async () => {
    const mod = await importPosthogModule();
    await mod.initPosthog(baseConfig);

    mod.capturePosthog("project_created", { project_id: "p1" });

    expect(captureSpy).toHaveBeenCalledWith("project_created", { project_id: "p1" });
  });

  it("setPosthogConsent before init is a no-op", async () => {
    const mod = await importPosthogModule();

    mod.setPosthogConsent("accepted_all");

    expect(optInSpy).not.toHaveBeenCalled();
  });
});

describe("cookieConsent dispatches change event", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCookieConsentDecision();
  });

  it("setCookieConsentDecision dispatches custom event", () => {
    const listener = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);

    setCookieConsentDecision("accepted_all");

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toBe("accepted_all");

    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);
  });

  it("clearCookieConsentDecision dispatches with null", () => {
    setCookieConsentDecision("accepted_all");
    const listener = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);

    clearCookieConsentDecision();

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toBe(null);

    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);
  });
});
