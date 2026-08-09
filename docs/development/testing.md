# Testovací strategie

## Nástroje

- Vitest 4
- Testing Library
- jsdom
- TypeScript typecheck
- Vite 8.1 produkční build (Rolldown/Oxc)
- Electron TypeScript compile
- vlastní architektonické a dokumentační guardy

Testy jsou v `tests/` a používají `*.test.ts` nebo `*.test.tsx`.

## Testovací pyramida

### Čisté modelové testy

Ověřují mapování, normalizaci, filtry, výpočty, merge algoritmy a bezpečné
defaulty bez Reactu nebo sítě. Mají být rychlé a deterministické.

### Hook/component contract testy

Ověřují query keys, enabled stavy, props, renderování, interakce a chybové větve.
Síť, Supabase, Electron a čas se mockují na hranici testu.

### Migrační/security kontrakty

Čtou SQL migrace a ověřují přítomnost/absenci kritických konstrukcí. Chrání
známé bezpečnostní opravy, ale neověřují nasazené finální schéma.

### Build a architektonické testy

- `typecheck` zachytí kontraktové chyby,
- web build ověří bundling a prerender,
- desktop compile ověří main/preload TypeScript,
- boundaries zakazují nebezpečné importy,
- legacy structure brání růstu frozen kořenů,
- docs checker ověřuje interní odkazy.

Root toolchain používá podporovanou řadu TypeScript 6.0. Webová konfigurace má
`strict: true` a současně explicitně uvádí jednotlivé strict kontroly včetně
`strictNullChecks`, `noImplicitAny` a `strictPropertyInitialization`, aby byl
baseline auditovatelný při upgradech TypeScriptu. Aliasové `paths` jsou
explicitně relativní vůči `tsconfig.json`; deprecated `baseUrl` se nepoužívá.
Desktopová konfigurace nesmí `noImplicitAny` oslabovat. Desktop main proces
používá spárované `module` a `moduleResolution` v režimu `Node16`, který
zachovává jeho CommonJS package scope bez legacy `node10` resolution. Změna
těchto pojistek nebo podporované řady kompilátoru musí mít konfigurační regresní
test v
`tests/typescriptStrictnessConfig.test.ts`. Data načtená z dynamických hranic,
například JSON z demo úložiště, musí před vstupem do query a mutační vrstvy
dostat explicitní doménový kontrakt, aby se `any` nešířilo aplikací.

Webový build používá přesně připnutou a supply-chain prověřenou řadu Vite 8.1
s React pluginem 6. Produkční chunking se konfiguruje přes
`build.rolldownOptions.output.codeSplitting`; odstraněný objektový
`rollupOptions.output.manualChunks` se nesmí vrátit. Tento kontrakt chrání
`tests/viteToolchainConfig.test.ts`, skutečnou kompatibilitu Rolldown/Oxc,
CommonJS balíčků, CSS minifikace a chunk pořadí však vždy potvrzuje až web build
a runtime smoke test webu i Electron rendereru.

Těžké exportní runtime závislosti nesmí být statickým importem startovního
rendereru. `tests/desktopCsp.test.ts` hlídá zdrojové importy a zakazuje vynucenou
`vendor-pdf` skupinu, která by dynamické PDF moduly vrátila do úvodního grafu.
`tests/exportService.lazyPdfRuntime.test.ts` navíc ověřuje, že PDF knihovny,
Markdown parser i Roboto font se inicializují teprve při PDF akci. Po změně
chunkingu je stále nutné zkontrolovat produkční manifest: `index.html` nesmí mít
PDF nebo font mezi statickými `imports` a příslušné moduly musí být dynamické.

### Runtime smoke test aplikace

Každá vývojová smyčka musí kromě automatických testů ověřit také skutečně
spuštěnou sestavenou aplikaci. Minimální webový smoke test zahrnuje:

- načtení aplikace bez prázdné stránky nebo chybového překryvu,
- jeden smysluplný hlavní uživatelský tok a navigaci,
- kontrolu výsledné URL a viditelného stavu,
- kontrolu neočekávaných chyb a warningů v konzoli a selhaných síťových požadavků,
- vizuální kontrolu výsledku pomocí screenshotu.

U změn specifických pro Electron se navíc spustí odpovídající desktopový tok,
pokud jsou v testovacím prostředí dostupná potřebná OS oprávnění. Samotný webový
smoke test nenahrazuje ověření IPC, filesystemu, biometriky ani notifikací.

## Příkazy

```bash
npm test                         # watch
npm run test:run                # jednorázově vše
npm run test:run -- tests/x.test.ts
npm run test:run -- -t "název scénáře"
npm run test:coverage
```

Coverage script existuje, ale provider `@vitest/coverage-v8` není aktuálně
instalovaný. Coverage proto není funkční CI brána a nesmí být prezentovaná jako
ověřená metrika.

## Test-first důkaz

Pro změnu chování:

1. zapsat scénáře,
2. spustit nový test proti starému kódu,
3. doložit relevantní RED příčinu,
4. implementovat,
5. spustit cílený GREEN běh,
6. spustit úplnou sadu a přečíst log,
7. spustit sestavenou aplikaci a provést runtime smoke test.

Test, který byl zelený před implementací bez dobrého důvodu, nemusí dokazovat
požadovanou změnu.

## Console guard

Globální setup zachytává `console.error` a `console.warn` včetně top-level
importů. Negativní scénář používá:

```ts
expectConsoleError("část očekávané zprávy");
expectConsoleWarn(/retry attempt/, 2);
```

Neočekávaný log, nesprávný počet i očekávaný log, který nenastane, shodí test.
Podrobnosti: [console policy](../testing/console-output-policy.md).

## Mocking pravidla

- Mockovat nejbližší externí hranici, ne samotný výsledek testované funkce.
- Žádný test nesmí nechtěně volat reálnou síť.
- Supabase a Electron API jsou deterministické mocky.
- Asynchronní práci je nutné awaitnout nebo po renderu korektně cleanupnout.
- Fake timers se vždy vracejí do real režimu.
- Přímý console spy musí ověřit obsah a obnovit původní implementaci.

## Čtení CI logu

Zelený status nestačí. Před merge ověřte:

- počet `Test Files` a `Tests` z čistého runneru,
- absenci `stderr`, unhandled rejection a failed bloků,
- že build warning není zaměněný za test failure,
- že Vercel/GitHub check odpovídá poslednímu commitu,
- že žádný test nebyl nečekaně skipped/todo.

## Databázové testy

Živé integrační RLS testy jsou aktuálně vědomě mimo scope. CI používá placeholder
Supabase hodnoty a testy nesmějí zasáhnout produkční databázi. RLS jistota je
proto založená na migracích, code review a statických regresních testech, nikoli
na automatickém end-to-end databázovém důkazu.
