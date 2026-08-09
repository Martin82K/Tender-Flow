# Začínáme s vývojem

## Požadavky

- Node.js 22 (stejná major verze jako CI),
- npm,
- Git,
- Supabase veřejná URL a anon/publishable klíč,
- pro desktop podporovaný macOS nebo Windows build host podle cíle.

Docker není požadavek běžného runtime ani standardního web/desktop vývoje.
Supabase CLI ho může požadovat pouze pro lokální emulaci databáze/funkcí.

## Instalace

```bash
git clone <repository-url>
cd Tender-Flow
npm install
```

Nové dependency se nepřidávají automaticky. Před instalací ověřte účel,
licenci, registry integritu, podpis/provenance (pokud je dostupná), zdrojový
repozitář, historii maintainerů a vydání, známé zranitelnosti a oznámené
incidenty kompromitace. Stáří verze je pouze rizikový signál, nikoli pevná
čekací lhůta.

Po změně závislostí spusťte:

```bash
npm audit --audit-level=high
npm audit signatures
```

Výsledek auditu sám o sobě nestačí: zkontrolujte také změnu lockfile a zda
instalace nepřidala neočekávané balíčky, install skripty nebo nové maintainery.

## Lokální konfigurace

V kořeni vytvořte necommitnutý `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_ANON_KEY=public-anon-or-publishable-key
```

Další hodnoty jsou volitelné podle feature. Viz [konfigurace](configuration.md).

## Web

```bash
npm run dev
```

Vite zobrazí lokální adresu. Interní routing na webu používá history API.

Produkční kontrola:

```bash
npm run build
npm run preview
```

## Desktop

```bash
npm run desktop:dev
```

Příkaz spustí Vite na `127.0.0.1:3000`, zkompiluje desktop TypeScript a otevře
Electron. Desktop může vyžadovat OS oprávnění pro biometriku, notifikace nebo
filesystem.

Samostatná kompilace:

```bash
npm run desktop:compile
```

## Testy a kvalita

Při iteraci spusťte cílený test:

```bash
npm run test:run -- tests/nazev.test.ts
```

Před předáním:

```bash
npm run test:run
npm run typecheck
npm run build
npm run desktop:compile
npm run check:boundaries
npm run check:legacy-structure
npm run check:docs
npm audit --audit-level=high
npm audit signatures
```

`console.error` a `console.warn` musí být v negativním testu explicitně
očekávané; jinak test selže.

## Orientace v repozitáři

| Potřeba | Kam jít |
| --- | --- |
| nový hlavní view | `features/<domain>/` + feature registry |
| feature model/query | `features/<domain>/model` nebo `hooks` |
| DB/external adapter | `infra/` |
| sdílené UI | `shared/ui/` |
| globální composition | `app/` |
| desktop OS operace | `desktop/main/` + preload/IPC |
| serverová secret operace | Supabase Edge Function nebo `server/` |
| typy domény | `types.ts` nebo feature-local type |
| test | `tests/` |
| dokumentace | `docs/` |

## Doporučený postup změny

1. Přečíst okolní kód a dokumentaci.
2. Zapsat testovací plán.
3. Přidat regresní test a zachytit RED stav.
4. Implementovat nejmenší bezpečnou změnu.
5. Spustit cílené a potom úplné kontroly.
6. Aktualizovat dokumentaci a známá omezení.
7. Vytvořit PR, ověřit celý CI log a review vlákna.
8. Sloučit až při čistém výsledku.

## Legacy freeze

`components/`, `hooks/`, `services/`, `context/` a `utils/` jsou migrované
postupně. Nový soubor tam nepřidávejte bez explicitní aktualizace
`config/legacy-freeze.json`. Preferujte `app/features/shared/infra`.
