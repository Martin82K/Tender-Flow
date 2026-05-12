import type { UserEmailSignatureProfile } from "@/types";

import { supabase } from "./supabase";

const USER_AVATAR_BUCKET = "user-avatars";
const USER_AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const USER_AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;
const USER_ID_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_AVATAR_MIME_EXTENSIONS: Record<string, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const USER_PROFILE_BASE_SELECT_COLUMNS = [
  "display_name",
  "signature_name",
  "signature_role",
  "signature_phone",
  "signature_phone_secondary",
  "signature_email",
  "signature_greeting",
] as const;
const USER_PROFILE_SELECT_COLUMNS = [
  ...USER_PROFILE_BASE_SELECT_COLUMNS,
  "avatar_path",
] as const;
const USER_PROFILE_BASE_SELECT = USER_PROFILE_BASE_SELECT_COLUMNS.join(", ");
const USER_PROFILE_SELECT = USER_PROFILE_SELECT_COLUMNS.join(", ");

const mapProfileRow = (data: Record<string, unknown> | null | undefined): UserEmailSignatureProfile => ({
  displayName: typeof data?.display_name === "string" ? data.display_name : null,
  signatureName: typeof data?.signature_name === "string" ? data.signature_name : null,
  signatureRole: typeof data?.signature_role === "string" ? data.signature_role : null,
  signaturePhone: typeof data?.signature_phone === "string" ? data.signature_phone : null,
  signaturePhoneSecondary:
    typeof data?.signature_phone_secondary === "string"
      ? data.signature_phone_secondary
      : null,
  signatureEmail: typeof data?.signature_email === "string" ? data.signature_email : null,
  signatureGreeting:
    typeof data?.signature_greeting === "string" ? data.signature_greeting : null,
  avatarPath: typeof data?.avatar_path === "string" ? data.avatar_path : null,
});

const isMissingAvatarPathColumnError = (error: unknown): boolean => {
  const record = error as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
  };
  const text = [
    record.code,
    record.details,
    record.hint,
    record.message,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return text.includes("avatar_path") && (
    text.includes("42703")
    || text.includes("does not exist")
    || text.includes("schema cache")
  );
};

const removeAvatarPathFromPayload = (
  payload: Record<string, string | null>,
): Record<string, string | null> => {
  const { avatar_path: _avatarPath, ...legacyPayload } = payload;
  return legacyPayload;
};

const normalizeUserProfileId = (userId: string): string | null => {
  const normalizedUserId = userId.trim();
  return USER_ID_UUID_PATTERN.test(normalizedUserId) ? normalizedUserId : null;
};

export const validateUserAvatarFile = (
  file: Pick<File, "size" | "type">,
): { valid: true; extension: "png" | "jpg" | "webp" } | { valid: false; message: string } => {
  const extension = USER_AVATAR_MIME_EXTENSIONS[file.type];
  if (!extension) {
    return {
      valid: false,
      message: "Avatar musí být obrázek PNG, JPEG nebo WebP.",
    };
  }

  if (file.size > USER_AVATAR_MAX_SIZE_BYTES) {
    return {
      valid: false,
      message: "Avatar může mít maximálně 2 MB.",
    };
  }

  return { valid: true, extension };
};

const buildUserAvatarPath = (userId: string, extension: "png" | "jpg" | "webp"): string => {
  const normalizedUserId = normalizeUserProfileId(userId);
  if (!normalizedUserId) {
    throw new Error("Neplatné ID uživatele pro uložení avataru.");
  }

  return `users/${normalizedUserId}/avatar.${extension}`;
};

