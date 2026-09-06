# Tender Flow v1.9.26

Patch přináší rychlejší načítání aplikace, rozšířené hledání a opravy práce s Excelem.

## Projekty a hledání

- Detail projektu se načítá až při otevření; při chybě lze načtení zopakovat.
- Globální hledání zahrnuje úkoly a umožňuje otevřít konkrétní detail smlouvy.
- Úkoly lze otevírat přímým odkazem.
- Částečné uložení kategorie má samostatné upozornění a možnost obnovit synchronizaci plánu výběrových řízení.
- Kontrola dostupnosti projektových složek je rychlejší.

## Excel a výkon

- Opraveno zachování stylů při slučování Excel souborů v Pythonu.
- Lokální odemykání Excelu běží ve workeru a předává výsledek bez zbytečné kopie bufferu.
- Opraveno zpracování ZIP/ZIP64 souborů; odstraněno nepoužívané TypeScript Excel API.
- Interní aplikace a Excel moduly se načítají odloženě; společné styly jsou menší.
- Odstraněna integrace PostHog a opraveny známé zranitelnosti závislostí.

## Předplatné

- Správa balíčků odděluje přehled funkcí od pokročilých úprav.
- Přístup do aplikace vyžaduje platné předplatné; bez něj je dostupná obrazovka pro obnovu přístupu.

## Verze a desktop

- Web i desktop používají verzi 1.9.26.
- Instalační soubory pro macOS (Apple Silicon) a Windows (x64) se sestavují a ověřují lokálně. GitHub Actions nevkládá soubory do GitHub Release.
- Publikace čeká na uzavření nevyřešených release připomínek v PR #417 a #430, kontrolu výsledného commitu a ověření instalačních souborů.
