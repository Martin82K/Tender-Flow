# Tender Flow v1.9.31

Opravné vydání stabilizuje připojení AI přes MCP a souběžné používání více
zařízení.

- Přesměrování při připojení MCP pokračuje po obnovení přihlášení automaticky,
  bez ručního obnovení stránky.
- Účet může používat až deset přihlášení webu, desktopu a mobilu dohromady
  a dalších deset OAuth připojení každého MCP klienta.
- Nové připojení už do tohoto limitu neruší předchozí OAuth relaci ani její
  obnovovací tokeny. Jedenácté přihlášení nahradí pouze nejstarší ve stejné skupině.
- Běžné odhlášení odpojí pouze aktuální zařízení; ostatní zařízení a MCP
  klienti zůstávají připojení.
- Nově povolený nebo obnovený přístup ke kontaktům platí 180 dní. Zápisová
  oprávnění zůstávají do odvolání. Existující kontaktní grant se automaticky
  neprodlužuje.

Již zrušená OAuth připojení je potřeba jednou připojit znovu. Oprávnění a
odpojení celého MCP klienta jsou společná pro všechna jeho připojení na účtu.
Přístup nadále respektuje práva uživatele ke stavbám a změny obchodních dat
přes MCP vyžadují potvrzení.

Databázové migrace pro 180 dní a souběžná připojení byly nasazeny a ověřeny.
Vydání nemění závislosti.

Windows kontroluje oba distribuční repozitáře a dokončení aktualizace
vyžaduje restart aplikace. macOS Apple Silicon používá ruční aktualizaci.
Instalátory pro obě platformy vznikají lokálně a publikují se shodně do obou
repozitářů.

Windows instalátor nadále nemá Authenticode podpis. macOS používá ad-hoc
podpis a není notarizovaný.
