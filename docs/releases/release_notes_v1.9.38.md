# Tender Flow v1.9.38

- Obnovený vodorovný přepínač Stavby / Dodavatelé / Přehledy / Nástroje v rozbaleném sidebaru a mobilním menu. Sbalený panel zachovává svislé ikony.
- Sekce dokumentů používá označení **Objednatel**.
- Předávací protokoly subdodavatelů podporují vytvoření, zobrazení, úpravu a potvrzené smazání. Opraveno tiché selhání založení při neplatném filtru smlouvy; chybějící smlouva nebo oprávnění mají jasné vysvětlení.
- Smazání zachovává historii verzí, přílohy a potvrzení skutečného předání pro audit. Souběžné změny chrání kontrola verze.

Obsahuje také změny z verze 1.9.37 stažené z distribuce: nový kompaktní sidebar a příručku, cenové nabídky u smluv, dokumenty subdodavatelů, opravy Google přihlášení, notifikací a organizačních licencí. Podrobnosti jsou v [poznámkách k 1.9.37](release_notes_v1.9.37.md).

## Distribuce

Tato verze se sestavuje pouze pro **Windows x64**. Instalátor, blockmap a metadata automatických aktualizací vznikají lokálně. macOS sestavení není součástí vydání. Verze závislostí se nemění. Vyžaduje již nasazené databázové migrace včetně `20260918125709_document_protocol_crud.sql`.
