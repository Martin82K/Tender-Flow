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
  Deno.env.get("DEFAULT_EMAIL_FROM") || "Tender Flow <noreply@tenderflow.cz>";

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
    const { to, subject, data, template }: { 
        to: string | string[], 
        subject?: string, 
        data?: any,
        template?: string
    } = await req.json();

    if (!to || !template) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: to, template",
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

    // Map template name to ID from Env
    let templateId = "";
    if (template === 'registration') {
        templateId = Deno.env.get("RESEND_TEMPLATE_REGISTRATION_WELCOME_ID") || "";
    } else if (template === 'forgotPassword') {
        templateId = Deno.env.get("RESEND_TEMPLATE_FORGOT_PASSWORD_ID") || "";
    }

    if (!templateId) {
         return new Response(
        JSON.stringify({
          error: `Template ID not found for template: ${template}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Send via Resend using Template
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to,
        template_id: templateId,
        data: data || {} // Dynamic data for the template
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", resData);
      return new Response(JSON.stringify(resData), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(resData), {
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
