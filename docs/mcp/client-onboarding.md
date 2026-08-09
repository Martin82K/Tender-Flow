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
   interních oprávnění.
4. Posílat `Authorization: Bearer …`, `MCP-Protocol-Version: 2026-07-28`,
   odpovídající `Mcp-Method`/`Mcp-Name` a klientská metadata v `_meta`.
5. Volitelně zavolat `server/discover`, potom `tools/list` a resource seznamy.
6. Provést read-only canary a ověřit audit.
7. Potřebuje-li klient kontaktní data nebo zápis, uživatel je povolí pro tento
   consentovaný klient v Nastavení → Nástroje → MCP přístupy. Contacts grant
   platí 30 dní, write grant 8 hodin; rozšíření OAuth scope je nenahrazuje.
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
