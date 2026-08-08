# Chyby a limity MCP

Stav: aktuální chování implementace k 2026-08-09
Zdroj pravdy: MCP schemas, data adaptéry, auth handler a rate limiter

## Třídy chyb

| Vrstva | Typický signál | Význam |
| --- | --- | --- |
| HTTP auth | 401 + `WWW-Authenticate` | token chybí, je neplatný nebo vyžaduje autorizaci |
| Origin | zamítnutý HTTP request | browser Origin není v přesném allowlistu |
| Protocol/schema | JSON-RPC invalid params / SDK chyba | header/body, metoda nebo argumenty neodpovídají kontraktu |
| Scope | tool není v listu nebo scope error | klient nemá potřebné oprávnění |
| RLS/doména | tool `isError` + bezpečná zpráva | uživatel nevidí objekt nebo operace selhala |
| Rate limit | tool/resource error | překročen procesní limit user/client/tool okna |
| Write state | proposal/token/status/expiry error | neplatná fáze bezpečného zápisu |

Autentizační chyba se nesmí převádět na úspěšný tool result. Naproti tomu chyba
uvnitř registrovaného toolu je vrácena jako `{ ok: false, error }` a
`isError: true`, aby ji klient odlišil od doménového prázdného výsledku.

## Vstupní a datové limity

- Obecné listy mají maximálně 20 položek na volání; některé fallbacky jsou
  nižší (například projekty 12).
- `search.query`: 1–500 znaků; list search: nejvýše 200 znaků.
- `fetch.id`: nejvýše 200 znaků.
- deadline rozsah: 1–365 dní.
- task title: 1–500 znaků; note: nejvýše 10 000; priority: celé číslo 1–4.
- reason/confirmation text: nejvýše 1000 znaků.
- proposal expiruje za 10 minut.
- idempotency key: 8–200 znaků; execute token: 20–500 znaků na vstupu.
- organization ID smluvního resource musí být UUID.

Server normalizuje search whitespace, číselné hodnoty a currency kódy. Limity
chrání latenci a velikost kontextu, nejsou náhradou stránkování. Současný MCP
nepublikuje cursor pagination; klient má filtrovat dotazy a nesnažit se
obcházet limit paralelními požadavky.

## Rate limit

Klíč zahrnuje uživatele, OAuth klienta a tool/resource. Okno a limit se liší
podle rizika. Implementace je `in-memory` a procesní: po restartu se resetuje a
více instancí nesdílí čítače. Konkrétní čísla jsou implementační detail do
zavedení distribuovaného limiteru a nemají být klientskou garancí.
