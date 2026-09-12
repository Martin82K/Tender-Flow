# Tender Flow vs First RSV.online (nabídka pro Baustav)

Stav: dokumentační analýza, 12. 9. 2026. Nejde o produktovou implementaci.

Účel: ověřit překryv nabídky First RSV.online z 11. 9. 2026 s tím, co Tender
Flow **reálně umí v tomto repozitáři**. Marketing webu Tender Flow ani First
není zdrojem pravdy.

## Verdikt

Tender Flow je specializovaný systém přípravy a vedení výběrových řízení:
poptávky, pipeline nabídek, plán VŘ, kontakty subdodavatelů, smlouvy s OCR,
investor, dokumenty napojené na externí úložiště a MCP. First RSV.online z
nabídky je cloudové řízení stavební výroby / ERP vrstva: položkové rozpočty,
kalkulace, soupisy provedených prací, controlling, schvalování, DMS a vazba na
Helios.

Hypotéza „TF pokrývá VŘ / přípravu / smlouvy / OCR / MCP; First míří na plný
provoz“ **platí**. Neplatí, že TF je náhrada RSV.online, ani že First ConBid
je nadmnožina Tender Flow pipeline.

Pro Baustav dává smysl:

- **Tender Flow**, pokud jádrem bolesti je příprava a vedení subdodavatelských
  VŘ, porovnání nabídek, komunikace s dodavateli a dohledatelný přechod
  vítěz → smlouva.
- **First RSV.online**, pokud jádrem bolesti je provoz stavby: položkový
  rozpočet, soupisy, controlling proti kalkulaci, zdroje, firemní schvalování
  a zápis do Helios.
- **Oboje**, pokud se fáze oddělí: Tender Flow do zasmluvnění, First od
  realizačního rozpočtu a soupisů. Současný nákup First ConBid (1 seat) i
  plné TF pipeline je překryv, který je potřeba vědomě řídit.

## Zdroje a hranice

