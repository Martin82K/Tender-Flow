import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: buildCorsHeaders(req) });
    }

    try {
        const payload = await req.json();
        const token = typeof payload?.token === "string" ? payload.token.trim() : "";
        const password = typeof payload?.password === "string" ? payload.password : "";

        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token) || !password) {
            return new Response(JSON.stringify({ error: "Token a nové heslo jsou povinné" }), {
                status: 400,
                headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
            });
        }

        if (password.length < 6 || password.length > 128) {
            return new Response(JSON.stringify({ error: "Heslo musí mít 6 až 128 znaků" }), {
                status: 400,
                headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
            });
        }

        // 1. Hash received token to find it in DB
        const tokenHash = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(token)
        );
        const tokenHashHex = Array.from(new Uint8Array(tokenHash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        // 2. Atomically claim the token before changing the password.
        const { data: tokenRecord, error: tokenError } = await supabase
            .from("password_reset_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("token_hash", tokenHashHex)
            .is("used_at", null)
            .gt("expires_at", new Date().toISOString())
            .select("*")
            .single();

        if (tokenError || !tokenRecord) {
            return new Response(JSON.stringify({ error: "Neplatný nebo expirovaný odkaz pro obnovu hesla." }), {
                status: 400, // Bad Request
                headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
            });
        }

        // 3. Update User Password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            tokenRecord.user_id,
            { password: password }
        );

        if (updateError) {
            console.error("Error updating user password:", updateError);
            throw new Error("Nepodařilo se nastavit nové heslo.");
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error in confirm-password-reset");
        return new Response(JSON.stringify({ error: "Interní chyba serveru" }), {
            status: 500,
            headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
    }
});
