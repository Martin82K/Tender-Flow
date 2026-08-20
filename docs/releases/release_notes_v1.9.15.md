# Tender Flow v1.9.15

Patch opravuje tenantovou viditelnost kontaktů. Kontakty vytvořené členem
organizace bez explicitního `organization_id` se nyní bezpečně přiřadí jeho
jediné aktivní organizaci, takže je vidí všichni aktivní členové stejného
tenantu.

## Kontakty

- Všech 11 aktivních členů Baustavu nyní vidí shodně 1 394 kontaktů.
- Dodavatel SUAS reSTAV je dostupný účtům `kalkus@baustav.cz` i
  `dorrerova@baustav.cz`.
- Databázový trigger chrání i starší klienty, které tenantový identifikátor
  neposílají.
- U uživatele s více aktivními organizacemi databáze neprovede nejednoznačný
  výběr a vyžádá explicitní tenant.

## Bezpečnost a data

- RLS zůstává omezena na přímého vlastníka nebo aktivní členství ve stejné
  organizaci; oprava nezavádí globální viditelnost kontaktů.
- Duplicate guard zůstává aktivní a historické duplicity se nemažou ani
  neslučují.
- Do Baustavu bylo bezpečně převedeno 374 kontaktů jeho aktivních členů.
  Zbývajících 28 osobních kontaktů mimo tento scope zůstalo beze změny.
- Privilegované pomocné funkce jsou v privátním schématu s odebranými veřejnými
  právy a prázdným `search_path`.

## Ověření

- Produkční migrace `20260820101425_assign_contacts_to_member_tenant.sql` byla
  aplikována a ověřena přímou RLS impersonací obou dotčených účtů.
- Kompletní CI, Vercel, dependency audit, registry signatures, TypeScript,
  webový build, desktop compile, dokumentační a architektonické kontroly prošly.
- Release artefakty jsou sestaveny a ověřeny lokálně z verze 1.9.15; GitHub
  Actions je k release nepřipojuje ani nepřepisuje.

## Známé zbytkové riziko

Automatizovaný Codex code review nebyl dostupný kvůli vyčerpanému limitu.
Změna proto prošla lokálním bezpečnostním auditem RLS, produkčním rollback
dry-runem a dvěma plnými CI průchody.
