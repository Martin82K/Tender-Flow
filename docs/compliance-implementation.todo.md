# Compliance implementace Tender Flow

Poslední aktualizace: 14. března 2026

## Jak s tím pracovat
- `[x]` = hotovo
- `[ ]` = čeká
- `[-]` = rozpracováno / částečně

## Pracovní log
- [x] 2026-03-12: vznikl implementační plán a audit aktuálního stavu repozitáře
- [x] 2026-03-12: přidán první admin `Compliance` přehled do settings
- [x] 2026-03-12: sjednocena sanitizace logů do sdíleného helperu
- [x] 2026-03-12: přidán databázový základ compliance registry a servisní vrstva pro admin přehled
- [x] 2026-03-12: přidána základní cookie consent vrstva pro web
- [x] 2026-03-12: přidáno zakládání a změna stavu `breach cases` a `DSR requests`
- [x] 2026-03-12: přidán základní `admin_audit_events` log pro citlivé compliance akce
- [x] 2026-03-12: přidán admin DSR export JSON a anonymizace nad profily, kontakty a personálními poli projektů
- [x] 2026-03-12: přidána editace retention policies, compliance purge trigger a timeline tabulky pro DSR/breach eventy
- [x] 2026-03-12: přidán základní editor subprocessor registry se zápisem a admin auditem
- [x] 2026-03-12: přidán admin MFA guard s TOTP enrollment flow a AAL2 ověřením session pro admin sekci
- [x] 2026-03-12: nepovinná usage analytika je centrálně blokovaná bez souhlasu cookies
- [x] 2026-03-12: compliance admin převeden do bezpečného režimu bez mazání dat z databáze; výmaz/purge akce jsou jen evidenční a vysvětlené v UI
- [x] 2026-03-12: přidán první ROPA registr činností zpracování do compliance adminu včetně migrace, evidence právního titulu a vazby na retenci
- [x] 2026-03-12: rozšířen breach workflow o 72h timeline, posouzení případu a evidenci notifikací vůči ÚOOÚ a subjektům bez mazání dat
- [x] 2026-03-13: přidán access review report, audit změn rolí a oprávnění a snapshot pravidelné kontroly přístupů
- [x] 2026-03-13: přidán export pracovních podkladů pro ÚOOÚ z breach evidence a timeline
- [x] 2026-03-13: provedeno provázání ROPA záznamů na retention policy a subprocessors včetně nové spojovací tabulky
- [x] 2026-03-13: doplněna breach klasifikace pro dotčené údaje, typy subjektů, odhad rozsahu a důvod hlášení nebo nehlášení
- [x] 2026-03-14: DSR workflow rozšířeno o evidenci žadatele, kanálu přijetí, ověření identity a shrnutí vyřízení bez mazání dat
- [x] 2026-03-14: legal texty napojeny na stejný registry model jako interní compliance admin
- [x] 2026-03-14: na remote nasazeny DSR evidence a seed reálných compliance registry dat
- [ ] Další krok: finální gap check a dokončení zbývajících provozních kroků mimo kód

## Přehled priorit

### P0
- [ ] Zavést jednotnou log policy a audit citlivých akcí
- [x] Přidat breach register a GDPR incident workflow
- [ ] Přidat retention matrix a první purge joby mimo incidenty
- [ ] Přidat DSR workflow pro access/export/delete

### P1
- [x] Vynutit MFA pro admin účty
- [x] Přidat subprocessor registry a ROPA evidenci
- [x] Přidat cookie consent vrstvu

### P2
- [x] Napojit veřejné legal stránky na interní compliance registry

## Sekce a stav

### 1. Veřejné právní dokumenty
- [x] Privacy, Cookies, Terms a DPA stránky existují
- [x] Legal routing existuje
- [x] Testy renderu legal dokumentů existují
- [x] Napojit texty na skutečně implementované retention mechanismy
- [x] Doplnit konkrétní subprocessors a reálné retenční doby
Stav: implementováno
Priorita: střední
Dopad do kódu: malý
Dopad do struktury: bez zásadní změny

