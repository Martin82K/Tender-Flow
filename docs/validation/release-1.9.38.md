# Validace Windows sestavení 1.9.38

Ověřeno lokálně 18. 9. 2026 na macOS Apple Silicon. Rozsah zahrnuje sloučené změny do `f2b2f1a7` (vodorovný sidebar, Objednatel a CRUD protokolů) a patch bump z 1.9.37. Verze 1.9.37 zůstává stažená z distribuce. Sestavuje se pouze Windows x64, bez macOS artefaktů.

- Vitest: 549 souborů, 3 046 úspěšných testů, žádné skip/todo ani neošetřené chyby.
- Typecheck, web build, ověření web dist, desktop compile, docs, boundaries a legacy structure prošly.
- Windows NSIS build s `toolsets.nsis=1.2.1` prošel včetně kontroly ASAR. Verze uvnitř ASAR je 1.9.38. Instalátor, blockmap a latest.yml odpovídají verzi; velikost a SHA-512 metadata ověřil projektový release verifier.
- Lockfile diff mění pouze verzi aplikace. Root audit: 5 moderate / 2 low, bez high/critical. Desktop audit: 0. Registry podpisy: 854 root a 116 desktop; attestace 143 a 5.
- Updater loopback test se skutečným electron-updater prošel (výběr zdroje, fallback, odmítnutí chybného SHA-512).
- Produkční web preview: úvodní stránka → přihlášení, verze 1.9.38, vyplnění formuláře, bez page/console/network errors. Přihlášené sidebar a CRUD toky byly ověřeny při PR #479 a #481 včetně mobilu.
- Databázová migrace `20260918125709_document_protocol_crud.sql` je nasazená; transakční CRUD a autorizační test prošel s rollbackem. Závěrečný dry-run databáze hlásí aktuální stav.

## Omezení

Instalátor nemá Authenticode podpis. Na tomto macOS hostu nelze potvrdit skutečnou Windows instalaci a kompletní aktualizaci nainstalované aplikace; loopback test ji nenahrazuje. Známé širší bezpečnostní nálezy a neuzavřená licenční review z [validace 1.9.37](release-1.9.37.md) zůstávají mimo rozsah patch bumpu. Bez nových závislostí a bez další databázové změny.

Kontrola web dist byla nejprve omylem spuštěna nad desktopovým výstupem, který záměrně negeneruje veřejné právní routy. Samostatný web build a následná kontrola web dist poté prošly; Windows instalátor obsahuje správné desktopové podklady.

## Zpřesnění testů po CI

První CI běh měl 3 045 úspěšných testů a jediný neúspěšný test DSR výmazu: syntetická změna ThemedNativeSelect nevybrala ověření identity. Testy nyní používají skutečné otevření comboboxu a kliknutí na option u všech zbývajících jednoduchých selectů tohoto souboru (kanál, ověření, CRM stav a retention policy). Očekávané payloady a zákaz automatického mazání se nemění. Všech 22 ComplianceAdmin testů po opravě prošlo. Jde pouze o testovací interakce, ne změnu aplikačního kódu nebo Windows artefaktů.
