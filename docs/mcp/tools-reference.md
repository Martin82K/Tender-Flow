# Reference MCP tools

Stav: 17 nástrojů v policy katalogu; 10 obecných read-only nástrojů dostupných
bez zvýšeného grantu, dalších 7 podmíněných user+client grantem k 2026-08-09
Zdroj pravdy: `server/mcp/tenderFlowMcp.js`, `server/mcp/scopePolicy.js`,
`server/mcp/data.js`

Všechny výsledky jsou JSON v `structuredContent` a současně textový JSON pro
klienty bez strukturovaného zpracování. Doménové tools vracejí obálku
`{ "ok": boolean, "data"?: unknown, "error"?: string }`; `search` vrací
`{ "results": [...] }`. Chyba toolu nastaví `isError` a je auditována.
Každý tool nejprve atomicky spotřebuje sdílený user/client/risk bucket. Write
fáze se nespustí bez úspěšného redigovaného `*_attempt` auditu; po dokončení se
zapíše samostatný outcome.

Označení „vyžaduje grant“ níže znamená, že implementace existuje, ale server ji
zaregistruje pouze s aktuálním autoritativním user+client grantem. OAuth token
tuto permission nemůže sám získat vlastním scope.

Každý zaregistrovaný tool publikuje OAuth2 deklaraci s minimálním standardním
scope `openid`. MCP 2.0 server ji na wire přenáší v
`_meta.securitySchemes`, což je kompatibilní umístění čtené ChatGPT. Jde pouze
o popis autentizace pro klienta, nikoli o autorizační rozhodnutí. Dostupný
katalog se stále sestavuje podle aktuálních interních user+client permissions
a stejné permissions se znovu kontrolují při invokaci.

## Discovery a načtení výsledku

### `search`

- Permissions: read; riziko: low; pouze čtení; dostupný.
- Vstup: `query` — 1 až 500 znaků.
- Použití: první krok pro connector/deep-research discovery nad projekty, VŘ a
  vlastními tasky. Kontakty přidá jen aktivní 30denní contacts grant.
- Výstup: pole výsledků `id`, `title`, `url`, volitelná `metadata`.

### `fetch`

- Permissions: read; riziko: low; pouze čtení; dostupný.
- Vstup: `id` ze `search`, nejvýše 200 znaků.
- Podporované identifikátory: `project:<id>`,
  `tender:<projectId>:<tenderId>`, `task:<id>` a při contacts grantu
  `contact:<id>`.
- Výstup: citation-friendly JSON text a interní aplikační URL; neznámý typ
  vrátí `ok: false`.

## Projekty a výběrová řízení

| Tool | Permissions / dostupnost | Vstup | Výsledek a limity |
| --- | --- | --- | --- |
| `tf_list_projects` | read / dostupný | `search?`, `limit?` | viditelné projekty; server limituje počet na 20 |
| `tf_get_project_summary` | read / dostupný | `projectId` | PII-minimalizovaný projekt, VŘ, agregované bid statistiky, smlouvy a plán; explicitní limity a truncation příznaky |
| `tf_get_project_detail` | read + contacts / vyžaduje grant | `projectId` | projekt, VŘ, nabídky, smlouvy a plán; RLS-scoped |
| `tf_list_tenders` | read / dostupný | `projectId?`, `limit?` | VŘ/demand categories; limit max. 20 |
| `tf_list_bids` | read + contacts / vyžaduje grant | `projectId?`, `categoryId?`, `winnersOnly?`, `limit?` | nabídky včetně dodavatele; limit max. 100; vazba přes `demand_category_id` |
| `tf_list_winners` | read + contacts / vyžaduje grant | `projectId?`, `categoryId?`, `limit?` | pouze vítězné/zasmluvněné nabídky |
| `tf_list_tender_plan` | read / dostupný | `projectId?`, `limit?` | harmonogram/plán VŘ; limit max. 100 |
| `tf_list_upcoming_deadlines` | read / dostupný | `rangeDays?` | budoucí termíny; rozsah je normalizován na 1–365 dní |

## Kontakty a smlouvy

| Tool | Permissions / dostupnost | Vstup | Výsledek a ochrana |
| --- | --- | --- | --- |
| `tf_list_contacts` | read + contacts / vyžaduje grant | `search?`, `limit?` | dodavatelé a kontaktní PII; limit max. 20 |
| `tf_list_contracts` | read / dostupný | `projectId?`, `limit?` | smlouvy viditelné uživateli; limit max. 20 |
| `tf_get_contract_overview` | read / dostupný | `organizationId?` UUID, `includeArchived?` | autorizovaný RPC přehled; bez raw storage path/URL; neplatná měna se mapuje na CZK |

## Osobní tasky

### `tf_list_tasks`

- Permissions: read; riziko: low; pouze čtení; dostupný.
- Vstup: `search?`, `projectId?`, `completed?`, `includeArchived?`, `limit?` 1–100.
- Výstup: tasky vlastněné přihlášeným uživatelem podle RLS. Obsahuje pracovní
  název, poznámku, termíny, prioritu a vazbu na projekt/entitu; neobsahuje
  `created_by`, externí provider URL, sync stav ani raw sync chybu.
- Bez `includeArchived: true` jsou archivované tasky vyloučené.

## Bezpečný zápis

### `tf_prepare_change`

- Permissions: read + write; riziko medium; **vyžaduje osmihodinový grant**.
- Vstup: `change` a volitelný `reason` do 1000 znaků.
- Pro `create_task`: `title` 1–500, `note?` max. 10 000, `dueAt?`,
  `priority?` 1–4, `projectId?`.
- Výstup: proposal ID, riziko, diff, expirace a přesný potvrzovací text.
- Nemění doménová data.

### `tf_confirm_change`

- Permissions: read + write; riziko high; **vyžaduje osmihodinový grant**.
- Vstup: UUID `proposalId` a přesný `confirmationText`.
- Ověří vlastníka, OAuth klienta, stav a desetiminutovou expiraci.
- Výstup: krátkodobý jednorázový `executeToken`; token se nesmí logovat.

### `tf_execute_change`

- Permissions: read + write; riziko high; destruktivní hint, idempotentní chování; **vyžaduje osmihodinový grant**.
- Vstup: `proposalId`, `executeToken` a `idempotencyKey` 8–200 znaků.
- Pouze `create_task` je implementovaný execution typ.
- Opakování stejného user/client/idempotency klíče vrací uložený výsledek.

Typy `create_bid`, `update_bid`, `create_contact`, `update_contact`,
`create_note`, `update_note` a `archive_entity` lze připravit pouze jako
neproveditelný návrh. MCP je nesmí prezentovat jako dokončenou změnu.
