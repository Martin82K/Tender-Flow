# Oprava sdílení historických kontaktů

Migrace `20260925081917_restore_baustav_shared_contacts.sql` řeší jednorázové
přiřazení 20 prověřených historických kontaktů organizaci Baustav.

## Rozsah a ochrany

- Záznam nemá organizaci, vznikl před 20. 8. 2026 a jeho vlastník je neaktivní
  člen cílové organizace bez jiného aktivního členství.
- Existuje vazba přes nabídku/stavbu nebo smlouvu na cílovou organizaci.
  Každá dohledatelná vazba musí patřit této organizaci; existující stavba nebo
  smlouva bez organizace je překážka. Při preflightu bylo zjištěno šest starých
  nabídek odkazujících na chybějící kategorie/stavby u dvou z těchto kontaktů.
  Oba mají také platné vazby na Baustav a stejného původního vlastníka.
  Tato známá neúplnost je zaznamenána v historii opravy; přesný počet šest vazeb
  na dvou kontaktech je další brána. Nová odchylka nasazení zastaví.
- Kontakty jiných vlastníků, bez vazeb, novější záznamy a záznamy jiné organizace
  jsou mimo opravu. Dva další zkoumané kontakty jiného vlastníka nejsou zahrnuté.
- Jednoznačnost organizace a přesný počet se kontrolují pod zámky. Při odchylce
  nebo kolizi názvu migrace selže atomicky; existující duplicate trigger zůstává.
- Mění se pouze `organization_id`, `owner_id` a `updated_at`. Organizace je
  vlastníkem (`owner_id = NULL`), proto záznam nezávisí na účtu bývalého autora
  a původní autor nezíská osobní přístup mimo členství.
- RLS, předplatné, grants, indexy, cizí klíče a identifikátory zůstávají zachované.
  Nejde o nové sdílení s veřejností nebo mezi organizacemi.

## Ověřování a návrat

`tests/postgres/contactScopeRepair.test.mjs` používá syntetická data a skutečné
existující triggery. Ověřuje členství, odebrání členství, bývalého vlastníka,
cizí organizaci, anonymní přístup, předplatné, editaci, odstranění původního
účtu, zachování obsahu/vazeb/katalogu, duplicity, odchylku počtů, opakování
migrace a rollback transakce.

Před nasazením spustit linked dry-run a přesný SQL soubor uvnitř transakce
zakončené `ROLLBACK`. Po nasazení porovnat počty a otisky obsahu/vazeb,
ověřit přístup pod `authenticated` pro členy a nečleny, spustit security a
performance advisors a závěrečný linked dry-run.

Neveřejná tabulka `private.baustav_contact_scope_repair_20260925` uchovává
původní přiřazení a čas změny, cílovou organizaci, otisk nezměněného obsahu
a počet známých neúplných vazeb.
Neukládá jména, e-maily ani obsah kontaktů. RLS je zapnuté a žádná klientská
role včetně `service_role` nemá grant. Historie nemá FK na uživatele či kontakt,
takže neblokuje jejich odstranění a neobnoví smazaný obsah.

Případný návrat po commitu musí být nová prověřená migrace: pod zámkem ověřit
existenci záznamů, cílové přiřazení, otisk obsahu a absenci následných změn;
obnovit tři původní hodnoty z historie. Znovu prověřit členství původního
vlastníka, protože existující tenant trigger by při novém aktivním členství
mohl přiřazení změnit. Neobnovovat smazané kontakty a nepřepisovat pozdější
uživatelské úpravy. Automatický rollback endpoint se nevytváří.

Úspěšné opakování migrace se řídí uzavřenou historií opravy a nezasahuje do
pozdějších úprav nebo odstranění kontaktů. Není to obecný automatický převod
osobních kontaktů podle toho, kdo je použije ve stavbě.
