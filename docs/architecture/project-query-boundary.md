# Načítání a viditelnost projektů

Stav: implementováno a lokálně ověřeno, 11. července 2026

## Kontext a cíl

Seznam projektů je serverový stav spravovaný přes TanStack React Query. Původní
implementace vznikla v legacy cestě `hooks/queries/useProjectsQuery.ts`, zatímco
její hlavní moderní odběratel žije ve feature vrstvě. Cílem migrace je přesunout
vlastnictví hooku do `features/projects/`, zachovat kompatibilitu starších
odběratelů a nezměnit uživatelské chování ani síťový kontrakt.

## Cílové vrstvy

| Odpovědnost | Kanonické umístění | Poznámka |
| --- | --- | --- |
| React Query orchestrace | `features/projects/hooks/useProjectsQuery.ts` | Jediná implementace hooku |
| Viditelnost a mapování | `features/projects/model/projectVisibility.ts` | Čistá, deterministická O(n+m) funkce |
| Databázový adaptér | `infra/db/dbAdapter.ts` | Izoluje feature od konkrétního klienta |
| Retry a timeout | `shared/async/asyncControl.ts` | Sdílená technická politika bez doménové vazby |
| Demo data | `features/projects/api/projectDemoDataApi.ts` | Feature API nad legacy úložištěm demo dat |
| Legacy kompatibilita | `hooks/queries/useProjectsQuery.ts` | Pouze re-export, žádná druhá implementace |

Přímá závislost nového hooku na legacy `AuthContext` je vědomý přechodový bod.
Odstraní se až při samostatné migraci autentizačního rozhraní; tato změna ji
nerozšiřuje do dalších souborů.

## Veřejný kontrakt hooku

- Query key je `[..., PROJECT_KEYS.list(), user.id]` a odděluje cache uživatelů.
- Query je aktivní pouze tehdy, když existuje přihlášený uživatel.
- Demo uživatel nevolá databázi a dostane uložené demo projekty nebo výchozí
  `DEMO_PROJECT`.
- Projekty se řadí v databázi podle `created_at` sestupně.
- Projekty a metadata oprávnění se načítají paralelně; nesmí vzniknout waterfall.
- Oba dotazy mají timeout 12 sekund a jeden opakovaný pokus.
- Chyba hlavního dotazu na projekty se propaguje do React Query.
- RPC odpověď s chybou nebo chybějícími daty metadat nesmí rozšířit přístup.
  Vlastní a demo projekty lze zobrazit, explicitně sdílené projekty bez
  ověřených metadat ne. Transportní chyba nebo timeout po vyčerpání retry
  odmítne celý query a přejde do chybového stavu React Query.
- Cache je považována za čerstvou 5 minut.

## Bezpečnostní model

Postgres Row Level Security je primární autorizační hranice. Klientská kontrola
vlastníka, normalizovaného e-mailu sdílení a demo příznaku je pouze
defense-in-depth a nesmí být použita jako náhrada RLS.

Bezpečnostní invarianty:

1. Prázdné `userId` nikdy neodpovídá prázdnému nebo `null` `owner_id`.
2. Sdílení vyžaduje neprázdný normalizovaný e-mail a explicitní shodu v
   metadatech konkrétního projektu.
3. Chybějící či chybová RPC data selžou uzavřeně pro sdílené projekty;
   transportní selhání nezobrazí částečný seznam.
4. Frontend nepoužívá `service_role` ani jiný klíč obcházející RLS.
5. Tato migrace nemění SQL, RPC, grants ani RLS politiky.

RPC `get_projects_metadata` je bezpečnostně citlivé. Jeho databázová definice
musí dále filtrovat podle identity volajícího, mít omezená oprávnění a řízený
`search_path`; změna klientského hooku tento požadavek nemění.

## Výkonové invarianty

- Nezávislé dotazy běží v jednom `Promise.all`.
- Metadata se jednou indexují do `Map`; pro každý projekt se neprovádí lineární
  hledání v celém seznamu metadat.
- Celková klientská složitost mapování zůstává O(n+m).
- Query key, `staleTime` a deduplikace React Query se migrací nemění.
- Nový hook nepřidává další síťové volání ani novou runtime závislost.

## Testovací plán a výsledek

### Kontrakt a kompatibilita

- [x] Kanonický a legacy import exportují stejnou funkci hooku.
- [x] Query key, `enabled` a pětiminutový `staleTime` zůstanou stejné.
- [x] Nepřihlášený stav je zakázaný a nevytváří falešnou identitu cache.
- [x] Demo větev nevolá databázi a zachová fallback projekt.

### Síť a chyby

- [x] Projekty a metadata se zahájí paralelně.
- [x] Každá operace používá timeout 12 sekund a jeden retry.
- [x] Chyba projektového dotazu se beze změny propaguje.
- [x] Chyba metadat nerozšíří viditelnost sdílených projektů.
- [x] Odmítnutá metadata operace po retry přejde do chybového stavu query.

### Viditelnost a mapování

- [x] Vlastník, explicitně sdílený uživatel a demo projekt jsou viditelní.
- [x] Cizí projekt je skrytý.
- [x] E-mail sdílení se porovnává po `trim` a bez ohledu na velikost písmen.
- [x] Prázdná identita a neúplná metadata selžou uzavřeně.
- [x] Mapování nemutuje vstupní data a zachovává výchozí hodnoty.

### Kvalitativní brány

- [x] Cílené testy hooku, viditelnosti a jeho odběratelů.
- [x] Kompletní Vitest sada.
- [x] TypeScript kontrola, web build a desktop compile.
- [x] `check:boundaries`, `check:legacy-structure` a architektonický audit.

Lokální ověření při migraci: 293 testovacích souborů a 1 369 testů prošlo.
Architektonický audit zůstal na 80 přechodových vazbách; vazby
`features-to-legacy-hooks` klesly ze čtyř na tři. GitHub Quality Checks, Vercel
a thread-aware security review jsou povinnou vzdálenou bránou každého PR a
jejich konkrétní výsledek zůstává v historii příslušného PR.

## Rollout a návrat zpět

Migrace je kompatibilní: staré importy pokračují přes re-export. Návrat zpět je
možný revertováním jediného PR bez databázové migrace nebo změny uložených dat.
Po merge se sledují chyby načítání seznamu projektů a případné incident reference
v existující diagnostice aplikace.

## Externí reference

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase JavaScript: SELECT](https://supabase.com/docs/reference/javascript/select)
- [Supabase changelog](https://supabase.com/changelog)

## Troubleshooting

- **Nejsou vidět vlastní projekty:** ověřit přihlášeného uživatele, chybu dotazu
  `projects` a RLS SELECT politiku pro `owner_id`.
- **Nejsou vidět sdílené projekty:** ověřit výsledek `get_projects_metadata`,
  normalizovaný e-mail a oprávnění RPC. Neobcházet problém vypnutím RLS.
- **Dotaz končí timeoutem:** rozlišit hlavní seznam od RPC podle české timeout
  zprávy a prověřit indexy sloupců používaných RLS politikami.
- **Demo režim volá síť:** jde o regresi; demo větev musí skončit před vytvořením
  databázových operací.
