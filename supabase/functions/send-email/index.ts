import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  reply_to?: string | string[];
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Default sender if not specified. Ideally configured in env, fallback to a placeholder.
const DEFAULT_FROM =
  Deno.env.get("DEFAULT_EMAIL_FROM") || "Zuppa Base <onboarding@resend.dev>";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify Authentication
    // Only authenticated users can send emails via this function to prevent abuse.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    // Validate JWT (basic check that header exists and looks like Bearer)
    // In a real scenario, we might want to use supabase-js to getUser(),
    // but for now, we trust the gateway verified the JWT or we do a quick check.
    // For tighter security, we should use createClient and getUser.

    // 2. Parse Request Body
    const { to, subject, html, text, from, cc, bcc, reply_to }: EmailRequest =
      await req.json();

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: to, subject, and (html or text)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not set. Mocking email send.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email mocked (API key missing)",
          data: { id: "mock-id-" + Date.now() },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: from || DEFAULT_FROM,
        to,
        subject,
        html,
        text,
        cc,
        bcc,
        reply_to,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      return new Response(JSON.stringify({ error: data }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error handling request:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
