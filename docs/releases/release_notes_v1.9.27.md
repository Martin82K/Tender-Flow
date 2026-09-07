# Tender Flow v1.9.27

Přechodové vydání přidává druhý veřejný zdroj aktualizací Windows aplikace.

## Spolehlivější aktualizace

- Aplikace kontroluje `Martin82K/Tender-Flow-Releases` i původní `Martin82K/Tender-Flow` a vybere nejnovější způsobilou verzi. Při shodě upřednostní nový repozitář.
- Nedostupný zdroj neblokuje druhý. Kontrola má časový limit a po jeho překročení lze zahájit nový pokus.
- Při síťové chybě instalátoru lze stáhnout identickou kopii stejné verze z druhého zdroje. Kontrola SHA-512 a případného podpisu zůstává zachovaná; při chybě integrity se nepřepíná.
- Souběžné kontroly a opožděné odpovědi nenaruší probíhající stahování. Chyby spuštění instalátoru se dál zobrazují uživateli.

## Přechod na nový distribuční repozitář

Stejné lokálně sestavené instalační soubory tohoto vydání se publikují do obou repozitářů. Verze 1.9.26 a starší tak mohou získat nový updater z původního zdroje.

Původní repozitář zůstává během přechodu veřejný. Před jeho případným přepnutím na private je potřeba ověřit aktualizaci starší instalace na 1.9.27 a následnou aktualizaci z nového zdroje.

## Instalátory

- Windows x64: instalátor `.exe` s automatickou aktualizací.
- macOS Apple Silicon: `.dmg` a `.zip`; aktualizace zůstává manuální.
- Web i desktop používají verzi 1.9.27.

Vydání nevyžaduje novou databázovou migraci.