### 2. Incident logging aplikace
- [x] Centralizované incident logování existuje
- [x] Sanitizace e-mailů, JWT a tokenů existuje
- [x] Queue + flush při offline stavu existuje
- [x] Admin UI incidentů existuje
- [x] Incident DB tabulka, RPC a retention purge existují
- [x] Testy loggeru a incident admin UI existují
- [ ] Oddělit runtime incident od GDPR breach případu
- [x] Přidat breach register a právní klasifikaci incidentu
- [ ] Přidat severity policy a eskalační workflow
Stav: implementováno se zásadními mezerami pro compliance
Priorita: kritická
Dopad do kódu: střední
Dopad do struktury: nový compliance modul pro breach management

### 3. Bezpečnost hlaviček a základní hardening
- [x] CSP frame-ancestors existuje
- [x] CORS allowlist konfigurace existuje
- [x] Testy security headers existují
- [x] Token rotation a auth rate limits v Supabase configu existují
- [ ] Přidat systematický compliance přehled těchto opatření do admin UI
Stav: implementováno
Priorita: střední
Dopad do kódu: malý
Dopad do struktury: případně nový compliance report view

### 4. Role, oprávnění, RLS a admin access
- [x] Role management a permissions model existují
- [x] Více RLS hardening migrací existuje
- [x] Admin-only incident logy existují
- [x] Organization role management existuje
- [x] Zavést centrální audit trail změn rolí a oprávnění
- [x] Přidat přehled access review
- [x] Přidat evidenci pravidelné kontroly přístupů
Stav: implementováno se zbývajícím dopracováním detailů
Priorita: vysoká
Dopad do kódu: střední
Dopad do struktury: nový audit subsystem

### 5. MFA / silné ověřování
- [x] Desktop biometrické odemknutí existuje
- [x] Supabase MFA konfigurační sekce je připravená
- [x] Vynutit MFA pro admin účty
- [x] Přidat enrolment a enforcement flow
- [x] Oddělit komfortní biometriku od compliance MFA
Stav: implementováno pro admin compliance minimum
Priorita: kritická
Dopad do kódu: střední až vyšší
Dopad do struktury: rozšíření auth a settings

### 6. Log policy mimo incidenty
- [x] Incident logger sanitizuje citlivé hodnoty
- [x] Runtime diagnostics maskují tajemství
- [x] Část security testů pokrývá redakci
- [ ] Sjednotit sanitizaci do jedné sdílené utility
- [ ] Zakázat raw payload logging v edge funkcích a admin flow
- [ ] Rozšířit coverage na feature usage, AI audit, DocHub logy a exporty
Stav: částečně
Priorita: kritická
Dopad do kódu: střední
Dopad do struktury: sdílený helper pro log policy

### 7. Retence dat mimo incidenty
- [x] Incident logy mají retention purge job
- [x] Právní texty retenci deklarují obecně
- [x] Některé feature-specific logy mají vlastní mazání
- [x] Přidat centrální retention matrix
- [-] Přidat purge/anonymize joby pro další datové oblasti
- [x] Admin UI běží v safe-mode a z produkční databáze nic nemaže bez dalšího explicitního kroku
- [ ] Evidovat výjimky a vazbu na backupy
Stav: částečně
Priorita: kritická
Dopad do kódu: vysoký
Dopad do struktury: nový compliance/retention modul

### 8. DSR workflow: export, přístup, oprava, výmaz
- [x] Existují feature exporty
- [x] Existují běžné CRUD operace nad kontakty a projekty
- [x] Přidat centrální subject request workflow
- [x] Přidat export osobních údajů po subjektu
[ ] Přidat delete/anonymize orchestraci přes tabulky
[x] Admin UI nyní eviduje požadavky na výmaz bez spuštění mazání nebo anonymizace dat
[x] Auditovat requesty a SLA
[x] Evidovat žadatele, kanál přijetí, ověření identity a shrnutí vyřízení
Stav: částečně
Priorita: kritická
Dopad do kódu: vysoký
Dopad do struktury: nový compliance modul + backend endpointy/RPC

### 9. Cookie consent a analytické souhlasy
- [x] Veřejná cookie policy stránka existuje
- [x] Přidat cookie lištu / consent manager
- [x] Ukládat preference souhlasů
- [x] Blokovat non-essential cookies a analytics do udělení souhlasu
Stav: implementováno se zbývající vazbou na případné další trackery
Priorita: vysoká
Dopad do kódu: střední
Dopad do struktury: nový public/privacy modul + consent utilita

