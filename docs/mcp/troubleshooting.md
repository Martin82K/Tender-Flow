# Troubleshooting MCP

Stav: známé diagnostické větve k 2026-08-09
Zdroj pravdy: HTTP handler, token validation, scope policy a provozní logy

| Příznak | Pravděpodobná příčina | Bezpečný postup |
| --- | --- | --- |
| 401 + `WWW-Authenticate` | chybí/neplatný token | načíst metadata, zopakovat OAuth; token nelogovat |
| „client is not allowed“ | client ID není v allowlistu | ověřit fingerprint/ID a schválení klienta |
| resource/audience mismatch | token vydán pro jiné API | vyžádat nový token s kanonickým MCP resource |
| tool není v katalogu | chybí interní permission | vlastní OAuth scope nepomůže; ověřit serverovou policy/grant |
| data jsou prázdná | RLS, filtr nebo skutečně žádná data | ověřit stejný účet/projekt v TF; neobcházet RLS |
| project not visible | chybné ID nebo oprávnění | znovu získat ID přes list/search a ověřit roli |
| confirm text mismatch | text nebyl přesně převzat | zobrazit nový přesný text; negenerovat jej ručně |
| proposal expired | uplynulo 10 minut | vytvořit nový proposal a znovu potvrdit |
| invalid execute token | token je chybný/použitý | nevypisovat token; připravit nový proposal |
| pouze návrh, bez execute | typ ještě není podporován | provést ručně v aplikaci; nepředstírat úspěch |
| 429 nebo sporadické limity | procesní limiter/provozní limit | omezit frekvenci; nekličkovat mezi klienty |
| chybí auditní řádek | DB/RLS/audit helper problém | korelovat hosting logy; absence není důkaz neaktivity |

## Diagnostický balíček bez secretů

Zaznamenat čas v UTC, request/correlation ID, tool/resource, HTTP status,
protokolovou verzi, anonymizovaný user/client identifikátor, OAuth scopes a
interní permissions,
hosting region a bezpečně redigovanou chybu. Nezaznamenávat Authorization
header, cookie, execute token, celé kontakty nebo dokumentové URL.

Při podezření na cross-tenant nebo neoprávněný zápis se diagnostika mění na
bezpečnostní incident podle [runbooku](operations-runbook.md).
