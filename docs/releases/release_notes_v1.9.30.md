# Tender Flow v1.9.30

Opravné vydání zjednodušuje připojení AI klientů a povolení zápisu přes MCP.

- Při novém připojení je běžný zápis předvolený a povolí se schválením
  připojení. Pokud chcete pouze čtení, můžete jej před schválením vypnout.
- Nastavení AI a MCP přístupů obsahuje tři jednoduché přepínače: zápisové
  operace, kontaktní údaje a zápis ceny nabídky.
- U dříve připojených klientů stačí zapnout zápisové operace v nastavení
  a obnovit nástroje v AI klientovi. Lokální stdio MCP vyžaduje restart procesu.
- Diagnostika MCP vysvětlí chybějící oprávnění a odkáže na správné nastavení.
  Selhání ukládání oprávnění při připojení lze zopakovat bez opakovaného
  schvalování stejné OAuth žádosti.

Přístup nadále respektuje uživatelská práva ke stavbám. Kontaktní a finanční
oprávnění se povolují samostatně; při nové autorizaci je nutné je znovu zvolit.
Změny obchodních dat přes MCP stále vyžadují potvrzení uživatele.

Vydání zahrnuje bezpečnostní opravy závislostí js-yaml a sharp. Nepřidává
databázovou migraci.

Windows nadále kontroluje oba distribuční repozitáře; dokončení aktualizace
vyžaduje restart aplikace. macOS Apple Silicon používá ruční aktualizaci.
Instalátory pro obě platformy vznikají lokálně a publikují se shodně do obou
repozitářů.

Windows instalátor nadále nemá Authenticode podpis. macOS používá ad-hoc
podpis a není notarizovaný.
