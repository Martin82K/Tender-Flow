# Tender Flow

Tender Flow je full-stack CRM pro řízení stavebních výběrových řízení,
projektů, dodavatelů, smluv, dokumentů a navazujících týmových procesů.
Aplikace běží jako webová aplikace a jako desktopová aplikace postavená na
Electronu. Cloudová data, autentizaci a serverové funkce zajišťuje Supabase.

Aktuální verze repozitáře: **1.8.12**.

## Rychlý start

Požadavky:

- Node.js 22,
- npm,
- hodnoty `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` v `.env.local`.

```bash
npm install
npm run dev
```

Ověření změn:

```bash
npm run test:run
npm run typecheck
npm run build
npm run desktop:compile
npm run check:boundaries
npm run check:legacy-structure
npm run check:docs
```

Lokální Supabase stack ani Docker nejsou potřeba pro běžný vývoj webu nebo
desktopu. Jsou relevantní pouze pro úlohy, které výslovně používají lokální
Supabase emulaci.

## Dokumentace

Kompletní technický rozcestník je v [docs/README.md](docs/README.md).

Nejdůležitější vstupy:

- [Katalog funkcí](docs/product/feature-catalog.md)
- [Systémová architektura](docs/architecture/system-overview.md)
- [Vývojové prostředí](docs/development/getting-started.md)
- [Konfigurace](docs/development/configuration.md)
- [Testovací strategie](docs/development/testing.md)
- [Bezpečnostní model](docs/security/security-model.md)
- [Deployment a release](docs/operations/deployment-and-release.md)
- [Troubleshooting](docs/operations/troubleshooting.md)

## Hlavní technologie

- React 19, TypeScript a Vite
- Tailwind CSS 4
- TanStack React Query
- Supabase Auth, Postgres, Realtime, Storage a Edge Functions
- Electron 40
- Vitest a Testing Library

## Pravidla přispívání

- Funkční změna musí mít testy a aktualizovanou dokumentaci.
- Neočekávaný `console.error` nebo `console.warn` shodí test.
- Webová vrstva nesmí přímo importovat desktop main proces ani serverové moduly.
- Legacy kořeny jsou ve freeze režimu; před merge musí projít oba architektonické
  guardy.
- Tajné klíče patří pouze do lokálního prostředí nebo secret managementu, nikdy
  do repozitáře.
- Nový balíček nesmí být mladší než 14 dní.

Podrobnosti jsou v [AGENTS.md](AGENTS.md).

All rights reserved.
