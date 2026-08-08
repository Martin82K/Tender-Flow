# Scopes a oprávnění

Stav: scope matice odpovídá `server/mcp/scopePolicy.js` k 2026-08-09
Zdroj pravdy: `server/mcp/scopePolicy.js` a autoritativní Supabase RLS/RPC

Scope rozhoduje, zda klient smí schopnost vůbec vidět a volat. RLS/RPC potom
rozhoduje, ke kterým konkrétním organizacím, projektům a řádkům má uživatel
přístup. Scope nikdy nenahrazuje doménové oprávnění.

| Scope | Význam |
| --- | --- |
| `openid` | ověřená identita; katalog MCP |
| `email`, `profile` | standardní identity claims, nikoli doménový přístup |
| `tenderflow.read` | obecná data projektů, VŘ, smluv, plánů a termínů |
| `tenderflow.contacts.read` | kontaktní PII a data nabídek navíc k read scope |
| `tenderflow.write` | přístup k třífázovým write tools; vyžaduje také read |

## Matice nástrojů

| Požadované scopes | Nástroje |
| --- | --- |
| read | `tf_list_projects`, `tf_list_tenders`, `tf_list_contracts`, `tf_get_contract_overview`, `tf_list_tender_plan`, `tf_list_upcoming_deadlines` |
| read + contacts | `search`, `fetch`, `tf_get_project_detail`, `tf_list_bids`, `tf_list_winners`, `tf_list_contacts` |
| read + write | `tf_prepare_change`, `tf_confirm_change`, `tf_execute_change` |

Katalog a tool list jsou least-privilege: položka se při chybějícím scope
nezaregistruje. Stejný scope se znovu kontroluje při invokaci, takže manipulace
s uloženým katalogem nebo přímé zavolání názvu kontrolu neobejde.

## Doménová autorizace

- seznamy a detaily používají user-scoped Supabase klienta,
- RLS omezuje organizace, projekty a jejich podřízené tabulky,
- smluvní přehled používá `get_contract_overview` RPC a jeho role/project-team
  pravidla,
- `projectId` pro `create_task` se před přípravou i provedením ověřuje jako
  viditelný uživateli,
- proposal a idempotency data jsou vázána na `auth.uid()` i OAuth `client_id`.

OAuth klient má žádat nejmenší sadu. Kontaktní a write scopes se nepřidávají
automaticky běžnému lokálnímu session tokenu.
