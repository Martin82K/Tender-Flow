# Tender Flow v1.9.19

Patch omezuje Microsoft To Do synchronizaci na aktivní úkoly, odstraňuje
projektová upozornění z Outlooku a zavádí bezpečnou správu hotových úkolů.

## Aktivní Microsoft To Do

- Do Microsoft To Do se synchronizují pouze aktivní úkoly a podúkoly.
- Dokončené mapované položky se v Tender Flow označí jako hotové a z
  Microsoft To Do se odstraní, aby nevyvolávaly stará upozornění.
- První synchronizace po aktualizaci provede úplné načtení Graph delta dat,
  takže se nová pravidla uplatní i na již propojené úkoly.

## Termíny bez projektových upozornění

- Úkoly navázané na stavbu nebo poptávku si zachovají termín.
- U těchto úkolů se do Microsoft To Do a Outlooku nepřenáší připomínka.
- Osobní úkoly bez vazby na stavbu nadále podporují termín i připomínku.

## Hotové úkoly a 14denní retence

- Pohled Hotovo nabízí ruční hromadné odstranění dokončených úkolů.
- Hotové úkoly se po uplynutí 14 dnů trvale odstraní při nejbližším denním
  úklidu.
- Automatický úklid chrání aktivní a mladší podúkoly; spolu s nimi zůstane
  zachovaný také jejich nadřazený úkol. Ruční odstranění chrání aktivní
  podúkoly, ale odstraní všechny dokončené položky bez ohledu na jejich stáří.
- Ruční mazání je omezené RLS na úkoly přihlášeného uživatele a automatická
  úloha je dostupná pouze serverové roli.

## Spolehlivé obnovení Microsoft připojení

- Obnova expirovaného Microsoft Graph tokenu používá stejný tenant jako
  přihlášení a OAuth callback, nikoli obecný endpoint `/common/`.
- Oprava platí pro Microsoft To Do i online dokumentové funkce, které sdílejí
  stejný bezpečný token helper.
- Release nemění Entra konfiguraci, client ID, client secret ani oprávnění.

## Ověření

- Kompletní testovací sada, TypeScript, webový build, desktop kompilace,
  dependency audit, dokumentace a kontroly architektury prošly před vydáním.
- Databázová migrace a Edge Functions byly ověřené v produkčním Supabase
  projektu; databáze po nasazení neobsahuje čekající migrace.
- Release artefakty jsou sestavené a ověřené lokálně před nahráním na GitHub.
