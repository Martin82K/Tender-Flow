# Lokální zpracování Excel ZIP

Všechny lokální vstupy pro odemčení XLSX používají
`shared/tools/excel/excelUnlockZip.ts`, včetně legacy re-exportu a nativního
provideru. Celé rozbalení, úprava worksheet XML a opětovné zabalení běží
v bundlovaném workeru. Při dokončení, chybě přenosu, chybě parseru nebo vypršení
60sekundového limitu se worker ukončí. Není povolen synchronní fallback při
nedostupném workeru. Kopírování vstupu zachovává původní buffer a respektuje
rozsah `Uint8Array`; soubor neopouští zařízení.

## ZIP64 parser a ověření

Přímá závislost je připnuta na `fflate` 0.8.3, které již obsahuje opravu
ZIP64 parseru začleněnou v PR #423. Připnutí nemění vyřešenou verzi ani
integritu balíčku v lockfile. PostHog byl z aplikace odstraněn; žádná jeho
závislost ani override se nevrací.

Regresní test `tests/fflateZip64.security.test.ts` izoluje parser v Node workeru
s pevným limitem a ověřuje odmítnutí chybějících ZIP64 metadat i přijetí
platného ZIP64 a běžného ZIPu. `tests/excelUnlockZip.zip64.test.ts` navíc
spouští skutečné jádro odemykání v odděleném procesu a kontroluje neplatná
i platná ZIP64 pole. `tests/excelUnlockWorker.test.ts` ověřuje ukončení workeru,
timeout, chyby, původní vstupní buffer a další pokus. Testy Excelu kontrolují
zachování hodnot, vzorců, formátování, metadat, médií a nechráněných listů.

Worker omezuje dobu operace a umožňuje její přerušení při zablokování parseru.
Není samostatným limitem rozbalené paměti ani úplným auditem ostatních importních
nástrojů. Nezavádí nové síťové požadavky, oprávnění ani změny CSP. Uspání nebo
pozastavení aplikace může odložit obsluhu časovače hlavním vláknem.