| Zdroj | Co z něj plyne | Co z něj neplyne |
| --- | --- | --- |
| Nabídka First `Nabídka_RSV_online_11092026.pdf` (11. 9. 2026), údaje zadané v zadání | názvy modulů, seatý, ceny, provozní varianty, Helios Inuvio v maintenance | interní implementace First |
| Veřejný popis RSV.online / Helios ([rsv.online](https://rsv.online/), [helios.eu/rsv](https://www.helios.eu/rsv)) | First spojuje obchod → realizace → záruka; rozpočty, VŘ, soupisy, DMS, Helios, WFplus | detaily nabídky Baustav |
| Tento repozitář | implementovaný stav Tender Flow | sliby First ani budoucí TF roadmapa jako hotová funkce |

PDF nabídky v repozitáři není. Čísla First níže jsou převzatá ze zadání a
součet pronájmu je ověřený aritmetikou, ne z PDF.

Veřejný web Tender Flow (`features/public/`, `public/llms.txt`) je sladěný s
katalogem, ale používá narativ („výkaz výměr“, „schválení u zakázky“). Tento
dokument bere jen kód, typy, feature flags a `docs/`.

Otevřené PR v `Martin82K/Tender-Flow` k datu analýzy: žádné. Code Scanning a
Dependabot v dokumentaci projektu nejsou dostupné signály
(`docs/product/public-aeo-content.md`, `docs/product/subscription-administration.md`).

## Těžiště

```text
Příprava / VŘ                          Realizace / controlling / ERP
────────────────────────────────       ────────────────────────────────
Plán VŘ, pipeline, poptávky            Položkový rozpočet a kalkulace
Kanban nabídek, kola cen               Soupisy provedených prací
Hromadné e-mailové koncepty            Čerpání proti položkám
Kontakty subdodavatelů, ARES, mapa     Controlling nákladů / SUB / zdrojů
Vítěz → smlouva, OCR smlouvy           Schvalovací workflow dokladů
Investor SOD, dodatky, evidence faktur Posting do Helios / účetnictví
DocHub / odkazy na složky              Firemní DMS, fulltext příloh
MCP nad projekty, VŘ, nabídkami        Výroba, mzdy, stroje, materiál

Tender Flow těžiště ─────────────►     ◄───────────── First těžiště
překryv: kontakty, smlouvy, dokumenty, hrubé finance stavby
```

Tender Flow má stavy projektu `tender | realization | archived` a klonování
soutěže do realizace (`docs/product/feature-catalog.md`, `types.ts`). Realizace
v TF znamená pokračování stejného projektu (smlouvy, investor, harmonogram
kategorií), ne výrobní controlling.

First seatová struktura to potvrzuje: ConBid má **1** seat, zatímco ConTract,
controlling, soupisy, předání, workflow a DMS mají **29–32** seatů. Nabídka
není nákup nástroje na VŘ. Je to rollout provozního systému pro firmu.

## Mapa First modulů → Tender Flow

Stupnice: **má** / **částečně** / **nemá**. „Má“ znamená, že TF pokrývá
stejnou pracovní úlohu v implementovaném kódu, ne že jde o stejný produkt.

| First | Seatý | Cena/rok/uživ. | TF | Co TF skutečně má | Důkaz v repu | Mezera |
| --- | ---: | ---: | --- | --- | --- | --- |
| 101 CRM | 15 | 5 220 | **částečně** | Evidence subdodavatelů a osob, specializace, kraje, rating, import, ARES, rychlé vložení. Projekty, org. členové, úkoly, notifikace. Nejde o obchodní CRM zakázek / rizik / konkurence. | `docs/product/feature-catalog.md`; `features/contacts/`; `types.ts` (`Subcontractor`); `features/help/content/contacts.ts`; `features/organization/` | First CRM na webu: evidence projektů, právní a finanční riziko, dokumentace nabídkové fáze, manažerské přehledy. TF kontakty jsou dodavatelský adresář, ne obchodní kniha příležitostí. |
| 201 ConBid | 1 | 8 520 | **má** | Plán VŘ, poptávkové kategorie, kanban nabídek, kola cen, hromadné koncepty poptávek / doplnění / poděkování, vazba vítěze (`sod`) na smlouvu, exporty, MCP nad VŘ a nabídkami. | `features/projects/pipeline/`; `features/projects/ui/TenderPlan.tsx`; `features/projects/api/tenderPlanApi.ts`; `docs/product/feature-catalog.md`; `docs/mcp/tools-reference.md`; `types.ts` (`DemandCategory`, `Bid`, `BidStatus`) | TF neodesílá e-mail sám; otevírá koncept. Chybí položkové porovnání výkazu výměr (jen celková cena a historie kol). `docs/product/workflow-opportunities.md` uvádí hromadné porovnání položek jako nerealizovaný směr. |
| 301 ConTract | 31 | 3 576 | **částečně** | Registr smluv a dodatků, OCR předvyplnění, retence, faktury SUB, čerpání jako součet faktur, rating dodavatele, dashboard, organizační smluvní přehled, investor (SOD, dodatky, faktury, pozastávky). | `features/projects/contracts/`; `features/contracts-overview/`; `docs/architecture/contract-documents-and-investor-billing.md`; `docs/architecture/project-access-and-contract-overview.md`; `types.ts` (`Contract`, `ContractInvoice`, `InvestorFinancials`) | Faktury jsou evidence částek a stavů, ne účetní doklad ani posting. `MODULE_INVOICING` je v `config/features.ts` označené jako plánované. Čerpání nemá UI pro zápis soupisů. Chybí vazba na Helios. |
| 401 Budget Import | 5 | 5 772 | **nemá** | Lze připojit soubor rozpočtu k poptávce (příloha do e-mailu) a importovat řádky **plánu VŘ** z XLSX. Excel Indexace VŘ indexuje obsah sešitů. Žádný import položkového rozpočtu (RSV / KROS / ÚRS) do datového modelu. | `types.ts` (`BudgetAttachment`); `services/budgetAttachmentService.ts`; `features/projects/api/tenderPlanExportApi.ts`; `services/indexerService.ts`; `docs/architecture/demand-categories-auth-boundary.md` | `budget` u kategorie je zobrazovací řetězec; `sodBudget` / `planBudget` jsou dvě čísla na kategorii, ne strom položek. |
| 402 Budget Cost estimate | 5 | 11 004 | **nemá** | Interní plán a SOD investora na úrovni kategorie / stavby. Žádný kalkulační engine, normy, přirážky, typové náklady. | `types.ts` (`DemandCategory.sodBudget`, `planBudget`); `features/help/content/project.ts`; `features/projects/ui/ProjectOverviewNew.tsx` | Landing narativ „Připravit rozpočet“ / „výkaz výměr“ (`features/public/`) není modul kalkulace. |
| 501 ConJect Plan | 5 | 8 520 | **částečně** | Harmonogram je Gantt **výběrových řízení** a volitelně realizačního okna kategorie (`realizationStart` / `realizationEnd`). Plán VŘ je časový plán soutěží. | `features/projects/ui/ProjectSchedule.tsx`; `features/projects/api/projectScheduleApi.ts`; `features/projects/ui/TenderPlan.tsx`; `types.ts` (`TenderPlanItem`) | Není časový plán stavební výroby (činnosti, kapacity, kritická cesta dílčích prací). Popisek v UI: „Gantt navázaný na výběrová řízení a jejich termíny“. |
| 502 ConJect Performed works | 29 | 5 220 | **nemá** | Typ `ContractDrawdown` (`claimedAmount` / `approvedAmount`) existuje v DB a v read-only tabulce, pokud záznamy jsou. Čerpání v UI se počítá z faktur. Žádný soupis provedených prací po položkách. | `types.ts` (`ContractDrawdown`); `features/projects/contracts/workspace/sections/DrawdownsSection.tsx`; migrace `contract_drawdowns` | V `features/projects/contracts/api/` není zápis čerpání. First 29 seatů = provoz stavby; v TF ekvivalent chybí. |
| 503 ConJect Handover/Claims | 30 | 3 852 | **částečně** | Generátor protokolu Předání díla SUB (XLSX + PDF). Definice Předání staveniště je `provisional`. Datum dokončení smlouvy jako počátek záruky. Pole vad v šabloně protokolu. | `features/projects/api/generateContractProtocol.ts`; `features/projects/model/contractDocumentRegistry.ts`; `types.ts` (`Contract.completionDate`) | Není registr vad, reklamací, extra prací ani záručních řízení. Workflow „ze smlouvy ke splněnému závazku“ je výslovně neimplementovaný návrh (`docs/product/workflow-opportunities.md`). |
| 601 Controlling cost analysis | 31 | 6 876 | **částečně** | Přehled stavby: SOD investora, plán, cena z VŘ, zasmluvněno, rozdíly, export XLSX. Organizační přehled projektů a smluv. | `features/help/content/project.ts`; `features/projects/api/projectOverviewExportApi.ts`; `features/projects/ProjectOverview.tsx`; `features/projects/contracts/dashboard/` | First controlling jde na kalkulační položky, typové náklady a organizační jednotky. TF porovnává součty kategorií, ne položky ani spotřebu. |
| 602 Controlling subcontractors | 1 | 3 024 | **částečně** | Porovnání nabídek v pipeline, rating z uzavřených smluv, finanční souhrn smlouvy (cena, dodatky, faktury, zbývá). | `features/projects/pipeline/`; `features/projects/contracts/forms/VendorRatingDialog.tsx`; `docs/architecture/vendor-rating-auth-boundary.md` | Chybí controlling SUB proti položkovému rozpočtu a soupisům. Jeden First seat sedí s tím, že jde o úzkou controllingovou roli; TF to neřeší jako nákladový controlling. |
| 603 Controlling resources | 2 | 7 428 | **nemá** | Žádný modul materiálů, strojů, mezd, výkazů hodin ani spotřeby zdrojů. | Absence v `config/features.ts`, `app/featureRegistry/manifests.ts`, `features/` | First veřejně uvádí vyhodnocení spotřeby zdrojů (materiály, stroje, mzdy). V TF není ani zárodek. |
| 701 Workflow approval | 32 | 6 324 | **nemá** | Matice rolí umí uložit příznak `canApprove` u výběru dodavatele. Stav faktury zahrnuje `approved`. Schvalují se žádosti o vstup do organizace a MCP zápisy. | `shared/authorization/projectRoles.ts`; `features/organization/ui/OrgRolePermissionsTab.tsx`; `docs/architecture/project-access-and-contract-overview.md`; `docs/mcp/write-safety.md` | Architektura výslovně: budoucí schvalování výběru má mít vlastní tabulku kroků a „není odvozeno z projektové role“. `canApprove` se mimo uložení matice v aplikaci nepoužívá. First 32 seatů odpovídá WFplus / firemnímu schvalování dokladů, ne TF. |
| 801 DMS | 32 | 3 576 | **částečně** | Záložka Dokumenty: odkazy, šablony, ceníky jako odkaz, DocHub / Složkomat (Google Drive, OneDrive/SharePoint, lokální složka). Smlouvy mají privátní bucket `contract-documents`. | `features/projects/documents/`; `docs/architecture/contract-documents-and-investor-billing.md`; `docs/product/feature-catalog.md`; `config/features.ts` (`DOC_HUB`, `MODULE_DOCUMENTS` planned) | Není firemní DMS se stromem složek, fulltextem v přílohách a verzováním všech dokumentů stavby. Úložiště je převážně externí. `MODULE_DOCUMENTS` je plánovaný flag, ne hotový modul. |

Součet First pronájmu z tabulky: **1 138 932 Kč/rok** (94 911 Kč/měsíc).
Implementace **736 500 Kč** jednorázově. Aritmetika seat × sazba sedí se
zadáním.

## Co Tender Flow umí a First nabídka nepokrývá

Tyto schopnosti v TF kódu jsou. Nejsou důvod tvrdit, že First je neumí; v
nabídce Baustav prostě nejsou jako samostatné položky.

| Schopnost TF | Stav | Důkaz |
| --- | --- | --- |
| Vlastní MCP server (čtení projektů, VŘ, smluv, úkolů; zápis stavu/ceny nabídky a úkolu po potvrzení) | implementováno | `docs/mcp/README.md`, `docs/mcp/tools-reference.md`, `server/mcp/`, `docs/product/ai-data-and-mcp.md` |
| OCR smluv přes Mistral, ZDR na podporovaných API, lidské potvrzení | implementováno | `features/projects/contracts/forms/ContractEditDialog.tsx`, `docs/architecture/contract-documents-and-investor-billing.md` |
| Mapa stavby a dodavatelů, geokódování, doporučení, trasy | implementováno, část za flagy | `features/maps/`, `config/features.ts` (`MODULE_MAPS`, `MAPS_*`) |
| Desktop Electron: lokální Excel nástroje, zálohy, složky | implementováno, tarif `enterprise`/`admin` | `docs/architecture/desktop.md`, `docs/product/feature-catalog.md` |
| Outlook vazba na kartu nabídky (identifikátory zprávy, ne tělo) | implementováno | `docs/mcp/outlook-bid-workflow.md` |
| Microsoft To Do u TODO Osobní | implementováno v omezeném rozsahu | `docs/product/feature-catalog.md` |
| Globální hledání projektů, kontaktů, poptávek, úkolů, smluv | implementováno | `docs/product/global-search.md` |
| Profesní role realizačního týmu a matice oprávnění | implementováno | `shared/authorization/projectRoles.ts`, `docs/architecture/project-access-and-contract-overview.md` |

## Provoz, integrace, licence

| Téma | First (nabídka 11. 9. 2026) | Tender Flow (repo) |
| --- | --- | --- |
| Provoz | on-prem; Azure veřejný se sdílenou DB; Azure privátní (+20 tis. Kč/měs správa, +5 tis. Kč Azure) | Multi-tenant SaaS nad Supabase (Auth, Postgres+RLS, Storage, Edge Functions) + Electron desktop. Desktop není offline ERP (`docs/product/public-aeo-content.md`). |
| Účetnictví / ERP | Helios Inuvio v maintenance zdarma; jiné ERP placené | V kódu ani docs není konektor Helios, Inuvio, Pohoda, Money S3 ani ISDOC. Fakturace je provozní evidence. |
| Identita | dle implementace First | Supabase Auth, MFA, org. role, RLS. MCP vlastní OAuth. |
| Licence TF | — | Veřejně Enterprise s individuální cenou, faktura, převod (`docs/product/ai-data-and-mcp.md`). Historické tarify `starter`/`pro` existují v `config/features.ts`; desktop jen `enterprise`/`admin`. |
| Data AI | mimo rozsah této analýzy | OCR přes Mistral; ZDR jen na podporovaných API; MCP klient má vlastní pravidla. |

Sdílená databáze Azure u First je residual risk pro oddělení tenantů. TF
izoluje organizace RLS a share pravidly; živé RLS testy se dvěma identitami
nejsou v CI (`docs/operations/known-limitations.md`).

## Překryvy, mezery, rizika

### Překryvy (platit dvakrát za stejnou práci)

1. **VŘ / ConBid vs pipeline** — největší funkční překryv. First má 1 seat;
   TF je naopak postavený jako denní nástroj přípraváře. Dvojí vedení nabídek
   rozbije historii kol a e-mailovou stopu.
2. **Smlouvy** — oba mají registr. Pokud First po implementaci převezme
   smlouvy včetně dodatků a faktur, TF smlouvy zůstanou přípravnou kopií, nebo
   naopak. Bez rozhodnutí o zdroji pravdy vzniknou dvě čísla SOD.
3. **Kontakty** — dodavatelský adresář. Rozchází se IČ, osoby a rating, pokud
   se nesynchronizují.
4. **Dokumenty** — DocHub vs First DMS. Dva stromy složek na jednu stavbu.

### Mezery Tender Flow vůči nabídce First

- Položkový rozpočet a kalkulace.
- Soupisy provedených prací a odsouhlasení s investorem / SUB po položkách.
- Controlling na položky, typové náklady, zdroje.
- Firemní schvalovací engine (32 seatů v nabídce).
- DMS s fulltextem a firemní strukturou.
- Integrace Helios / jiné ERP.
- Evidence vad, reklamací, extra prací jako proces.

### Mezery First vůči Tender Flow (z nabídky + veřejného popisu, bez auditu First kódu)

- Vlastní MCP a AI zápisy s potvrzením.
- OCR smluv s whitelistovanými poli a ZDR popisem.
- Kanban VŘ s koly cen, BCC koncepty a vazbou na Outlook identifikátory.
- Mapy a doporučení dodavatelů.
- Desktopové lokální Excel nástroje (odemčení, spojení, indexace).

### Rizika rozhodnutí

- **First jako „náhrada TF“** — ConBid 1 seat nenahradí denní práci přípravářů
  v TF pipeline. Hrozí, že VŘ zůstanou v Excelu / e-mailu vedle drahého ERP.
- **TF jako „náhrada RSV“** — bez soupisů, controllingu a Helios firma dál
  povede výrobu v tabulkách. TF to dnes neuzavře.
- **Oboje bez hranice fází** — dvojí smlouvy a rozpočty. Integrace mezi TF a
  First v tomto repu neexistuje; musela by se navrhnout zvlášť.
- **Implementace First 736 500 Kč** — hodnota je v provozu a Helios, ne v
  rychlém startu VŘ. TF je už běžící produkt (veřejná reference BAU-STAV je v
  `docs/product/public-aeo-content.md`; toto není tvrzení o aktuálním rozsahu
  nasazení u Baustav).
- **Landing vs kód TF** — „výkaz výměr“ a „schválení u zakázky“ na webu
  nepředstavují položkový rozpočet ani schvalovací workflow.
- **Plánované flagy** — `MODULE_INVOICING`, `MODULE_DOCUMENTS`. Existující
  obrazovky smluv a dokumentů nejsou důkaz dokončeného veřejného kontraktu
  těchto modulů (`docs/product/feature-catalog.md`).

## Doporučení pro Baustav

### Kdy Tender Flow

- Denní práce přípraváře: kategorie, oslovení, kola nabídek, výběr, smlouva.
- Potřeba AI čtení smluv a práce z ChatGPT / jiného MCP klienta.
- Tým už TF používá a bolest je v VŘ, ne ve výkazu výroby.
- Helios nebo jiné účetnictví už existuje a First by jen zdvojil VŘ vrstvu.

### Kdy First RSV.online

- Cíl je digitalizovat **výrobu**: rozpočet → soupis → controlling → záruka.
- Helios Inuvio je nebo bude účetní páteř a maintenance integrace je podmínka.
- Schvalování faktur a dokladů má jít jednotným workflow pro ~30 lidí.
- Položková kalkulace a import rozpočtů jsou povinný vstup, ne odkaz na soubor.

### Kdy oboje

Dává to smysl jen s tvrdou hranicí:

1. **Tender Flow** = příprava a VŘ až po `sod` a založení smlouvy (případně
   OCR originálu).
2. **First** = realizační rozpočet, soupisy, controlling, DMS provozu, Helios.
3. Jedna strana je zdroj pravdy smluv po podpisu; druhá drží jen odkaz / číslo.
4. First ConBid nekupovat „pro jistotu“, pokud pipeline zůstane v TF.
5. Neslibovat automatickou synchronizaci; v TF pro ni není konektor.

Pokud má First nahradit TF kompletně, je to změna denního nástroje přípravářů,
ne jen ERP projekt. Nabídka s 1 seatem ConBid na to nestačí.

Pokud má TF nahradit First, chybí rozhodující část nabídky (soupisy,
controlling, zdroje, workflow, DMS, Helios). To z tohoto repozitáře
nedoděláte bez nového produktu.

## Kontrolní seznam pro jednání

- Kde dnes žije položkový rozpočet stavby (Excel, KROS, RSV, nic)?
- Kde se schvalují soupisy a faktury SUB / investora?
- Je Helios Inuvio závazný, nebo jen možnost?
- Kolik lidí denně vede VŘ vs. kolik lidí zapisuje výrobu?
- Který systém má po podpisu vlastnit číslo smlouvy a dodatky?
- Je Azure sdílená DB u First přijatelná, nebo je podmínkou privátní instance?

## Ověření hypotézy

| Tvrzení | Výsledek | Opora |
| --- | --- | --- |
| TF pokrývá VŘ / přípravu | **ano** | pipeline, plán VŘ, kategorie, komunikace, MCP |
| TF pokrývá smlouvy / OCR | **ano, jako registr a extrakce; ne jako ERP smlouvy** | `features/projects/contracts/`, OCR v create flow |
| TF pokrývá MCP | **ano** | `docs/mcp/`, `server/mcp/` |
| First míří na plný provoz | **ano podle nabídky a veřejného popisu** | 29–32 seatů na soupisy, controlling, workflow, DMS; Helios |
| TF je náhrada RSV.online | **ne** | chybí 401, 402, 502, 603, 701 a ERP vazba |
| First ConBid je náhrada TF | **ne z této nabídky** | 1 seat vs. celé TF těžiště |

Další produktové funkce se v tomto dokumentu nenavrhují k implementaci.
