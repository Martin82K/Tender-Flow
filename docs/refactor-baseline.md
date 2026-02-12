# Refactor Baseline

## Scope
- Refaktor struktury webové části + úklid kořene repozitáře.
- Bez změny business logiky a bez změny veřejného chování aplikace.

## Aktuální stav (po inkrementálních přesunech)
- `app`: 10 souborů
- `components`: 70 souborů
- `features`: 32 souborů
- `shared`: 22 souborů
- `hooks`: 19 souborů
- `services`: 35 souborů
- `context`: 3 soubory
- `config`: 6 souborů
- `utils`: 14 souborů
- `tests`: 29 souborů

## Největší rizikové soubory (LoC)
- `components/Pipeline.tsx` (~2198)
- `components/ProjectOverviewNew.tsx` (~1896)
- `features/settings/ExcelIndexerSettings.tsx` (~1196)
- `services/exportService.ts` (~1080)
- `hooks/useDocHubIntegration.ts` (~1038)

## Import profil
- Alias `@/`: 159 importů
- Alias `@app/`: 9 importů
- Alias `@infra/`: 2 importy
- Relativní importy: 455

## Dokončené kroky
- Kořenová karanténa legacy souborů do `archive/legacy-root/`.
- Release poznámky sjednocené do `docs/releases/`.
- Založené vrstvy `features/` a `shared/`.
- Přesuny A-C:
  - `components/ui/*` -> `shared/ui/*`
  - `components/routing/*` -> `shared/routing/*`
  - `components/auth/*` -> `features/auth/ui/*`
  - `components/public/*` -> `features/public/ui/*`
  - `components/settings/*` -> `features/settings/*`
  - `components/tools/*` -> `features/tools/*`
- Inkrementální start řezu D:
  - Hlavní entry komponenty přesunuty do `features/projects/*` a `features/contacts/*`.
  - V původních cestách `components/*` ponechány kompatibilní re-exporty.

## Security baseline
- Beze změny runtime politiky CORS/CSP v `server/securityHeaders.js`.
- Produkce implicitně bez wildcard CORS originu.

## No-surprises pravidlo
- Refaktor pouze přesuny, import mapování, guardrails a dokumentace.
- Žádné změny DB schémat ani externích API kontraktů.
