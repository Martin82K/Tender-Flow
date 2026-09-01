# Nastavení pluginu Tender Flow v ChatGPT

Stav: ověřeno 2026-09-01

Tento dokument je samostatný návod pro přidání produkčního MCP serveru Tender
Flow jako soukromého pluginu v ChatGPT. Nevyžaduje změnu aplikace, databáze ani
MCP serveru.

## Předpoklady

- Uživatel je přihlášený do správného účtu ChatGPT.
- Uživatel má aktivní účet Tender Flow a oprávnění k datům, která chce číst.
- V ChatGPT je povolený režim vývojáře pro vlastní pluginy.
- Produkční MCP endpoint odpovídá na `https://www.tenderflow.cz/api/mcp`.

## Otevření formuláře

1. V ChatGPT otevřít **Nastavení → Pluginy**.
2. Zvolit **Procházet pluginy**.
3. Kliknout na tlačítko **+** pro vytvoření nového pluginu.

## Základní pole

| Pole | Hodnota |
| --- | --- |
| Ikona | `assets/icons/256x256.png` |
| Název | `Tender Flow` |
| Popis | `Správa stavebních výběrových řízení, nabídek, kontaktů a úkolů v Tender Flow.` |
| Připojení | `URL serveru` |
| URL serveru MCP | `https://www.tenderflow.cz/api/mcp` |
| Ověření | `OAuth` |

Ikona má rozměry 256 × 256 px, formát PNG a velikost přibližně 5,8 KB. Splňuje
limit ChatGPT 10 KB. V lokálním checkoutu ji najdete relativně ke kořeni repozitáře:

```text
assets/icons/256x256.png
```

## Pokročilé nastavení OAuth

Po zadání MCP URL otevřít **Pokročilá nastavení OAuth** a vyplnit následující
hodnoty.

### Registrace klienta

| Pole | Hodnota |
| --- | --- |
| Způsob registrace | `Uživatelem definovaný klient OAuth` |
| Klientské ID OAuth | `c6d04896-33d1-4cca-a7f2-8d380ed26f0d` |
| Tajný klíč klienta OAuth | ponechat prázdné |
| Způsob ověřování koncového bodu tokenů | `none` |

Použitý klient je veřejný OAuth klient `ChatGPT Tender Flow`. Client secret se
nesmí doplňovat. Přihlášení používá Authorization Code Flow s PKCE.

> Nepoužívat Client ID `9a9b2e02-5e83-4c1f-8a6f-15c7a88d9066` označené jako
> `ChatGPT Tender Flow 2`. OAuth token sice vydá, ale produkční MCP jej aktuálně
> nepřijímá a ChatGPT následně zobrazí chybu připojení bez dostupných akcí.

### Výchozí rozsahy

Zaškrtnout:

- `openid`
- `email`
- `profile`

Pole **Základní rozsahy** ponechat prázdné. Tender Flow může při OAuth flow
navíc požádat o `offline_access`, aby bylo možné bezpečně obnovit přístup bez
opakovaného přihlášení.

### Koncové body OAuth

Tyto hodnoty ChatGPT načte automaticky z metadat MCP serveru. Před vytvořením
pluginu je pouze zkontrolovat:

| Pole | Hodnota |
| --- | --- |
| URL autorizace | `https://vpvowigatikngnaflkyk.supabase.co/auth/v1/oauth/authorize` |
| Adresa URL tokenu | `https://vpvowigatikngnaflkyk.supabase.co/auth/v1/oauth/token` |
| Registrační adresa URL | ponechat prázdné |
| Základní adresa autorizačního serveru | `https://vpvowigatikngnaflkyk.supabase.co/auth/v1` |
| Zdroj | `https://www.tenderflow.cz/api/mcp` |

Dynamic Client Registration není pro Tender Flow zapnutá. Proto musí být
vybraný uživatelem definovaný klient a uvedené Client ID.

### OpenID Connect

| Pole | Hodnota |
| --- | --- |
| OIDC je povoleno | ano |
| URL konfigurace OIDC | `https://vpvowigatikngnaflkyk.supabase.co/auth/v1/.well-known/openid-configuration` |
| Koncový bod OIDC userinfo | `https://vpvowigatikngnaflkyk.supabase.co/auth/v1/oauth/userinfo` |
| Podporované rozsahy OIDC | `openid`, `profile`, `email`, `phone`, `offline_access` |

## Vytvoření a připojení

1. Zaškrtnout **Rozumím a chci pokračovat** až po kontrole, že URL skutečně
   směřuje na doménu `www.tenderflow.cz`.
2. Kliknout na **Vytvořit**.
3. V dialogu **Přidat konektor Tender Flow do ChatGPT** kliknout na
   **Přihlásit se přes Tender Flow**.
4. Na stránce Tender Flow zkontrolovat, že aplikace je `ChatGPT Tender Flow`.
5. Zkontrolovat požadovaná oprávnění a kliknout na **Schválit přístup**.

Výchozí souhlas dovoluje pouze:

- ověření identity, e-mail, základní profil a obnovu přístupu;
- čtení projektů, výběrových řízení, smluv, plánů a termínů v rozsahu
  oprávnění přihlášeného uživatele.

Kontaktní údaje ani zápis nejsou výchozím OAuth souhlasem povoleny. Tyto
možnosti vyžadují samostatný grant v Tender Flow v **Nastavení → Nástroje →
MCP přístupy**.

## Kontrola výsledku

V **Nastavení → Pluginy → Tender Flow** ověřit:

- stav připojení není `Znovu připojit`;
- URL je `https://www.tenderflow.cz/api/mcp`;
- podporovaná autorizace je `OAuth`;
- v části **Akce** jsou načtené MCP nástroje;
- v běžném chatu lze provést read-only dotaz, například vypsat dostupné
  projekty Tender Flow.

Vlastní MCP plugin používat v běžném režimu Chat. Agentní režim Work nemusí
vlastní aplikace zpřístupnit.

## Řešení problémů

### Plugin je připojený, ale nejsou dostupné žádné akce

Nejčastější příčinou je chybné Client ID. Ověřit, že je použito:

```text
c6d04896-33d1-4cca-a7f2-8d380ed26f0d
```

ChatGPT neumožňuje Client ID existujícího pluginu upravit. Chybně vytvořený
vývojářský plugin je nutné odstranit a založit znovu se správným Client ID.

### ChatGPT hlásí „Něco se pokazilo při nastavování připojení“

1. Ověřit správné Client ID podle tohoto dokumentu.
2. Ověřit, že OAuth souhlas uvádí aplikaci `ChatGPT Tender Flow` bez přípony
   `2`.
3. Ověřit, že MCP URL obsahuje `www`: `https://www.tenderflow.cz/api/mcp`.
4. Plugin znovu připojit a dokončit nový OAuth flow.
5. Pokud se akce stále nenačtou, zkontrolovat produkční MCP audit a serverový
   allowlist `MCP_ALLOWED_CLIENT_IDS` bez vypisování tokenů nebo secretů.

### Bezpečnostní poznámky

- Nikdy nevkládat Supabase `service_role`, secret key, bearer token ani refresh
  token do formuláře ChatGPT.
- OAuth Client ID uvedené v tomto dokumentu je veřejný identifikátor, nikoliv
  tajný klíč.
- Přístup lze kdykoliv odebrat v ChatGPT i v Tender Flow.
- Rozšířená oprávnění ke kontaktům a zápisu udělovat pouze záměrně a na
  nezbytnou dobu.
