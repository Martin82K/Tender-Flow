import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { encryptJsonAesGcm, tryGetEnv } from "../_shared/crypto.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";

type Mode = "user" | "org";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const projectId = (body?.projectId as string) || "";
    const mode = (body?.mode as Mode) || null;
    const token = body?.token as {
      accessToken?: string;
      refreshToken?: string | null;
      scope?: string | null;
      tokenType?: string;
      expiresIn?: number;
      clientId?: string | null;
    } | null;

    if (!projectId) return json(400, { error: "Missing projectId" });
    if (!mode || !["user", "org"].includes(mode)) {
      return json(400, { error: "Invalid mode" });
    }
    if (!token?.accessToken || !token?.tokenType || !token?.expiresIn) {
      return json(400, { error: "Missing token data" });
    }

    const { data: project, error: projectError } = await authed
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !project) return json(403, { error: "No access to project" });

    const encKey = tryGetEnv("DOCHUB_TOKEN_ENCRYPTION_KEY");
    if (!encKey) return json(500, { error: "Missing DOCHUB_TOKEN_ENCRYPTION_KEY" });

    const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString();
    const tokenCiphertext = await encryptJsonAesGcm(
      {
        access_token: token.accessToken,
        refresh_token: token.refreshToken || null,
        scope: token.scope || null,
        token_type: token.tokenType,
        client_id: token.clientId || null,
        client_type: "desktop",
      },
      encKey
    );

    const service = createServiceClient();
    await service.from("dochub_user_tokens").upsert({
      user_id: userData.user.id,
      provider: "gdrive",
      token_ciphertext: tokenCiphertext,
      scopes: (token.scope || "").split(" ").filter(Boolean),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    await service
      .from("projects")
      .update({
        dochub_enabled: true,
        dochub_provider: "gdrive",
        dochub_mode: mode,
        dochub_status: "connected",
        dochub_last_error: null,
      })
      .eq("id", projectId);

    return json(200, { ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json(500, { error: message });
  }
});
