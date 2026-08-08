# Projektové týmy, archiv a smluvní přehled

Autoritativním zdrojem projektového přístupu je vlastník v `projects.owner_id` a role v `project_shares`. UI oprávnění pouze zobrazuje; zápisy vždy ověřují databázové RPC, RLS a write guardy.

| Projektová role | Čtení | Úpravy aktivní stavby | Správa týmu | Archivace/obnova | Schvalování výběru |
| --- | --- | --- | --- | --- | --- |
| Vlastník projektu | ano | podle oprávnění modulu | ano | ano | jen explicitním budoucím krokem |
| Administrátor projektu | ano | podle oprávnění modulu | ano | ano | jen explicitním budoucím krokem |
| Projektový manažer | ano | podle oprávnění modulu | ne | ne | jen explicitním budoucím krokem |
| Člen týmu | ano | podle oprávnění modulu | ne | ne | jen explicitním budoucím krokem |
| Pouze čtení | ano | ne | ne | ne | ne |

Archivovaná stavba zůstává viditelná původnímu týmu v Archivu, ale databáze odmítá nové a měněné projektové záznamy, úkoly, schválení a navazující smluvní operace. Obnovu provádí výhradně vlastník nebo administrátor projektu přes `set_project_archived`.

„Smluvní přehled“ je samostatné organizční oprávnění. Aktivní vlastník a administrátor organizace je mají automaticky. Jen běžnému aktivnímu členovi lze uložit explicitní grant `contract_overview_access`; RPC pokus o explicitní grant ownerovi/adminovi odmítne.

Výstup `get_contract_overview` je read-only allowlist základních identifikátorů, partnera, stavu, ceny, souhrnného schváleného čerpání, zbývající částky a vybraných časových/garančních parametrů. Neobsahuje nabídky, rozhodnutí výběru, technické dokumenty, URL dokumentů, extrakční JSON ani jednotlivé faktury. Každé úspěšné načtení zapisuje počet výsledků a volbu archivu do auditní tabulky.

Historická sdílení mimo organizaci jsou při migraci označena `legacy_external` a změněna na roli `viewer` s oprávněním `view`. Nové členy týmu lze vybírat pouze z aktivních členů stejné organizace.

Budoucí schvalování výběru má používat samostatnou tabulku zadání a kroků workflow s konkrétními adresáty, termínem a auditní stopou. Nesmí být odvozeno automaticky z projektové role.
