# Reference MCP tools

Stav: 15 registrovaných nástrojů k 2026-08-09
Zdroj pravdy: `server/mcp/tenderFlowMcp.js`, `server/mcp/scopePolicy.js`,
`server/mcp/data.js`

Všechny výsledky jsou JSON v `structuredContent` a současně textový JSON pro
klienty bez strukturovaného zpracování. Doménové tools vracejí obálku
`{ "ok": boolean, "data"?: unknown, "error"?: string }`; `search` vrací
`{ "results": [...] }`. Chyba toolu nastaví `isError` a je auditována.

## Discovery a načtení výsledku

### `search`

- Scopes: read + contacts; riziko: low; pouze čtení.
- Vstup: `query` — 1 až 500 znaků.
- Použití: první krok pro connector/deep-research discovery nad projekty, VŘ,
  kontakty a smluvními záznamy.
- Výstup: pole výsledků `id`, `title`, `url`, volitelná `metadata`.

### `fetch`

- Scopes: read + contacts; riziko: low; pouze čtení.
- Vstup: `id` ze `search`, nejvýše 200 znaků.
- Podporované identifikátory: `project:<id>`,
  `tender:<projectId>:<tenderId>` a `contact:<id>`.
- Výstup: citation-friendly JSON text a interní aplikační URL; neznámý typ
  vrátí `ok: false`.

## Projekty a výběrová řízení

| Tool | Scopes | Vstup | Výsledek a limity |
| --- | --- | --- | --- |
| `tf_list_projects` | read | `search?`, `limit?` | viditelné projekty; server limituje počet na 20 |
| `tf_get_project_detail` | read + contacts | `projectId` | projekt, VŘ, nabídky, smlouvy a plán; RLS-scoped |
| `tf_list_tenders` | read | `projectId?`, `limit?` | VŘ/demand categories; limit max. 20 |
| `tf_list_bids` | read + contacts | `projectId?`, `categoryId?`, `winnersOnly?`, `limit?` | nabídky včetně dodavatele; limit max. 20 |
| `tf_list_winners` | read + contacts | `projectId?`, `categoryId?`, `limit?` | pouze vítězné/zasmluvněné nabídky |
| `tf_list_tender_plan` | read | `projectId?`, `limit?` | harmonogram/plán VŘ; limit max. 20 |
| `tf_list_upcoming_deadlines` | read | `rangeDays?` | budoucí termíny; rozsah je normalizován na 1–365 dní |

## Kontakty a smlouvy

| Tool | Scopes | Vstup | Výsledek a ochrana |
| --- | --- | --- | --- |
| `tf_list_contacts` | read + contacts | `search?`, `limit?` | dodavatelé a kontaktní PII; limit max. 20 |
| `tf_list_contracts` | read | `projectId?`, `limit?` | smlouvy viditelné uživateli; limit max. 20 |
| `tf_get_contract_overview` | read | `organizationId?` UUID, `includeArchived?` | autorizovaný RPC přehled; bez raw storage path/URL; neplatná měna se mapuje na CZK |

## Bezpečný zápis

### `tf_prepare_change`

- Scopes: read + write; riziko medium.
- Vstup: `change` a volitelný `reason` do 1000 znaků.
- Pro `create_task`: `title` 1–500, `note?` max. 10 000, `dueAt?`,
  `priority?` 1–4, `projectId?`.
- Výstup: proposal ID, riziko, diff, expirace a přesný potvrzovací text.
- Nemění doménová data.

### `tf_confirm_change`

- Scopes: read + write; riziko high.
- Vstup: UUID `proposalId` a přesný `confirmationText`.
- Ověří vlastníka, OAuth klienta, stav a desetiminutovou expiraci.
- Výstup: krátkodobý jednorázový `executeToken`; token se nesmí logovat.

### `tf_execute_change`

- Scopes: read + write; riziko high; destruktivní hint, idempotentní chování.
- Vstup: `proposalId`, `executeToken` a `idempotencyKey` 8–200 znaků.
- Pouze `create_task` je implementovaný execution typ.
- Opakování stejného user/client/idempotency klíče vrací uložený výsledek.

Typy `create_bid`, `update_bid`, `create_contact`, `update_contact`,
`create_note`, `update_note` a `archive_entity` lze připravit pouze jako
neproveditelný návrh. MCP je nesmí prezentovat jako dokončenou změnu.
