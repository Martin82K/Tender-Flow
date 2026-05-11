# Tender Flow Security TODO

Priorita je serazena podle dopadu na data, tenant isolation a lokalni filesystem.
Kazdy bod musi mit pred uzavrenim regresni test nebo opakovatelnou validaci.

## P0

- [x] Zpevnit Electron auth boundary: renderer nesmi nastavovat main-process auth stav pouhym booleanem.
- [x] Zuzit desktop filesystem IPC: defaultne nepovolovat cely home adresar a sjednotit realpath allowlist pro read/write/watch/Python vstupy.
- [x] Opravit Supabase tenant isolation: `maybe_create_org_join_request`, `projects.organization_id` update a `subcontractors.organization_id` insert/update.

## P1

- [x] Zpevnit DocHub OAuth: TTL state, atomicke consume-before-use, provider identity binding a validace desktop tokenu.
- [x] Redigovat MCP audit logy a nastavit OAuth allowlist/resource/scope kontroly fail-closed.
- [x] Opravit Stripe webhook trust boundary: tier odvozovat z price ID, overovat metadata konzistenci a nesupresovat retry po failed eventu.
- [ ] Pridat AI/map cost-abuse limity: provider/model allowlist, per-user/per-org kvoty, token/input limity a rate limiting pro drahe akce.
- [x] Zabezpecit Node Excel merge API autentizaci, CORS allowlistem, workbook limity a izolovanym zpracovanim.

## P2

- [x] Escapovat untrusted hodnoty v HTML e-mail templates a pridat finalni sanitizer pred `.eml`.
- [ ] Omezit short URL abuse: dokumentovat accepted risk, zvazit interstitial a blokovat `http`, credential URL a privatni hosty.
- [x] Sjednotit filename sanitizaci pro Excel download headery.
- [ ] Nahradit nebo izolovat zranitelny `xlsx@0.18.5` v klientskem importu kontaktu.

## Verification Gate

- [x] Focused security regression tests pro kazdou opravu.
- [x] `npm run test:run`
- [x] `npm run desktop:compile`
- [x] `npm run check:boundaries`
- [x] `npm run check:legacy-structure`
