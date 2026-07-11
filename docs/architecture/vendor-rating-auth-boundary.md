# Auth hranice hodnocení dodavatele

Stav: implementováno a cíleně lokálně ověřeno, 11. července 2026

## Kontext a rozsah

Hodnocení dodavatele se upravuje v `VendorRatingDialog` na detailu smlouvy.
Původní dialog četl celý legacy `AuthContext`, dovoloval pokus o zápis bez
identity i v demo režimu a posílal klientem zadané `vendor_rating_by` a čas přes
obecný update smlouvy. Backendovou chybu zobrazoval uživateli bez sanitizace.

Nová hranice se týká pouze uložení a smazání hodnocení a poznámky. Ostatní
editace smlouvy nadále používají obecný `updateContract` a nejsou součástí této
změny.

## Datový tok

```text
AuthProvider
  → AuthIdentityContext (id, email, role)
  → VendorRatingDialog
  → contractMutationsApi.updateVendorRating
  → contractService.updateVendorRating
  → update_contract_vendor_rating RPC (SECURITY INVOKER)
  → existující contracts SELECT/UPDATE RLS
  → public.contracts
```

Klient posílá pouze ID smlouvy, rating a poznámku. Neposílá session, access
token, refresh token, autora ani auditní čas.

## Platná write identita a chybové kódy

Zápis je povolen pouze neprázdné normalizované identitě s rolí odlišnou od
`demo`. Jinak zůstávají hvězdy, poznámka, save i clear bez zápisové akce.

| Kód | Stav | Veřejná zpráva |
| --- | --- | --- |
| `CONTRACT_VENDOR_RATING_AUTH_REQUIRED` | identita chybí nebo má prázdné ID | Pro úpravu hodnocení je nutné přihlášení. |
| `CONTRACT_VENDOR_RATING_DEMO_READ_ONLY` | role je `demo` | Demo režim je pouze pro čtení. |
| `CONTRACT_VENDOR_RATING_SAVE_FAILED` | RPC, RLS nebo navazující refresh selže | Hodnocení se nepodařilo uložit. Zkuste to prosím znovu. |

Syrový backend payload se do UI nekopíruje.

## Payload a auditní metadata

- rating 1–5 a oříznutá poznámka se předají RPC,
- kliknutí na aktivní hvězdu změní rating na `null`; neprázdná poznámka zůstane,
- explicitní clear předá rating i poznámku jako `null`,
- prázdná nebo whitespace poznámka se v databázi normalizuje na `null`,
- pokud existuje rating nebo poznámka, databáze nastaví `vendor_rating_by` z
  `auth.uid()` a `vendor_rating_at` z `NOW()`,
- při úplném clear nastaví databáze autora i čas na `null`,
- rozsah ratingu 0–5 kontroluje RPC i existující databázový constraint.

Poznámka bez hvězdiček tedy nově dostává autora a auditní čas. Klient nemůže
podvrhnout autora jiným UUID.

## Serverová autorizace

RPC je `SECURITY INVOKER`, takže nebypassuje RLS a update probíhá s oprávněními
volajícího. Execute je odebrán rolím `PUBLIC` a `anon` a přidělen pouze
`authenticated`. Funkce navíc odmítne chybějící `auth.uid()`.

Nejnovější verzovaná contracts RLS vyžaduje zapnutý modul smluv a vlastnictví
projektu nebo project share s právem `edit`; stejný predikát je v `USING` i
`WITH CHECK`. Odpovídající SELECT policy umožní UPDATE řádek vůbec nalézt.

Po update RPC kontroluje `ROW_COUNT = 1`. RLS zamítnutí, chybějící smlouva nebo
jiný nulový update se proto nevrátí jako falešný úspěch. Tento návrh odpovídá
[doporučení Supabase pro invoker funkce a function privileges](https://supabase.com/docs/guides/database/functions)
a [požadavkům UPDATE RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Async změna identity

Dialog zachytí identitu, která operaci zahájila. Při přepnutí A → B:

- dialog zavolá `onClose` a resetuje rozepsaný lokální stav,
- pending stav a chyby A se pod B nezobrazí,
- pozdní success A nespustí `onSaved` pro B,
- pozdní rejection A nezobrazí B chybu,
- dokončení po unmountu nemění UI ani nespouští callback.

Již odeslaný databázový request nelze klientským přepnutím identity prohlásit
za zrušený. Jeho autorizaci a autora určuje session použitá RPC requestem.

## Testovací plán

- [x] Architektonický RED/GREEN guard zakazuje legacy AuthContext v dialogu.
- [x] Uložení používá dedicated RPC a ořezává poznámku.
- [x] Clear posílá dvě hodnoty `null`.
- [x] Note-only varianta zachová oříznutou poznámku.
- [x] Chybějící, demo a whitespace identita jsou fail-closed bez API.
- [x] Backendová chyba se sanitizuje a nespustí success callback.
- [x] Stale success i stale error po A → B se ignorují.
- [x] Unmount během requestu nespustí completion callback.
- [x] Service předává přesné RPC parametry a propaguje chybu.
- [x] Migrační kontrakt ověřuje invoker, autora, čas, row count a grants.
- [x] Kompletní Vitest, typecheck, docs, boundaries, legacy freeze, web build,
  desktop compile a dependency audit.

## Cílený výsledek

Behaviorální RED běh selhal ve všech 8 scénářích dialogu. Kombinovaný RED běh
navíc prokázal chybějící API metodu, migraci a jednu legacy context vazbu. Po
implementaci prošlo 5 cílených souborů a 20 testů bez stderr výstupu.

Architektonický dluh klesl ze 70 na 69 vazeb. Feature→legacy context nálezy
klesly z 39 na 38. Přesný rozsah změny prošel 307 souborů a 1 448 testů; celý
pracovní strom včetně nesouvisejícího updater testu prošel 308 souborů a 1 449
testů. Oba Vitest logy byly bez stderr a bez varování.

TypeScript, dokumentační odkazy, boundaries, legacy freeze, web build, desktop
compile a dependency audit také prošly. Build zachoval známá Vite upozornění na
smíšené statické/dynamické importy a chunky nad 750 kB; tato změna je nezavedla.
Vzdálené CI zůstane autoritativním výsledkem navazujícího PR.

## Deployment, rollback a manuální ověření

Změna obsahuje migraci
`20260711182852_secure_contract_vendor_rating.sql`. Repository test potvrzuje
její textový kontrakt, nikoli stav nasazení v konkrétní databázi. V souladu s
rozhodnutím projektu se zde nepřidává živý integrační RLS test.

Po aplikaci migrace nestačí pro databázový rollback pouze vrátit Git commit.
Je nutná nová dopředná migrace s
`DROP FUNCTION public.update_contract_vendor_rating(UUID, NUMERIC, TEXT)` a
současný klient musí být před jejím nasazením vrácen na obecný update.

Ručně pod účtem A:

1. uložit hvězdičky s poznámkou a po refreshi ověřit hodnoty,
2. uložit pouze poznámku a potom hodnocení explicitně smazat,
3. autorizovaně ověřit databázový `vendor_rating_by` a `vendor_rating_at`,
4. se síťovým throttlingem zahájit save a přepnout na B; B nesmí zdědit dialog,
   chybu ani refresh A,
5. bez přihlášení a v demo režimu ověřit stabilní kód a absenci RPC requestu,
6. uživatel bez edit práva musí dostat bezpečnou chybu a řádek se nesmí změnit.
