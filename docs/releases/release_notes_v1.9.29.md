# Tender Flow v1.9.29

Vydání přináší export přehledu stavby do Excelu a spolehlivější přidávání
dodavatelů do pipeline.

- Přehled stavby lze exportovat do formátovaného Excelu s firemním vzhledem.
  Formátování zůstává souvislé i u prázdných buněk.
- Přidání dodavatele čeká na potvrzené uložení a blokuje opakované odeslání.
  Opakovaný pokus aktualizovaných klientů zachovává již uloženou nabídku,
  její cenu a stav; potvrzené položky se neztrácejí při částečném selhání.
- Veřejné informace a FAQ odpovídají aktuální nabídce Enterprise, Mistral AI,
  řízeným zápisům MCP a propojení TODO Osobní s Microsoft To Do. Opravené jsou
  také údaje provozovatele a zastaralá tvrzení o offline režimu.

Windows nadále kontroluje oba distribuční repozitáře; dokončení aktualizace
vyžaduje restart aplikace. macOS Apple Silicon používá ruční aktualizaci.
Instalátory pro obě platformy vznikají lokálně a publikují se shodně do obou
repozitářů.

Oprava pipeline využívá již nasazenou serverovou migraci. Uživatelé při
instalaci databázi nemění. Toto vydání nepřidává ani neaktualizuje závislosti.

Windows instalátor nadále nemá Authenticode podpis. macOS používá ad-hoc
podpis a není notarizovaný.
