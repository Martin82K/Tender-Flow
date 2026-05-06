import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const migrationPath = path.join(
  ROOT,
  "supabase/migrations/20260506192000_user_avatar_upload.sql",
);

describe("user avatar security migration", () => {
  it("ukládá avatary do privátního bucketu bez SVG", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("'user-avatars'");
    expect(migration).toContain("false");
    expect(migration).toContain("2097152");
    expect(migration).toContain("ARRAY['image/png', 'image/jpeg', 'image/webp']");
    expect(migration).not.toContain("image/svg+xml");
  });

  it("omezuje storage operace na vlastní cestu uživatele", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("split_part(name, '/', 1) = 'users'");
    expect(migration).toContain("split_part(name, '/', 2) = auth.uid()::text");
    expect(migration).toContain("split_part(name, '/', 3) ~ '^avatar\\.(png|jpg|jpeg|webp)$'");
  });

  it("povoluje v user_profiles jen avatar_path jako novou self-service položku", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("'avatar_path'");
    expect(migration).toContain("Invalid avatar path");
    expect(migration).toContain("BEFORE INSERT OR UPDATE ON public.user_profiles");
    expect(migration).toContain("Protected profile fields cannot be changed by the profile owner");
  });
});
