
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY is not defined in .env file.");
    process.exit(1);
}

const STYLES = {
  body: `background-color: #0f172a; color: #f8fafc; font-family: 'Inter', sans-serif; padding: 20px; line-height: 1.6;`,
  container: `max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #F97316; box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.06);`,
  header: `background-color: #1e293b; padding: 30px; text-align: center; border-bottom: 1px solid #334155;`,
  content: `padding: 40px 30px;`,
  footer: `background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #334155;`,
  heading: `color: #f8fafc; font-size: 24px; font-weight: 600; margin-bottom: 20px; letter-spacing: -0.025em;`,
  text: `color: #cbd5e1; font-size: 16px; margin-bottom: 24px;`,
  button: `display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; text-align: center; box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);`,
  link: `color: #F97316; text-decoration: underline;`,
  logoTitle: `color: #F97316; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; font-family: sans-serif;`,
};

// Logo URL - hosted on your public domain
const LOGO_URL = "https://tenderflow.cz/email-logo.png";

const LOGO_HTML = `
<div style="text-align: center;">
  <img src="${LOGO_URL}" alt="Tender Flow" width="80" height="80" style="width: 80px; height: 80px; margin-bottom: 8px; border: 0; outline: none; text-decoration: none; display: inline-block;" />
  <div style="${STYLES.logoTitle}">TENDER FLOW</div>
</div>
`;

const templates = [
    {
        name: "Registration Welcome",
        subject: "Vítejte v Tender Flow!",
        html: `
    <!DOCTYPE html>
    <html>
      <body style="${STYLES.body}">
        <div style="${STYLES.container}">
          <div style="${STYLES.header}">
            ${LOGO_HTML}
          </div>
          <div style="${STYLES.content}">
            <h1 style="${STYLES.heading}">Vítejte v Tender Flow!</h1>
            <p style="${STYLES.text}">
              Děkujeme za registraci. Jsme rádi, že jste s námi. Pro dokončení registrace prosím potvrďte svůj email kliknutím na tlačítko níže.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{{verificationLink}}}" style="${STYLES.button}">Potvrdit email</a>
            </div>
            <p style="${STYLES.text}">
              Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:<br>
              <a href="{{{verificationLink}}}" style="${STYLES.link}">{{{verificationLink}}}</a>
            </p>
          </div>
          <div style="${STYLES.footer}">
            &copy; ${new Date().getFullYear()} Tender Flow. Všechna práva vyhrazena.
          </div>
        </div>
      </body>
    </html>
        `
    },
    {
        name: "Forgot Password",
        subject: "Obnovení hesla",
        html: `
    <!DOCTYPE html>
    <html>
      <body style="${STYLES.body}">
        <div style="${STYLES.container}">
          <div style="${STYLES.header}">
            ${LOGO_HTML}
          </div>
          <div style="${STYLES.content}">
            <h1 style="${STYLES.heading}">Zapomenuté heslo?</h1>
            <p style="${STYLES.text}">
              Obdrželi jsme žádost o obnovení hesla pro váš účet. Pokud jste to nebyli vy, můžete tento email ignorovat.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{{resetLink}}}" style="${STYLES.button}">Obnovit heslo</a>
            </div>
            <p style="${STYLES.text}">
              Tento odkaz je platný po omezenou dobu.
            </p>
          </div>
          <div style="${STYLES.footer}">
            &copy; ${new Date().getFullYear()} Tender Flow. Všechna práva vyhrazena.
          </div>
        </div>
      </body>
    </html>
        `
    }
];

async function deploy() {
    console.log("🚀 Deploying templates to Resend...");
    
    for (const tmpl of templates) {
        try {
            console.log(`\nCreating template: ${tmpl.name}...`);
            const res = await fetch('https://api.resend.com/templates', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: tmpl.name,
                    subject: tmpl.subject,
                    html: tmpl.html,
                    variables: [
                        { key: tmpl.name === "Registration Welcome" ? "verificationLink" : "resetLink", type: "string" }
                    ]
                })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                console.error(`❌ Failed to create ${tmpl.name}:`, data);
            } else {
                console.log(`✅ Success! ID: ${data.id}`);
                console.log(`👉 Add this to .env: RESEND_TEMPLATE_${tmpl.name.toUpperCase().replace(/ /g, '_')}_ID=${data.id}`);
            }
        } catch (e) {
            console.error(`❌ Error creating ${tmpl.name}:`, e);
        }
    }
}

deploy();
