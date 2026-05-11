import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserEmailSignatureProfile } from "@/types";

const supabaseMock = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const upsert = vi.fn();
  const from = vi.fn(() => ({ select, upsert }));

  return {
    eq,
    from,
    maybeSingle,
    select,
    upsert,
  };
});

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: supabaseMock.from,
  },
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    from: supabaseMock.from,
  },
}));

import { userProfileService, validateUserAvatarFile } from "@/services/userProfileService";

const TEST_USER_ID = "123e4567-e89b-12d3-a456-426614174000";

const createProfile = (
  overrides: Partial<UserEmailSignatureProfile> = {},
): UserEmailSignatureProfile => ({
  displayName: "Martin",
  signatureName: null,
  signatureRole: null,
  signaturePhone: null,
  signaturePhoneSecondary: null,
  signatureEmail: null,
  signatureGreeting: null,
  avatarPath: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateUserAvatarFile", () => {
  it("povolí PNG, JPEG a WebP do 2 MB", () => {
    expect(validateUserAvatarFile({ type: "image/png", size: 1200 })).toEqual({
      valid: true,
      extension: "png",
    });
    expect(validateUserAvatarFile({ type: "image/jpeg", size: 1200 })).toEqual({
      valid: true,
      extension: "jpg",
    });
    expect(validateUserAvatarFile({ type: "image/webp", size: 1200 })).toEqual({
      valid: true,
      extension: "webp",
    });
  });

  it("odmítne SVG a příliš velký soubor", () => {
    expect(validateUserAvatarFile({ type: "image/svg+xml", size: 1200 })).toMatchObject({
      valid: false,
    });
    expect(validateUserAvatarFile({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toMatchObject({
      valid: false,
    });
  });
});

describe("userProfileService avatar kompatibilita", () => {
  it("neposílá profilový dotaz pro demo ID, které není UUID", async () => {
    await expect(userProfileService.getProfile("demo-user")).resolves.toMatchObject({
      displayName: null,
      avatarPath: null,
    });

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("při chybě schématu avatar_path načte profil bez avataru", async () => {
    supabaseMock.maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42703",
          message: "column user_profiles.avatar_path does not exist",
        },
      })
      .mockResolvedValueOnce({
        data: {
          display_name: "Martin",
          signature_email: "martin@example.com",
        },
        error: null,
      });

    await expect(userProfileService.getProfile(TEST_USER_ID)).resolves.toEqual({
      displayName: "Martin",
      signatureName: null,
      signatureRole: null,
      signaturePhone: null,
      signaturePhoneSecondary: null,
      signatureEmail: "martin@example.com",
      signatureGreeting: null,
      avatarPath: null,
    });

    expect(supabaseMock.select).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("avatar_path"),
    );
    expect(supabaseMock.select).toHaveBeenNthCalledWith(
      2,
      expect.not.stringContaining("avatar_path"),
    );
  });

  it("při ukládání běžného profilu bez migrace zopakuje upsert bez avatar_path", async () => {
    supabaseMock.upsert
      .mockResolvedValueOnce({
        error: {
          message: "Could not find the 'avatar_path' column of 'user_profiles' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null });

    await expect(
      userProfileService.saveProfile(TEST_USER_ID, createProfile()),
    ).resolves.toBeUndefined();

    expect(supabaseMock.upsert).toHaveBeenCalledTimes(2);
    expect(supabaseMock.upsert.mock.calls[0]?.[0]).toHaveProperty("avatar_path", null);
    expect(supabaseMock.upsert.mock.calls[1]?.[0]).not.toHaveProperty("avatar_path");
  });
});
