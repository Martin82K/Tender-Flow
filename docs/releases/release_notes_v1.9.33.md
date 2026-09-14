# Tender Flow v1.9.33

Jedna smlouva může pokrývat více výběrových řízení ve stejné stavbě.
V Přehledu smlouvy lze přidat volné VŘ, přejít na jeho kartu nebo po potvrzení
odpojit jednotlivou vazbu. Dokumenty, faktury a ostatní vazby zůstávají zachované;
cena smlouvy se počtem propojení nenásobí.

- Příjemce běžné i materiálové poptávky se vybírá přímo na kartě dodavatele.
  Společně se mění jméno, e-mail a telefon. Výběr nemění hlavní kontakt adresáře.
- Generovaný koncept si uchová příjemce z okamžiku zahájení přípravy.
  Další změna kontaktu platí až pro další koncept. Hromadný koncept používá
  adresáty z rekapitulace; karty bez platné adresy jsou přeskočené.
- Zapamatování kontaktu probíhá na pozadí a neblokuje přípravu poptávky.
  Případná chyba se zobrazí; po úplném obnovení stránky se načte uložený kontakt.
- Kontaktní blok je přehlednější: bez typů „Hlavní“ či „OZ“, samostatného
  editačního odkazu a trvalého rámečku zavřeného výběru. Jeden kontakt nemá menu.
  Klávesnicový fokus, editace tužkou, dvojklik a přetahování karty zůstávají.
- Ve webu se již nespouští lokální DocHub filesystem fallback určený pro Electron.
  Cloudové providery a hlášení skutečných chyb zůstávají zachované.
- Lokální produkční náhled standardně používá již povolený port 5173 a při jeho
  obsazení skončí chybou. Oprava nevyžaduje rozšíření CORS ani nasazení funkcí.
- Tři samostatné PDF návody se screenshoty skutečných komponent a syntetickými
  ukázkovými údaji jsou v repozitáři ve složce `output/pdf/novinky-2026-09-14`.

Migrace sdílených smluv byla nasazena 14. 9. 2026 před frontendem.
Vydání nepřidává závislosti. Rozpracované změny pozastávek z PR #457 nejsou
součástí této verze, protože jejich produkční migrace dosud čeká na schválení.

Generování e-mailu připravuje koncept; stav „Odesláno“ sám nepotvrzuje doručení
ani skutečné odeslání e-mailu. Autentizovaná synchronizace Microsoft účtu
a vytváření skutečných zákaznických složek nebyly při release testu prováděny.

Instalátory vznikají lokálně a publikují se shodně do obou distribučních
repozitářů. Windows používá aktualizaci s restartem; macOS Apple Silicon ruční
aktualizaci. Windows instalátor nemá Authenticode podpis. macOS používá ad-hoc
podpis a není notarizovaný. Úplný test instalace a aktualizace na Windows
nebyl na tomto macOS proveden.
