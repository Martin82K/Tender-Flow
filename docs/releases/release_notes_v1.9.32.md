# Tender Flow v1.9.32

Detail smlouvy nově rozděluje práci do záložek Přehled, Dokumenty, Fakturace,
Pozastávky a Předání a záruka.

- Předávací protokol se předvyplní ze smlouvy, stavby, organizace a navázaného
  subdodavatele. Používá logo organizace a patičku s původem, datem a verzí.
- Vady a nedodělky lze upravit a doplnit o 5 nebo 10 prázdných řádků pro ruční
  zápis. K dispozici je skutečný PDF náhled a editovatelný DOCX.
- Dokumenty uchovávají historii verzí; finální PDF nebo DOCX lze přiložit
  ke konkrétní verzi. Průvodka subdodávky je zatím připravovaná.
- Skutečné předání a počátek záruky se potvrzují samostatně, s autorem, datem
  a zdrojem. Vytvoření nebo nahrání dokumentu je samo nepotvrzuje a neuvolňuje
  pozastávky. Tabulkový XLSX export používá potvrzený počátek záruky.
- Smlouvy a karty výběrového řízení se vzájemně propojují a umožňují návrat
  na zdrojovou kartu. Opravené je zpracování dlouhých identifikátorů.
- Desktop lépe zobrazuje stav připojení složek a registrace respektuje výchozí
  nastavení šablon.

Migrace dokumentů, privátního úložiště a auditovaného předání byla nasazena
před frontendem. Historické podpisy ani termíny dokončení se automaticky
nepřevádějí na počátek záruky. Vydání nepřidává závislosti.

Windows kontroluje oba distribuční repozitáře a dokončení aktualizace
vyžaduje restart aplikace. macOS Apple Silicon používá ruční aktualizaci.
Instalátory pro obě platformy vznikají lokálně a publikují se shodně do obou
repozitářů.

Windows instalátor nadále nemá Authenticode podpis. macOS používá ad-hoc
podpis a není notarizovaný. Úplný test instalace a aktualizace na Windows
nebyl na tomto macOS proveden.
