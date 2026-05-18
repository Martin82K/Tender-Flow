import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATION = "20260518183000_user_auth_devices.sql";

const readMigration = (): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", MIGRATION), "utf8");

describe("migrace správy zařízení", () => {
  const sql = readMigration();

  it("vytváří tabulku zařízení s RLS pouze pro vlastní záznamy", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.user_auth_devices");
    expect(sql).toContain("ALTER TABLE public.user_auth_devices ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("USING (auth.uid() = user_id)");
    expect(sql).toContain("WITH CHECK (auth.uid() = user_id)");
    expect(sql).toContain("UNIQUE (user_id, installation_id)");
  });

  it("neprezentuje installation_id jako bezpečnostní atestaci zařízení", () => {
    expect(sql).toContain("installation_id je pouze lokalni UX identifikator");
    expect(sql).toContain("nikoliv bezpecnostni atestace zarizeni");
  });

  it("používá SECURITY DEFINER RPC s fixním search_path", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.upsert_current_auth_device");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.list_my_auth_devices");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.revoke_my_auth_device");
    expect(sql.match(/SECURITY DEFINER/g)?.length).toBe(3);
    expect(sql.match(/SET search_path = public/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("revokace ověřuje vlastníka a maže jen jeho auth session", () => {
    expect(sql).toContain("WHERE id = p_device_id");
    expect(sql).toContain("AND user_id = v_user_id");
    expect(sql).toContain("DELETE FROM auth.sessions s");
    expect(sql).toContain("s.id = v_device.auth_session_id");
    expect(sql).toContain("s.user_id = v_user_id");
  });
});
