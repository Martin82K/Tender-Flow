## Tender Flow v1.9.0-beta.9

Tato beta verze navazuje na beta.8 a sjednocuje obrazovku Kontakty / Soupis
subdodavatelů se společným systémem vzhledu Tender Flow.

### Kontakty ve všech skinech

- Přepínač Karty / Seznam / Mapa, globální hledání a kontaktní akce tvoří jednu
  kompaktní lištu s jedinou zřetelnou primární akcí Přidat kontakt.
- Povrchy toolbaru, filtrů, karet a kontaktních modalů používají centrální
  skinové tokeny místo pevných modrých a slate barev.
- Classic, Industrial, Botanica i Nature respektují světlý a tmavý režim;
  sémantické chybové a stavové barvy zůstávají zachované.
- Aktivní, hover a focus stavy mají společný tokenový kontrast a vyhledávání má
  explicitní přístupný název.

### Kvalita a bezpečnost

- Regresní testy ověřují strukturu toolbaru, jedinou primární akci a absenci
  prezentačních modrých tříd v kontaktních komponentách.
- Změna nepřidává závislosti, nemění oprávnění, IPC, autentizaci ani databázové
  schéma.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- Windows instalátor sestavený lokálně na macOS vyžaduje finální runtime smoke
  test ve Windows prostředí.
- macOS build bez dostupné Developer ID identity není notarizovaný ani podepsaný
  pro distribuci mimo vývojové prostředí.
