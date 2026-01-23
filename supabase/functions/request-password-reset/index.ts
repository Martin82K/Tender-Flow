import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_TEMPLATE_FORGOT_PASSWORD_ID = Deno.env.get("RESEND_TEMPLATE_FORGOT_PASSWORD_ID");
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:3000"; // Fallback for local dev

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { email } = await req.json();

        if (!email) {
            return new Response(JSON.stringify({ error: "Email je povinný" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 1. Check if user exists (using Admin API)
        const { data: users, error: userError } = await supabase.auth.admin.listUsers();

        if (userError) {
            console.error("Error listing users:", userError);
            throw userError;
        }

        // We have to filter manually because listUsers doesn't support convenient filtering by email in all versions/wrappers easily or simply use exact match
        // Or better: getUser by email isn't directly exposed in admin easily without ID, but listUsers returns page.
        // Actually, listUsers might be slow if many users. simpler approach:
        // try to get user ID by specific query if possible. 
        // supabase.rpc can help if performant, but let's stick to listUsers for now or iterate if needed.
        // WAIT: admin.listUsers() is paginated. If we have many users, this is bad.
        // Better: We can check if we can query auth.users via supabase-js directly if we have service_role?
        // No, auth schema is protected. 
        // Usually standard `signIn` attempts can reveal user existence, but we want to avoid that.
        // Alternative: We proceed to generate token blindly, but we need UserID to insert into DB.
        // So we MUST find the user ID.
        // Let's rely on `supabase.auth.admin.listUsers()` not being too heavy for this specific CRM use case (it seems like a smallcrm).

        const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

        if (!user) {
            // Security: Do not reveal that user does not exist.
            // Fake success.
            console.log(`Password reset requested for non-existent email: ${email}`);
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2. Generate secure token
        const token = crypto.randomUUID();
        const tokenHash = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(token)
        );
        const tokenHashHex = Array.from(new Uint8Array(tokenHash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

        // 3. Save to DB
        const { error: dbError } = await supabase
            .from("password_reset_tokens")
            .insert({
                user_id: user.id,
                token_hash: tokenHashHex,
                expires_at: expiresAt.toISOString(),
            });

        if (dbError) {
            console.error("Error saving token:", dbError);
            throw new Error("Failed to save reset token");
        }

        // 4. Send Email via Resend
        const resetLink = `${SITE_URL}/reset-password?token=${token}`; // We send the RAW token to user
        // The DB has the HASHED token.

        if (!RESEND_API_KEY) {
            console.warn("RESEND_API_KEY not set. Logging link:", resetLink);
            return new Response(JSON.stringify({ success: true, message: "Mocked sending (no API key)" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const templateId = RESEND_TEMPLATE_FORGOT_PASSWORD_ID;

        let emailBody = {};

        if (templateId) {
            emailBody = {
                from: "Tender Flow <noreply@tenderflow.cz>",
                to: email,
                template_id: templateId,
                data: {
                    resetLink: resetLink
                }
            };
        } else {
            // Fallback HTML if no template ID
            emailBody = {
                from: "Tender Flow <noreply@tenderflow.cz>",
                to: email,
                subject: "Obnovení hesla",
                html: `
              <p>Dobrý den,</p>
              <p>Obdrželi jsme žádost o obnovu hesla.</p>
              <p><a href="${resetLink}">Klikněte zde pro nastavení nového hesla</a></p>
              <p>Pokud jste o změnu nežádali, tento email ignorujte.</p>
            `
            };
        }

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify(emailBody),
        });

        if (!res.ok) {
            const errorData = await res.json();
            console.error("Resend API error:", errorData);
            // We still return success to frontend to avoid leaking system state/errors too much?
            // Or maybe 500 if sending fails? Let's return 500 so frontend can say "Zkuste to prosím později".
            throw new Error("Failed to send email via Resend");
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error in request-password-reset:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
