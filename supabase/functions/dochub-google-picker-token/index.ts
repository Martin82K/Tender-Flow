import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient } from "../_shared/supabase.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";

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

    const { accessToken } = await getAccessTokenForUser({
      userId: userData.user.id,
      provider: "gdrive",
    });

    return json(200, { accessToken });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});

