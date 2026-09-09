# Připojení MCP klienta

Stav: technický onboarding; konkrétní produkční klient musí projít canary
Zdroj pravdy: OAuth konfigurace a `server/mcp/response.js`

## Předpoklady

- registrovaný a schválený OAuth klient,
- přesná redirect URI a client metadata,
- client ID v produkčním `MCP_ALLOWED_CLIENT_IDS`,
- MCP endpoint `https://www.tenderflow.cz/api/mcp`,
- standardní OAuth identity scopes `openid email profile`.

## Doporučený postup

1. Načíst protected-resource metadata z `/api/mcp-resource` nebo z odkazu ve
   `WWW-Authenticate` odpovědi 401.
2. Provést OAuth authorization code flow s resource indikátorem MCP endpointu.
3. Zobrazit uživateli Tender Flow consent oddělující identity scopes od
   interních oprávnění. Uživatel může samostatně zaškrtnout kontaktní údaje,
   zápisové operace a finanční zápis. Obecný zápis je předvolený a uživatel
   jej může před schválením vypnout; kontakty a finanční zápis jsou volitelné.
   Finanční zápis vyžaduje také obecný zápis. Aplikace nejprve dokončí OAuth
   souhlas a pak udělí vybrané granty přes first-party RPC. Do AI se vrátí až
   po jejich úspěšném uložení. Při chybě lze uložení opakovat bez druhého
   schvalování již spotřebované OAuth žádosti; callback zůstává jen v paměti.
4. Posílat `Authorization: Bearer …`, `MCP-Protocol-Version: 2026-07-28`,
   odpovídající `Mcp-Method`/`Mcp-Name` a klientská metadata v `_meta`.
5. Volitelně zavolat `server/discover`, potom `tools/list` a resource seznamy.
6. Provést read-only canary a ověřit audit.
7. Potřebuje-li již připojený klient kontaktní data nebo zápis, uživatel je povolí pro tento
   consentovaný klient v Nastavení → Nástroje → MCP přístupy. Contacts grant
   platí 180 dní, write grant do odvolání; rozšíření OAuth scope je nenahrazuje.
8. Po změně registrace nebo databázové role provést nový OAuth flow. Starší
   token bez `role=tenderflow_mcp_client` server záměrně odmítne.

Konfigurační příklad bez secretu:

```json
{
  "mcpServers": {
    "tender-flow": {
      "type": "http",
      "url": "https://www.tenderflow.cz/api/mcp"
    }
  }
}
```

## Grok Bot / Cursor Agents

Produkční Grok Bot konektor používá ručně registrovaného veřejného OAuth
klienta `Tender Flow CZ – Grok Bot` se dvěma přesnými redirect URI:

- desktopový Grok Bot: `http://localhost:8787/callback`,
- webový Cursor Agents: `https://www.cursor.com/agents/mcp/oauth/callback`.

Klient nemá client secret, používá authorization code flow s PKCE S256 a musí
být explicitně přítomný v `mcp_oauth_client_resources` i v serverovém
`MCP_ALLOWED_CLIENT_IDS`. Loopback callback je pevný na port 8787; wildcard ani
jiný localhost port není registrovaný.

Dynamic Client Registration zůstává vypnutá. Konektor se přidává jako privátní
remote HTTP MCP server s URL `https://www.tenderflow.cz/api/mcp`; po změně
registrace je nutné dokončit nový OAuth flow. Contacts a write granty se
nepovolují automaticky a uživatel je případně udělí samostatně v Tender Flow.

## Akceptační checklist klienta

- ověřuje issuer a resource/audience,
- nesdílí private resource cache mezi uživateli,
- reaguje na OAuth challenge a nepodvrhuje vlastní `tenderflow.*` scopes,
- neukládá Bearer ani execute token do logů,
- nikdy neočekává ani nepřijímá `SUPABASE_MCP_SECRET_KEY`; tento secret patří
  pouze Tender Flow MCP backendu,
- při aktivním write grantu zobrazuje diff, riziko a potvrzení uživateli,
- zvládá 401, 403/tool absence, 429, schema error a expiraci,
- po odebrání oprávnění zahodí cache a znovu autorizuje.

Produkční údaje o klientovi a secrets se necommitují do tohoto repozitáře.

## AI nabízí jen čtení

Zavolejte `tf_get_access_status`. Vraťte uživateli odkaz na nastavení a přesný
`clientId`, aby zapnul přepínač Zápisové operace u správného připojení. Pro práci s nabídkami
potřebuje také kontaktní grant; pro cenu navíc samostatný finanční grant.
Po udělení grantů u vzdáleného HTTP připojení obnovte `tools/list`, případně použijte
aktualizaci nástrojů v klientovi. Lokální stdio MCP načítá oprávnění při startu:
nejprve restartujte jeho proces a potom obnovte katalog. Kvůli aktualizaci katalogu
neodvolávejte OAuth souhlas. Při nové autorizaci je třeba znovu zvolit také kontaktní
a finanční oprávnění; granty předchozí generace souhlasu se nepřenášejí.
Pokud má klient stále původní katalog bez diagnostiky, otevřete Nastavení →
Nástroje → MCP přístupy přímo v Tender Flow. Udělení grantu nikdy nepřekračuje
uživatelova projektová ani organizační práva.

## Obnova přihlášení při připojování z webu a desktopového AI klienta

Při otevření `/oauth/consent` se nejprve dokončí obnova relace Tender Flow.
Teprve potom aplikace zobrazí souhlas nebo přihlášení s původním `next`.
Přihlášený uživatel na `/login?next=...` s cílem `/oauth/consent` automaticky
pokračuje k téže autorizační žádosti bez ručního refresh. Externí `next` se
v této návratové cestě nepoužije. Platí také pro prohlížeč otevřený z ChatGPT
nebo Codex desktopu. Callback AI klienta se nemění.

Nový nebo výslovně obnovený kontaktní grant platí 180 dní. Již udělené granty
si ponechají uloženou expiraci; migrace je automaticky neprodlužuje. Zápis
a samostatný finanční grant dále platí do odvolání. Odpojeného klienta je
nutné znovu autorizovat a zvolit požadovaná oprávnění.
