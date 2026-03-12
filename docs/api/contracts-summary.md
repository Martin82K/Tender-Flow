# Contracts Summary API

## Účel

Endpoint `GET /projects/:projectId/contracts/summary` vrací zjednodušený přehled smluv pro:
- UI přehled v záložkách `Smlouvy` a `Čerpání`
- export do Excelu a PDF
- budoucí integrace nad Tender Flow API

Contract-first přístup znamená, že UI, export i API používají stejný datový kontrakt `ContractSummaryDto`.

## Autentizace a tenant scope

- Endpoint je pouze read-only.
- Vyžaduje autentizovaného uživatele Tender Flow.
- Výsledek je omezený na organizaci uživatele a projekt, ke kterému má přístup.
- Endpoint nesmí vracet raw OCR, markdown verze dokumentů ani interní metadata zpracování.

## Query parametry

- `q`
  Fulltext nad `contractNumber`, `vendorName`, `title`
- `status`
  Jeden z `active`, `draft`, `closed`, `cancelled`
- `sort`
  Aktuálně `vendor_asc`

Pokud parametr chybí:
- `q` = prázdný řetězec
- `status` = všechny stavy
- `sort` = `vendor_asc`

## Response shape

```json
[
  {
    "id": "contract-1",
    "projectId": "project-1",
    "title": "VZT",
    "contractNumber": "SOD-2026-001",
    "vendorName": "KLIMA - ELEKTRON s.r.o.",
    "status": "active",
    "currency": "CZK",
    "basePrice": 100000,
    "currentTotal": 125000,
    "approvedSum": 30000,
    "remaining": 95000,
    "retentionPercent": 5,
    "retentionAmount": null,
    "siteSetupPercent": 2,
    "warrantyMonths": 24,
    "paymentTerms": "21 dní",
    "signedAt": "2026-02-01",
    "effectiveFrom": "2026-02-05",
    "effectiveTo": "2026-12-20",
    "scopeSummary": "Vzduchotechnika a související montáže"
  }
]
```

## Význam polí

- `basePrice`
  Původní hodnota smlouvy
- `currentTotal`
  Aktuální hodnota smlouvy včetně dodatků
- `approvedSum`
  Schválené čerpání
- `remaining`
  Zbývající částka do vyčerpání
- `retentionPercent`
  Pozastávka v procentech, pokud je k dispozici
- `retentionAmount`
  Pozastávka částkou, pokud procenta nejsou známá
- `siteSetupPercent`
  Podíl zařízení staveniště v procentech
- `paymentTerms`
  Splatnost nebo text platebních podmínek

## Fallbacky

- Chybějící hodnoty mohou být `null` nebo vynechané v API odpovědi.
- UI a export je převádí na `-`.
- API nesmí dopočítávat neověřená data mimo již existující smluvní agregace.

## Chybové stavy

- `401 Unauthorized`
  Chybějící nebo neplatná autentizace
- `403 Forbidden`
  Uživatel nemá přístup k projektu nebo organizaci
- `404 Not Found`
  Projekt neexistuje nebo neleží v tenant scope
- `400 Bad Request`
  Nepodporovaný filtr nebo řazení

## Verzování

- První publikace bude vedena jako `v1`.
- Nová pole lze přidávat pouze zpětně kompatibilně.
- Změna významu pole nebo odstranění pole vyžaduje novou verzi endpointu.

## Bezpečnostní omezení

- Nevracet `documentUrl`, OCR text, markdown historii ani interní confidence metadata.
- Respektovat tenant isolation na úrovni organizace a projektu.
- Endpoint je určen pouze pro summary data.
