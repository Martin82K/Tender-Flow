# Dokumenty smluv a fakturace investora

## Dokument smlouvy

Originální dokument smlouvy se ukládá do privátního bucketu
`contract-documents`. Databáze neukládá podepsanou URL, ale pouze cestu,
původní název, ověřený MIME typ a velikost. Cesta má tvar:

`projects/{projectId}/contracts/{randomUuid}.pdf|docx`

Storage RLS povoluje čtení vlastníkovi projektu a explicitně sdíleným
uživatelům. Zápis a smazání jsou omezené na vlastníka a uživatele s právem
`edit`; všechny operace vyžadují modul `module_contracts`. Při otevření klient
vytvoří podepsaný odkaz s platností 15 minut.

Klient před uploadem ověřuje limit 20 MB, příponu, MIME typ a základní signaturu
PDF nebo ZIP kontejneru DOCX. Bucket stejný limit a MIME allowlist vynucuje
znovu. OCR používá samostatný dočasný objekt, který se po zpracování odstraní;
jeho krátkodobá URL se neukládá ani neloguje.

## Založení smlouvy přes OCR

OCR pouze předvyplňuje whitelistovaná doménová pole. Neznámá pole, neplatné
datumy, IČ, procenta, měny a URL se ignorují. Uložení je během OCR zakázané a
uživatel musí výsledek potvrdit. Zaškrtnutá volba připojení originálu vede k
trvalému uploadu před vytvořením databázového záznamu; při chybě vytvoření se
objekt uklidí.

## Investor

`project_investor_financials` obsahuje základní smlouvu a výchozí procenta
pozastávek. `project_amendments` uchovává číslo a datum dodatku.
`project_investor_invoices` ukládá období a vypočtené částky pozastávek. Hodnota
`NULL` ve sloupci procenta znamená dědění globální hodnoty stavby; explicitní
hodnota včetně nuly je individuální výjimka faktury. Změna globálního procenta
proto přepočítá všechny děděné faktury, ale nepřepíše schválené výjimky.

Pro vystavenou částku `G` platí:

- `A = round(G × retentionAPercent / 100, 2)`
- `B = round(G × retentionBPercent / 100, 2)`
- `k úhradě = max(0, G − A − B)`
- `uhrazeno = 0`, dokud faktura není označena jako zaplacená; pak nejvýše čistá
  částka k úhradě.

Databázové CHECK podmínky zakazují záporné hodnoty, součet procent nad 100 % a
úhradu vyšší než částka po odečtení pozastávek.
