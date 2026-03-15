# GDPR Readiness Checklist

Poslední aktualizace: 15. března 2026

## Shrnutí
Tender Flow je po technické stránce velmi blízko praktickému `GDPR minimum ready` stavu. Hlavní compliance registry, breach workflow, DSR evidence, MFA enforcement, cookie consent a veřejné právní texty jsou zavedené a navázané na společný datový model.

Stále ale zbývá několik bodů, bez kterých není poctivé označit stav jako plně `GDPR ready`. Část z nich je ještě v kódu, část už je mimo kód a týká se smluv, interních směrnic a provozních odpovědností.

## 1. Hotovo v produktu a databázi

### Governance a evidence
- [x] Compliance admin dashboard existuje.
- [x] ROPA registr činností zpracování existuje.
- [x] Registry subprocessors existuje.
- [x] Retention policy registry existuje.
- [x] Access review a audit změn rolí a oprávnění existuje.

### Incidenty a breach
- [x] Breach register existuje.
- [x] 72h timeline je evidovaná.
- [x] Je možné zapsat hlášení ÚOOÚ a informování subjektů údajů.
- [x] Je možné doplnit klasifikaci dotčených údajů, subjektů a rozsahu.
- [x] Je možné stáhnout pracovní podklady pro ÚOOÚ.

### DSR
- [x] Evidence DSR požadavků existuje.
- [x] Export osobních údajů po subjektu existuje.
- [x] Evidence žadatele, kanálu přijetí, ověření identity a shrnutí vyřízení existuje.
- [x] Výmaz z UI není spuštěn destruktivně a zůstává jen evidenční.

### Přístupy a souhlasy
- [x] MFA enforcement pro admin účty existuje.
- [x] Cookie consent lišta existuje.
- [x] Nepovinná analytika se bez souhlasu nespouští.

### Veřejné právní texty
- [x] Privacy, DPA a Cookies stránky existují.
- [x] Veřejné texty jsou navázané na stejný registry model jako interní compliance data.
- [x] Veřejné texty obsahují konkrétní subprocessory, retenční rámce a hlavní ROPA činnosti.

## 2. Zbývá v kódu

### Kritické minimum
- [x] DSR proces pro `opravu` je dotažený jako samostatný provozně doložitelný workflow.
- [x] DSR `výmaz` má finální rozhodovací workflow pro bezpečné ruční provedení mimo UI, bez destruktivní automatizace v adminu.
- [-] Log policy je z větší části dotažená napříč hlavními service vrstvami; zbývá dočistit další vedlejší moduly a desktop/debug logy mimo kritické GDPR toky.
- [ ] Retence mimo compliance registry není ještě dotažená napříč hlavními CRM daty a zálohami, i když hlavní CRM, dokumentové a exportní domény už mají manuální retenční review workflow a runtime telemetry i krátkodobé provozní domény mají reálné cleanup napojení.

### Doporučené doplnění
- [x] Přidat testy na RLS a ochranu compliance tabulek.
- [x] Přidat integrační test napojení runtime incidentu na breach case workflow.
- [x] Dopsat finální systematický security/compliance přehled do adminu.

## 3. Zbývá mimo kód

Tyto body jsou nutné pro poctivé `GDPR ready`, ale nevyřeší je samotná implementace v repu.

### Smlouvy a vztahy
- [ ] Mít finální DPA / smlouvy se zpracovateli.
- [ ] Potvrdit role `správce` vs `zpracovatel` pro hlavní scénáře používání Tender Flow.
- [ ] Ověřit, že seznam subprocessors odpovídá reálně používaným vendorům.

### Interní dokumentace
- [ ] Schválit retenční směrnici.
- [ ] Schválit incident response / breach postup.
- [ ] Vést skutečný provozní breach register.
- [ ] Popsat interní odpovědnosti: kdo řeší DSR, kdo řeší breach, kdo dělá access review.

### Právní posouzení
- [ ] Prověřit, zda je potřeba DPIA.
- [ ] Prověřit, zda je potřeba DPO.
- [ ] Ověřit právní tituly a textaci veřejných dokumentů právníkem nebo odpovědnou osobou.

## 4. Praktický závěr

### Co už lze říct dnes
- `Technické compliance minimum` je z velké části hotové.
- Produkt je na velmi dobré cestě k praktickému souladu s GDPR.
- Současná implementace je auditovatelná výrazně lépe než na začátku projektu.

### Co ještě nelze poctivě říct
- Zatím nelze bez výhrad tvrdit `plně GDPR ready`.
- Chybí poslední provozní a právní vrstva mimo kód.

## 5. Doporučené poslední kroky
1. Dokončit poslední technické mezery v retenci a log policy.
2. Finalizovat interní směrnice a smluvní dokumentaci.
3. Udělat krátkou právní validaci veřejných textů a procesů.
4. Po tomto kroku označit stav jako `GDPR ready`.
