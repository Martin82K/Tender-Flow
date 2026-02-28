# Markdown output standard pro Viki

## Cíl
Sjednotit výstupy Viki do čitelného markdown formátu a zároveň zachovat bezpečnost renderu.

## Aktuální stav
- UI dnes vykresluje odpověď jako plaintext (`whitespace-pre-wrap`).
- Markdown syntax se zatím nerenederuje jako strukturovaný obsah.

## Cílový stav
- Viki odpovídá strukturovaně v Markdownu.
- UI renderuje bezpečný Markdown subset.

## Povolený subset (safe)
- Nadpisy: `##`, `###`
- Seznamy: odrážkové a číslované
- Tučné, kurzíva, inline code
- Code block
- Tabulky
- Odkazy (`https`), s `rel="noopener noreferrer"`
- Blockquote

## Zakázané prvky
- Raw HTML
- Skriptovatelné atributy (`on*` eventy)
- `javascript:` odkazy
- iframe/embed prvky
- Neomezené externí assety bez validace

## Doporučená šablona odpovědi
```md
## Executive summary

## Co se změnilo

## Rizika

## Doporučené kroky
```

## Security pravidla renderu
- Před renderem sanitizovat výstup.
- Nevykreslovat raw HTML.
- Zachovat existující guard chain i při markdown renderu.

## Akceptace
- Markdown výstup je čitelný a konzistentní.
- Zakázané prvky se bezpečně odfiltrují.
- Client režim nikdy neprolomí security policy přes markdown formát.