export const userProfileService = {
  async getProfile(userId: string): Promise<UserEmailSignatureProfile> {
    const normalizedUserId = normalizeUserProfileId(userId);
    if (!normalizedUserId) {
      return mapProfileRow(null);
    }

    const queryProfile = async (selectColumns: string) => supabase
      .from("user_profiles")
      .select(selectColumns)
      .eq("user_id", normalizedUserId)
      .maybeSingle();

    let { data, error } = await queryProfile(USER_PROFILE_SELECT);

    if (error && isMissingAvatarPathColumnError(error)) {
      ({ data, error } = await queryProfile(USER_PROFILE_BASE_SELECT));
    }

    if (error) {
      return mapProfileRow(null);
    }

    return mapProfileRow(data as unknown as Record<string, unknown> | null | undefined);
  },

  async getDisplayName(userId: string): Promise<string | null> {
    const profile = await this.getProfile(userId);
    return profile.displayName && profile.displayName.trim().length > 0
      ? profile.displayName
      : null;
  },

  async saveDisplayName(userId: string, displayName: string | null): Promise<void> {
    const existingProfile = await this.getProfile(userId);
    await this.saveProfile(userId, {
      ...existingProfile,
      displayName,
    });
  },

  async saveProfile(
    userId: string,
    profile: UserEmailSignatureProfile,
  ): Promise<void> {
    const normalizedUserId = normalizeUserProfileId(userId);
    if (!normalizedUserId) {
      throw new Error("Neplatné ID uživatele pro uložení profilu.");
    }

    const payload: Record<string, string | null> = {
      user_id: normalizedUserId,
      display_name: profile.displayName,
      signature_name: profile.signatureName,
      signature_role: profile.signatureRole,
      signature_phone: profile.signaturePhone,
      signature_phone_secondary: profile.signaturePhoneSecondary,
      signature_email: profile.signatureEmail,
      signature_greeting: profile.signatureGreeting,
      updated_at: new Date().toISOString(),
    };

    if ("avatarPath" in profile) {
      payload.avatar_path = profile.avatarPath ?? null;
    }

    const { error } = await supabase.from("user_profiles").upsert(
      payload,
      { onConflict: "user_id" },
    );

    if (error && isMissingAvatarPathColumnError(error) && "avatar_path" in payload) {
      const { error: retryError } = await supabase.from("user_profiles").upsert(
        removeAvatarPathFromPayload(payload),
        { onConflict: "user_id" },
      );

      if (retryError) {
        throw retryError;
      }

      return;
    }

    if (error) {
      throw error;
    }
  },

  async saveAvatarPath(userId: string, avatarPath: string | null): Promise<void> {
    const normalizedUserId = normalizeUserProfileId(userId);
    if (!normalizedUserId) {
      throw new Error("Neplatné ID uživatele pro uložení avataru.");
    }

    const { error } = await supabase.from("user_profiles").upsert(
      {
        user_id: normalizedUserId,
        avatar_path: avatarPath,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      throw error;
    }
  },

  async getAvatarUrl(avatarPath: string | null | undefined): Promise<string | null> {
    if (!avatarPath) return null;

    const { data, error } = await supabase.storage
      .from(USER_AVATAR_BUCKET)
      .createSignedUrl(avatarPath, USER_AVATAR_SIGNED_URL_TTL_SECONDS);

    if (error) {
      return null;
    }

    return data?.signedUrl ?? null;
  },

  async uploadAvatar(
    userId: string,
    file: File,
  ): Promise<{ avatarPath: string; avatarUrl: string | null }> {
    const validation = validateUserAvatarFile(file);
    if (validation.valid === false) {
      throw new Error(validation.message);
    }

    const nextAvatarPath = buildUserAvatarPath(userId, validation.extension);
    const existingProfile = await this.getProfile(userId);
    const { error } = await supabase.storage
      .from(USER_AVATAR_BUCKET)
      .upload(nextAvatarPath, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (error) {
      throw error;
    }

    await this.saveAvatarPath(userId, nextAvatarPath);

    if (existingProfile.avatarPath && existingProfile.avatarPath !== nextAvatarPath) {
      await supabase.storage
        .from(USER_AVATAR_BUCKET)
        .remove([existingProfile.avatarPath])
        .catch(() => undefined);
    }

    return {
      avatarPath: nextAvatarPath,
      avatarUrl: await this.getAvatarUrl(nextAvatarPath),
    };
  },
};
