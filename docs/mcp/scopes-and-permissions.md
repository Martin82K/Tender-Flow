# Scopes a oprávnění

Stav: OAuth/permission matice odpovídá `server/mcp/scopePolicy.js` k 2026-09-01
Zdroj pravdy: `server/mcp/scopePolicy.js` a autoritativní Supabase RLS/RPC

OAuth scope popisuje identitu předanou Supabase Auth. Interní MCP permission
rozhoduje, zda server schopnost vůbec zaregistruje a dovolí volat. RLS/RPC
potom rozhoduje, ke kterým konkrétním organizacím, projektům a řádkům má
uživatel přístup. Žádná z těchto vrstev nenahrazuje ostatní.

| OAuth scope | Význam |
| --- | --- |
| `openid` | ověřená identita; katalog MCP |
| `email`, `profile` | standardní identity claims, nikoli doménový přístup |
| `phone`, `offline_access` | volitelné standardní OAuth schopnosti; samy neudělují přístup k datům Tender Flow |

| Interní permission | Význam | Aktuální remote/stdio stav |
| --- | --- | --- |
| `tenderflow.read` | obecná data projektů, VŘ, smluv, plánů, termínů a vlastní tasky | automaticky pro aktivně consentovaného registrovaného klienta |
| `tenderflow.contacts.read` | kontaktní PII a data nabídek navíc k read | volitelný user+client grant na 30 dní |
| `tenderflow.write` | třífázové business změny a úzká přímá Outlook metadata vazba; vyžaduje také read | volitelný user+client grant do odvolání |
| `tenderflow.bids.offer.write` | finanční zápis celkové ceny nabídky bez DPH v CZK a append-only podmínek; vyžaduje také read + write | samostatný volitelný user+client grant do odvolání |

Trvalý write grant dovoluje klientovi připravovat business změny a přímo uložit
úzkou Outlook metadata vazbu. Business změna nadále vyžaduje krátkodobý návrh,
přesné potvrzení, execute krok, objektovou autorizaci a audit. Outlook vazba
ukládá pouze stabilní identifikátory, nemění cenu ani stav a vyžaduje projektové
právo i audit. Grant je vázaný na konkrétní řádek
OAuth consentu; jeho revokace nebo nová generace consentu starý grant okamžitě
zneplatní.

## Matice nástrojů

| Požadované interní permissions | Nástroje |
| --- | --- |
| read | `search`, `fetch`, `tf_list_projects`, `tf_get_project_summary`, `tf_list_tenders`, `tf_list_contracts`, `tf_get_contract_overview`, `tf_list_tender_plan`, `tf_list_upcoming_deadlines`, `tf_list_tasks` |
| read + contacts | kontaktní větev `search`/`fetch`, `tf_get_project_detail`, `tf_list_bids`, `tf_list_winners`, `tf_list_contacts`, `tf_match_outlook_reply` |
| read + write | `tf_prepare_change`, `tf_confirm_change`, `tf_execute_change`, `tf_link_outlook_message` |
| read + write + bid offer write | `tf_prepare_bid_offer_update`; potvrzení a provedení dále používá společné `tf_confirm_change` a `tf_execute_change` |

Katalog a tool list jsou least-privilege: položka se při chybějící permission
nezaregistruje. Stejná permission se znovu kontroluje při invokaci, takže manipulace
s uloženým katalogem nebo přímé zavolání názvu kontrolu neobejde.

## Doménová autorizace

- seznamy a detaily používají user-scoped Supabase klienta,
- `search`/`fetch` bez contacts permission nikdy nenačítají tabulku kontaktů,
- tasky jsou navíc omezené RLS podmínkou `created_by = auth.uid()`,
- RLS omezuje organizace, projekty a jejich podřízené tabulky,
- smluvní přehled používá `get_contract_overview` RPC a jeho role/project-team
  pravidla,
- `projectId` pro `create_task` se před přípravou i provedením ověřuje jako
  viditelný uživateli,
- Outlook vazba se ukládá jen pro kartu dodavatele, ke které má uživatel
  projektové právo zápisu; vyhledání odpovědi znovu kontroluje read oprávnění
  a vrací jen autorizované kandidáty bez uložených message ID,
- proposal a idempotency data jsou vázána na `auth.uid()` i OAuth `client_id`.

OAuth klient má žádat pouze potřebné standardní identity scopes. Vlastní
`tenderflow.*` hodnota v OAuth tokenu se ignoruje a permission nezíská.
Server při každém MCP požadavku volá autoritativní resolver. Ten váže
`auth.uid()`, přesný JWT `client_id`/`azp`, aktivní registr MCP resource,
nezrušený OAuth consent a neexpirovaný grant. Přímý přístup rolí `anon` a
`authenticated` k grantovým i auditním tabulkám je odebraný; uživatel spravuje
jen vlastní granty přes RPC bez parametru `user_id`. Správcovská RPC navíc
odmítnou JWT s `client_id` nebo `azp`, takže je lze volat pouze z first-party
Tender Flow session, nikoli tokenem consentovaného MCP klienta. Výpadek
resolveru končí fail-closed bez katalogu.
