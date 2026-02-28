# Viki security model

## Security cíle
- Zabránit úniku interních a citlivých dat.
- Vynucovat tenant izolaci a roli uživatele.
- Omezit model output na bezpečný obsah pro daný audience režim.

## Trust boundaries
- UI a lokální stav jsou nedůvěryhodné pro autorizaci.
- Autorizační rozhodnutí patří na server (DB policies + edge function checks).
- Všechny authed function calls musí mít platný access token.

## Authorization model
- `invokeAuthedFunction` vyžaduje aktivní session token.
- `ai-proxy` ověřuje token proti Auth API a provádí subscription check.
- `memory-load`/`memory-save` používá organizační kontext (`organization_members`) a tenant path ve storage.
- Projektová data v query vrstvě jsou limitována DB oprávněními (RLS/policies).

## Audience režimy
- `internal`
  - širší interní kontext
  - stále blokuje technicky citlivé detaily (api key, service role, interní dekonstrukce)
- `client`
  - strict allowlist
  - blokace interních poznámek, interního rozpočtu, marže a dalších interních informací

## Guard chain (pořadí je závazné)
1. `guardSensitiveOutput`
2. `guardRoleRestrictedOutput`
3. `guardClientFacingOutput` (jen v `client` režimu)

Pokud guard blokuje obsah, vrací se bezpečná náhradní hláška.

## Ochrana proti zneužití
- Prompt injection: mitigace přes systémový prompt + guardy + scope omezení.
- Data exfiltrace: mitigace přes audience allowlist, role guard a tenant authorization.
- Přístup mimo oprávnění: mitigace přes server-side auth + RLS.

## Pravidla pro plánovaný skill `Shrnutí projektu`
- Povinný aktivní projekt (`selectedProjectId`).
- Projekt musí být dostupný aktuálnímu uživateli.
- Žádné globální dotazy přes všechny projekty bez explicitního oprávnění.
- Interní citlivé údaje jsou defaultně maskované; plné odkrytí jen explicitně a auditovaně.

## Threat scénáře (minimum)
- Uživatel zkusí získat data cizího projektu.
- Uživatel v klientském režimu zkusí vyžádat interní finance.
- Model vrátí text obsahující citlivý vzor (`api key`, `service role`).

Každý scénář musí mít test v `docs/viki/testing.md`.
