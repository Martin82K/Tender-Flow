# Frontend a routing

## Start aplikace

1. `index.tsx` inicializuje React aplikaci.
2. `app/AppShell.tsx` skládá providers, SEO, toast systém, nápovědu a cookies.
3. `components/providers/AppProviders.tsx` zapojuje React Query, Auth, UI a
   Feature context.
4. `app/AppContent.tsx` rozhoduje o loaderu, chybě, veřejné route, autentizaci,
   právních podmínkách, tarifu a výsledném view.
5. `app/views/LazyViews.tsx` načítá hlavní feature views dynamicky podle
   `app/featureRegistry/manifests.ts`.

## Provider pořadí

```text
QueryClientProvider
  AuthProvider
    UIProvider
      FeatureProvider
        SeoManager
        ToastProvider
          HelpProvider
            AppContent
```

Pořadí je důležité: FeatureProvider potřebuje identitu a UI/feature komponenty
mohou používat React Query cache.

## Routing

Router je lehká vlastní implementace v `shared/routing/router.tsx`.

- Web používá `history.pushState`/`replaceState` a `popstate`.
- Electron při `file:` protokolu používá hash routing.
- Interní odkazy používají `Link` nebo `navigate()`.
- `_blank` odkazy automaticky dostávají `noopener noreferrer`.
- URL se sestavují přes `buildAppUrl` a parsují přes `parseAppRoute`.
- Neznámá app route přesměruje na `/app/todo`.

Route synchronizaci s vybraným projektem, tabem a kategorií řídí
`app/hooks/useRouteStateSync.ts`.

## Veřejné a autentizační route

Mimo hlavní app views existují zejména:

- přihlášení, registrace, zapomenuté heslo, reset hesla a MFA,
- OAuth consent pro MCP,
- právní stránky,
- krátké odkazy `/s/:code`,
- veřejný/landing obsah.

`AuthGate` rozhoduje, kterou autentizační obrazovku zobrazit. Parametr `next`
se zachovává při přesměrování uživatele k přihlášení.

## Feature registry a lazy loading

`app/featureRegistry/manifests.ts` mapuje každý `View` na:

- stabilní ID modulu,
- route a navigační metadata,
- požadované capabilities,
- dynamický `mount()` import,
- kontrolní hooky pro bezpečný unmount.

Registry je kanonický seznam hlavních navigačních modulů. Vnitřní projektové
taby a podsekce nastavení mají vlastní routing uvnitř feature.

## Feature gating

Feature klíče a výchozí plány jsou v `config/features.ts`. Runtime dostupnost
poskytuje `FeatureContext`; `RequireFeature` zobrazí fallback, pokud uživatel
capability nemá. Gating v UI zlepšuje UX, ale nesmí nahrazovat serverovou
autorizaci.

## Server state

TanStack React Query spravuje data ze serveru:

- query keys jsou stabilní a doménově sdílené,
- výchozí `staleTime` je 5 minut,
- ne-auth chyby se retrynou jednou,
- auth chyby spouštějí centralizovanou session recovery,
- mutace invalidují související query keys,
- nezávislé requesty se spouštějí paralelně.

Query hooky patří do feature vrstvy. Staré importy mohou dočasně zůstat jako
kompatibilní re-exporty v `hooks/queries/`.

## Lokální a globální stav

- Komponentový stav: formuláře, otevřené panely, lokální navigace.
- React Query: vzdálená data a stav jejich načítání.
- AuthContext: session, uživatel, MFA a právní acceptance.
- AuthIdentityContext: read-only projekce `id`, `email`, `role` pro feature
  datové hooky, query a mutace bez přístupu k tokenům nebo auth akcím; zdrojem
  zůstává AuthContext.
- FeatureContext: tarif a capabilities.
- UIContext: modály a sdílené UI akce.
- ToastContext: krátkodobé informační zprávy.
- URL: navigovatelný stav view, projektu a vybraných tabů.

Nový globální context se přidává jen tehdy, když stav skutečně sdílí více
nezávislých větví UI.

## Chyby a loading

- `AppLoadingView` zobrazuje postup základního načítání.
- `AppLoadErrorView` zobrazuje stabilní error code a incident referenci.
- Neočekávané runtime chyby se sanitizují před logováním.
- Feature moduly mají lokální loading/empty/error stavy.
- Uživatel nesmí dostat syrový backend error obsahující tokeny nebo PII.

## Styling a UI

- Tailwind CSS 4 a existující design tokeny.
- Sdílená primitiva jsou v `shared/ui/`.
- Feature specifické komponenty zůstávají u feature.
- Theme, skin, primary color a UI scale řídí `useTheme` a uživatelské preference.
- Přístupnost dialogů využívá sdílené dialog utility a role-based Testing
  Library selektory.

## Importní pravidla

Preferované aliasy:

```text
@app/*      -> app/*
@features/* -> features/*
@shared/*   -> shared/*
@infra/*    -> infra/*
@/*         -> root fallback
```

Feature nesmí importovat legacy `components/`; shared nesmí importovat feature.
UI nesmí přímo importovat Supabase klienta ani přistupovat k main procesu.
