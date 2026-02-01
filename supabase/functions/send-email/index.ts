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

    // Build HTML based on template type
    let htmlContent = "";
    let emailSubject = "";
    const userName = data?.name || "uživateli";
    const loginUrl = data?.loginUrl || "https://tenderflow.cz/login";

    if (template === 'registration') {
      emailSubject = "Vítejte v Tender Flow! 🎉";
      htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <tr>
            <td style="padding: 40px;">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 32px;">
                <span style="font-size: 32px; font-weight: bold; color: #f97316;">TF</span>
                <span style="font-size: 20px; color: #ffffff; margin-left: 8px;">Tender Flow</span>
              </div>
              
              <!-- Title -->
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 24px 0;">
                Vítejte v Tender Flow! 🎉
              </h1>
              
              <!-- Content -->
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Dobrý den, ${userName}!
              </p>
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Váš účet byl úspěšně vytvořen. Nyní máte přístup ke všem funkcím pro správu tendrů a projektů.
              </p>
              
              <!-- Features -->
              <div style="background: rgba(249, 115, 22, 0.1); border-radius: 12px; padding: 20px; margin: 24px 0;">
                <p style="color: #f97316; font-weight: 600; margin: 0 0 12px 0;">Co můžete dělat:</p>
                <ul style="color: rgba(255,255,255,0.7); margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">Spravovat projekty a tendry</li>
                  <li style="margin-bottom: 8px;">Sledovat kontakty a dodavatele</li>
                  <li style="margin-bottom: 8px;">Exportovat data do PDF a Excel</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${loginUrl}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                  Přihlásit se do aplikace
                </a>
              </div>
              
              <!-- Note -->
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
                Máte otázky? Neváhejte nás kontaktovat.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer -->
        <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 24px; text-align: center;">
          © ${new Date().getFullYear()} Tender Flow · tenderflow.cz
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
    } else if (template === 'forgotPassword') {
      const resetLink = data?.resetLink || "#";
      emailSubject = "Obnovení hesla – Tender Flow";
      htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <tr>
            <td style="padding: 40px;">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 32px;">
                <span style="font-size: 32px; font-weight: bold; color: #f97316;">TF</span>
                <span style="font-size: 20px; color: #ffffff; margin-left: 8px;">Tender Flow</span>
              </div>
              
              <!-- Title -->
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 24px 0;">
                Obnovení hesla
              </h1>
              
              <!-- Content -->
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Dobrý den,
              </p>
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Obdrželi jsme žádost o obnovu hesla k vašemu účtu v aplikaci Tender Flow.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                  Nastavit nové heslo
                </a>
              </div>
              
              <!-- Note -->
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
                Pokud jste o změnu hesla nežádali, tento email můžete ignorovat.
              </p>
              <p style="color: rgba(255,255,255,0.4); font-size: 12px; line-height: 1.6; margin: 16px 0 0 0; text-align: center;">
                Odkaz je platný 1 hodinu.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer -->
        <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 24px; text-align: center;">
          © ${new Date().getFullYear()} Tender Flow · tenderflow.cz
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown template: ${template}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Send via Resend with HTML
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Martin z Tender Flow <martin@mail.tenderflow.cz>",
        to,
        subject: emailSubject,
        html: htmlContent
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
