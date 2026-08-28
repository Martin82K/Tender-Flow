# Tender Flow v1.9.20

Opravný patch zastavuje opakované vytváření stejných úkolů v Microsoft To Do
a zpřesňuje ruční úklid dokončených osobních úkolů.

## Synchronizace bez kopií

- Do Microsoft To Do se nově exportují pouze osobní TODO úkoly.
- Úkoly navázané na stavbu nebo výběrové řízení se do Microsoft To Do vůbec
  neposílají, takže nezakládají nové kopie ani Outlook upozornění.
- Již propojený a nezměněný úkol se při opakované synchronizaci znovu
  nevytváří; synchronizace provede zápis jen při změně.
- Aktivní historické kopie se automaticky nemažou podle shodného názvu, aby
  nedošlo ke smazání legitimního uživatelského úkolu.

## Vymazání hotových úkolů

- Pohled Hotovo obsahuje jednoznačnou akci **Vymazat vše hotové**.
- Potvrzení předem zobrazí počet úkolů, které budou trvale odstraněny.
- Aktivní podúkoly dokončeného úkolu zůstanou zachované jako samostatné osobní
  úkoly a mohou se dále synchronizovat.
- Mazání je omezené na data přihlášeného uživatele a nelze je spustit anonymně.

## Ověření

- Regresní testy pokrývají oddělení osobních a projektových úkolů,
  idempotentní Graph zápis a úplné odstranění dokončených úkolů.
- Kompletní testovací sada, webový build, desktop kompilace, dokumentace a
  kontroly architektonických hranic prošly před vydáním.
- Databázová migrace a Microsoft To Do Edge Function byly nasazené a ověřené
  v produkčním Supabase projektu.
- Release artefakty byly sestavené a ověřené lokálně před nahráním na GitHub.