### 10. Breach register a GDPR incident workflow
- [x] Technické incidenty se sbírají
- [x] Přidat datový model breach case
- [x] Přidat klasifikaci rizika a dotčených údajů
- [x] Přidat timeline 72h procesu
- [x] Přidat evidenci hlášení ÚOOÚ a informování subjektů
- [x] Přidat export/print podklady pro ÚOOÚ
Stav: implementováno se zbývajícím provozním doplněním
Priorita: kritická
Dopad do kódu: vysoký
Dopad do struktury: nový compliance backend model + admin UI

### 11. ROPA / záznamy o činnostech zpracování
- [x] Přidat strukturovaný registr processing activities
- [x] Provázat účely, kategorie dat, retention a subprocessors
Stav: implementováno se zbývajícím dopracováním detailů
Priorita: vysoká
Dopad do kódu: střední
Dopad do struktury: nový compliance datastore

### 12. Vendor / subprocessor registry
- [x] DPA text obecně subprocessory připouští
- [x] Přidat konkrétní seznam dodavatelů, regionů, účelů a SCC statusů
- [x] Provázat registry s legal stránkami a interním auditem
Stav: implementováno se zbývajícím doplněním reálných provozních detailů
Priorita: vysoká
Dopad do kódu: malý až střední
Dopad do struktury: nový interní compliance registry modul

## Implementační checklist po subsystémech

### A. Nový compliance modul
- [x] Přidat nový modul mimo freeze roots
- [x] Compliance dashboard
- [x] Retention policy admin
- [x] DSR request queue
- [x] Breach register
- [x] Subprocessor registry
- [x] Compliance status checklist
- [x] Přidat public interfaces: `ComplianceChecklistItem`, `RetentionPolicy`, `DataSubjectRequest`, `BreachCase`, `SubprocessorRecord`

### B. Backend a databáze
- [x] Přidat tabulku `compliance_retention_policies`
- [x] Přidat tabulku `data_subject_requests`
- [x] Přidat tabulku `data_subject_request_events`
- [x] Přidat tabulku `breach_cases`
- [x] Přidat tabulku `breach_case_events`
- [x] Přidat tabulku `subprocessors`
- [x] Zvážit nebo přidat `admin_audit_events`
- [-] Přidat purge/anonymize SQL joby
- [x] Zavést jednotný audit insert helper
- [x] Přidat admin-only SQL funkce pro DSR export a anonymizaci

### C. Auth a access governance
- [x] Doplnit skutečné MFA enforcement
- [x] Přidat admin access review report
- [-] Auditovat změny rolí, login type a subscription/admin zásahy

### D. Logging a privacy by default
- [x] Sjednotit sanitizaci do sdílené utility
- [ ] Zakázat raw payload logging v edge funkcích a admin flow
- [ ] Převést feature usage a AI audit na metadata-only logging

### E. Produktové workflow
- [x] Přidat stránku „Požadavky subjektů údajů“
- [x] Přidat stránku „Breach register“
- [x] Přidat stránku „Retence dat“
- [x] Přidat stránku „Compliance checklist“
- [x] Převést veřejné legal stránky na výstup nad interními registry

## Test checklist
- [x] Jednotkové testy sanitizace logů a audit payloadů
- [x] Jednotkové testy retention evaluace
- [ ] Jednotkové testy DSR export assembleru
- [x] Jednotkové testy DSR delete/anonymize orchestrátoru
- [ ] Jednotkové testy breach severity helperu
- [x] Jednotkové testy create/update service vrstvy pro compliance workflow
- [x] Integrační test admin -> DSR export -> audit
- [x] Integrační test admin -> DSR delete/anonymize
- [ ] Integrační test runtime incident -> breach case workflow
- [x] Integrační test MFA enforcement pro admina
- [ ] SQL/RPC testy RLS pro compliance tabulky
- [-] SQL/RPC testy purge jobů
- [ ] SQL/RPC testy ochrany breach a audit tabulek
- [x] UI test nových compliance obrazovek
- [x] UI test cookie banneru
- [-] Regresní průchod incident loggeru, legal dokumentů, security headers a auth recovery

## Poznámky k implementaci
- Compliance funkce jsou v první fázi interní admin funkcionalita.
- Zdroj pravdy bude databáze, ne jen markdown.
- Nové moduly držet mimo freeze roots.
- Desktop biometrie není náhrada za plnohodnotné admin MFA.
- Právní kvalifikace breach zůstává na odpovědné osobě; systém připraví evidenci a workflow.
