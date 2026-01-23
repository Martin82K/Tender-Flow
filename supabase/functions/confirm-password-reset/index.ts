import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { token, password } = await req.json();

        if (!token || !password) {
            return new Response(JSON.stringify({ error: "Token a nové heslo jsou povinné" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (password.length < 6) {
            return new Response(JSON.stringify({ error: "Heslo musí mít alespoň 6 znaků" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
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

        // 2. Lookup token in DB
        const { data: tokenRecord, error: tokenError } = await supabase
            .from("password_reset_tokens")
            .select("*")
            .eq("token_hash", tokenHashHex)
            .single();

        if (tokenError || !tokenRecord) {
            return new Response(JSON.stringify({ error: "Neplatný nebo expirovaný odkaz pro obnovu hesla." }), {
                status: 400, // Bad Request
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 3. Check expiration
        if (new Date(tokenRecord.expires_at) < new Date()) {
            return new Response(JSON.stringify({ error: "Odkaz pro obnovu hesla vypršel." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 4. Update User Password
        const { data: user, error: updateError } = await supabase.auth.admin.updateUserById(
            tokenRecord.user_id,
            { password: password }
        );

        if (updateError) {
            console.error("Error updating user password:", updateError);
            throw new Error("Nepodařilo se nastavit nové heslo.");
        }

        // 5. Delete or invalidate token
        // We delete it to prevent reuse
        await supabase
            .from("password_reset_tokens")
            .delete()
            .eq("id", tokenRecord.id);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error in confirm-password-reset:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
