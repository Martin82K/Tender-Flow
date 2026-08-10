# Outlook → nabídka → dokument → stav → cena

Stav inventury: 2026-08-09. Zdroj pravdy pro tool policy je
`shared/mcp/toolCatalog.js`, pro handlery `server/mcp/tenderFlowMcp.js` a pro
datové hranice `server/mcp/data.js` spolu s verzovanými Supabase migracemi.

## Praktický tok a současné hranice

| Krok | Autoritativní schopnost | Datová hranice | Stav |
| --- | --- | --- | --- |
| Najít stavbu/VŘ/nabídku | `search`, `tf_list_projects`, `tf_list_tenders`, `tf_list_bids` | user-scoped Supabase klient, RLS; nabídky a kontaktní PII navíc vyžadují contacts grant | hotovo |
| Uložit vazbu odeslané zprávy | `tf_link_outlook_message` | pouze `bidId` a stabilní Outlook identifikátory; privátní tabulka a úzké RPC | hotovo |
| Najít kartu z odpovědi | `tf_match_outlook_reply` | immutable ID, RFC message ID, In-Reply-To nebo conversation ID; bez těla emailu a bez návratu uložených ID | hotovo |
| Přenést přílohu | Outlook + OneDrive/SharePoint konektory, nikoli databáze MCP | binární obsah jde přímo mezi autorizovanými konektory; MCP vazba neukládá obsah, URL ani token | konektorový krok mimo Tender Flow MCP |
| Změnit stav karty | `tf_prepare_bid_status_change` → `tf_confirm_change` → `tf_execute_change`; zpětně kompatibilní je i `tf_prepare_change` s typem `update_bid` | přesný `bidId + status`, RPC dry-run a compare-and-set; MCP role nemá přímý `UPDATE` na `bids` | hotovo |
| Doplnit cenu | zatím pouze ručně v Tender Flow | obecný `update_bid` payload ani přímý DB zápis nejsou povoleny | chybí – kandidát dalšího loopu |

## Bezpečnostní rozhodnutí

- Outlook má při získání ID požádat Microsoft Graph o `ImmutableId`; žádná
  nová emailová entita ani kopie zprávy v Tender Flow nevzniká.
- Nejednoznačný match není souhlas se zápisem. Klient musí nechat uživatele
  zvolit kartu a zobrazit proposal diff před potvrzením.
- OneDrive/SharePoint cesta, download URL, access token ani obsah přílohy se
  nesmí ukládat do Outlook linku nebo MCP auditního payloadu.
- Stavová změna má vysoké riziko, povinný pre-audit, desetiminutový proposal,
  přesný confirmation text použitý v confirm i execute kroku a idempotency key.
- `change_mcp_bid_status` je úzké RPC. Ověřuje aktuální identitu a OAuth
  klienta, aktivní `tenderflow.write`, povolenou hodnotu statusu a write právo
  k projektové pipeline. Přímý table `UPDATE` pro MCP roli zůstává zakázaný.
- Cena zůstává samostatným budoucím krokem, protože potřebuje přesný formát,
  měnu, round/history pravidla a vlastní before/after validaci. Není bezpečné ji
  přimíchat do statusového payloadu.
