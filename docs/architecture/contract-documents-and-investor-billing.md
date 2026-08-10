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

Desktop předá podepsaný odkaz přes autentizovaný shell IPC. Politika povolí
pouze HTTPS, přesný Supabase origin z build konfigurace, bucket
`contract-documents`, očekávanou cestu `projects/.../contracts/...pdf|docx` a
neprázdný podpisový token. Celá podepsaná URL se neloguje.

Klient před uploadem ověřuje limit 20 MB, příponu, MIME typ a základní signaturu
PDF nebo ZIP kontejneru DOCX. Bucket stejný limit a MIME allowlist vynucuje
znovu. OCR používá samostatný dočasný objekt, který se po zpracování odstraní;
jeho krátkodobá URL se neukládá ani neloguje.

V editaci smlouvy lze přílohu připojit, nahradit nebo odpojit. Náhrada se nejprve
nahraje pod novou náhodnou cestu, potom se přepojí databázová metadata a až po
úspěšném zápisu se odstraní původní objekt. Při chybě zápisu se nový objekt
uklidí. Odpojení nejprve vyčistí metadata smlouvy a potom odstraní objekt ze
Storage, takže chyba úklidu nevytvoří nefunkční odkaz. Uživatel je na případný
neúspěšný úklid upozorněn.

Smazání smlouvy vždy vyžaduje potvrzení. Nejprve se přes projektovou RLS smaže
databázový záznam; návazné dodatky, čerpání, faktury a interní verze se řeší
definovanými cizími klíči. Následně klient přes Storage API uklidí originál
smlouvy a dokumenty dodatků. Cesty před smazáním procházejí allowlistem tvaru
`projects/{projectId}/contracts/{safeName}.pdf|docx`.

## Export tabulky smluv

Tabulkové zobrazení smluv nabízí lokální export do `.xlsx`. Workbook obsahuje
logo Tender Flow, organizaci a projekt, datum a čas exportu, verzi aplikace a
jméno přihlášeného uživatele. Datová část zachovává částky, procenta
a datumy jako typované Excel hodnoty, používá filtry, zmrazené záhlaví,
zalomení dlouhých textů a tiskové rozložení na šířku.

Export nevytváří nový serverový záznam a neposílá data třetí straně. Textové
hodnoty začínající znaky vyhodnocovanými tabulkovými aplikacemi jako vzorec se
zapisují jako text, aby otevření souboru nespustilo formula injection.

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
