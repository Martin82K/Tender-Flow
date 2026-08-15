# Tender Flow v1.9.5

Patch stabilizuje DocHub připojení, bezpečné ukládání desktopové relace a obnovu
rendereru po selhání dynamického importu. Vydání zůstává před publikací v režimu
draft. Automatický modal „Co je nového“ byl z aplikace odstraněn.

## DocHub a Microsoft 365

- Kanonická OneDrive/SharePoint URL s parametrem `id` nyní bezpečně mapuje
  existující složky výběrových řízení a dodavatelů; neprůhledné sharing odkazy,
  traversal, `authkey` a nepovolené hosty jsou odmítnuty.
- Sdílený uživatel může připojit vlastní delegovaný Microsoft účet pouze pro
  read-only dohledání existujících složek, aniž by změnil cestu nebo token
  vlastníka projektu.
- Desktop otevírá Microsoft OAuth v externím prohlížeči pouze na povoleném HTTPS
  hostu a po návratu obnoví osobní stav připojení.
- Nastavení jasně rozlišuje lokální synchronizovanou složku od volitelného
  online otevření přes Microsoft.

## Stabilita a bezpečnost desktopu

- Aplikace už po aktualizaci automaticky neotevírá modal „Co je nového“ ani
  neudržuje jeho stav v `localStorage`.
- Secure storage používá asynchronní Electron API, zachovává kompatibilitu se
  staršími záznamy a při nedostupné OS Klíčence bezpečně selže bez plaintext
  fallbacku a bez opakovaného ukládání.
- Vývojový desktop odmítne obsazený port 3000. Při selhání Vite preloadu provede
  nejvýše jeden řízený reload a opakovanou chybu nahradí zotavitelnou obrazovkou
  bez úniku interní URL nebo detailu chyby.
- Tranzitivní build závislost `nanoid` je aktualizována na opravenou patch verzi
  kvůli GHSA-2v37-7h3g-55p8.

## Databáze a serverové části

- Verze obsahuje migraci `20260813151843_add_dochub_personal_read_tokens.sql`,
  která rozlišuje vlastnické a osobní read-only OAuth tokeny.
- Produkční databáze migraci eviduje a katalog potvrzuje očekávané CHECK
  constrainty, složený primární klíč a zapnuté RLS bez klientských policies.
- Související Edge Functions jsou aktivní; aplikační endpointy vyžadují JWT a
  OAuth callbacky ověřují jednorázový state.

## Ověření sestavení

- Prošlo 438 testovacích souborů a 2 150 testů bez skip/todo, TypeScript,
  produkční web build, desktop compile, dokumentační, boundary a legacy kontroly.
- Root i desktop dependency audit hlásí 0 zranitelností; ověřeno je 832 + 116
  registry podpisů a 133 + 5 provenance attestací.
- Lokální Windows i macOS buildy 1.9.5 prošly kontrolou updater metadat, velikostí
  a hashů. Webový i macOS desktopový runtime smoke vykreslil přihlášení bez
  modalu „Co je nového“.
- Aktuální lokální macOS a Windows artefakty nejsou distribučním certifikátem
  podepsané. Draft lze použít pro interní kontrolu, ale release se nesmí
  publikovat bez podepsaného rebuild nebo explicitního provozního rozhodnutí.

## Povinné testy před publikací

- Na Windows ověřit instalaci a start aplikace, přihlášení, navigaci a otevření
  lokální synchronizované DocHub složky.
- Ve sdíleném projektu ověřit osobní Microsoft připojení, návrat z externího
  prohlížeče a otevření přesné online složky bez změny nastavení vlastníka.
- Nasimulovat selhání dynamického importu a ověřit zotavitelnou obrazovku namísto
  prázdného okna.
- Na macOS ověřit start DMG/ZIP sestavení a bezpečný stav při nedostupné
  systémové Klíčence.

Assety se připojí k draft release výhradně z lokálně sestaveného a ověřeného
`dist-electron/`. GitHub Actions je nesmí připojit ani přepsat.
