# Tender Flow v1.9.16

Patch rozšiřuje komunikaci v pipeline a dokončuje bezpečné připojení Grok Botu
k produkčnímu Tender Flow MCP.

## Pipeline a hromadná komunikace

- Nová akce **Doplnění informací** připraví prázdný EML koncept pro relevantní
  účastníky výběrového řízení.
- Dodavatelé jsou vloženi pouze do BCC; uživatel zůstává v poli To.
- Výběr zahrnuje jen podporované aktivní fáze a nemění stav žádné karty.
- Adresy procházejí validací, odstraněním duplicit a ochranou proti vložení
  dalších hlaviček.

## Grok Bot a MCP

- Produkční OAuth klient **Tender Flow CZ – Grok Bot** je předregistrovaný pro
  kanonický MCP endpoint s Authorization Code flow a PKCE S256.
- Podporovány jsou desktopový loopback i webový callback bez klientského
  secretu.
- Základní čtení, časově omezená kontaktní data a odvolatelný zápis se nadále
  řídí samostatnými user+client granty, projektovými právy a RLS.
- Zápisové business operace používají návrh, explicitní potvrzení a
  idempotentní provedení; přímý široký zápis do nabídek není povolen.

## Bezpečnost a kompatibilita

- Migrace registrace OAuth klienta je idempotentní a v prostředí bez externě
  spravovaného klienta provede bezpečný no-op.
- MCP tokeny, klientské secret hodnoty ani obsah Outlook zpráv se neukládají do
  veřejných tabulek ani release podkladů.
- Release nemění závislosti ani formát uživatelských dat a zachovává
  kompatibilitu s desktopovým automatickým updaterem.

## Ověření

- Oba zahrnuté změnové PR prošly kompletními testy, TypeScriptem, webovým
  buildem, desktop kompilací, dependency auditem a kontrolami architektury.
- Release artefakty se sestavují a ověřují lokálně; GitHub Actions je k release
  nepřipojuje ani nepřepisuje.
