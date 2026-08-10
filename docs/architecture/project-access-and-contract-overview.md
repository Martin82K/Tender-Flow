# Projektové týmy, archiv a smluvní přehled

Autoritativním zdrojem projektového přístupu je systémový vlastník v `projects.owner_id`, členství v `project_shares` a centrální matice `organization_role_permissions`. UI oprávnění pouze zobrazuje; zápisy vždy ověřují databázové RPC, RLS a write guardy.

Systémové vlastnictví není profesní role. Vlastník může zůstat bez profesní role, může mít samostatně přiřazenou profesní roli a může vlastnictví předat jinému aktivnímu členovi organizace. Převod nemění profesní role žádného člena.

Realizační tým používá pouze tyto profesní role: Náměstek, Hlavní stavbyvedoucí / vedoucí projektu, Stavbyvedoucí, Přípravář, Technik, Smluvní oddělení a Ekonom. Organizace nastavuje oprávnění centrálně v sekci „Role a oprávnění“ na úrovních Bez přístupu / Jen čtení / Zápis. Schvalování je samostatná hodnota a nikdy se neodvozuje ze zápisu.

Nevyplněné položky matice mají stav „K rozhodnutí“ a během přechodu zachovávají dosavadní přístup. Potvrzené výchozí hodnoty jsou:

- Smlouvy: Přípravář a Smluvní oddělení mají zápis, ostatních pět profesních rolí pouze čtení.
- Nastavení Složkomatu: Náměstek, Smluvní oddělení a Ekonom nemají přístup.
- Viditelnost konkrétního VŘ zahrnuje zobrazení odkazu na jeho složku; otevření obsahu dále ověřuje Google Drive, OneDrive/SharePoint nebo lokální operační systém.

Archivovaná stavba zůstává viditelná původnímu týmu v Archivu, ale databáze odmítá nové a měněné projektové záznamy, úkoly, schválení a navazující smluvní operace. V aktuálním konzervativním modelu obnovu provádí systémový vlastník přes `set_project_archived`; případné další oprávněné role čekají na výslovné rozhodnutí matice.

„Smluvní přehled“ je samostatné organizční oprávnění. Aktivní vlastník a administrátor organizace je mají automaticky. Jen běžnému aktivnímu členovi lze uložit explicitní grant `contract_overview_access`; RPC pokus o explicitní grant ownerovi/adminovi odmítne.

Výstup `get_contract_overview` je read-only allowlist základních identifikátorů, partnera, stavu, ceny, souhrnného schváleného čerpání, zbývající částky, vybraných časových/garančních parametrů a metadat přímo připojeného dokumentu smlouvy nebo dodatku. Neobsahuje nabídky, rozhodnutí výběru, technické dokumenty, extrakční JSON ani jednotlivé faktury. Ve sloupci Soubory se dokument otevře až po kliknutí: privátní Storage znovu vyhodnotí RLS a vytvoří krátkodobou podepsanou URL, která se neukládá do přehledu. Dodatky jsou ve výchozím stavu seskupené pod rodičovskou smlouvou a rozbalují se ovládáním u partnera. Každé úspěšné načtení zapisuje počet výsledků a volbu archivu do auditní tabulky.

Excel export používá stejný značkový layout jako tabulka smluv v detailu stavby: logo Tender Flow, organizaci, datum, verzi aplikace, zobrazované jméno uživatele, souhrnné karty, filtry a zmrazené panely. Data zůstávají typovaná jako čísla, procenta a kalendářní data; textové vstupy jsou neutralizované proti vzorcům. E-mail uživatele se do sdíleného sešitu nevkládá.

Historická sdílení mimo organizaci jsou označena `legacy_external` a zachována pouze pro čtení. Nejde o profesní roli. Nové členy týmu lze vybírat pouze z aktivních členů stejné organizace. Staré generické role se automaticky nemapují na profese; takové členství zůstane bez profesní role do ručního přiřazení.

Budoucí schvalování výběru má používat samostatnou tabulku zadání a kroků workflow s konkrétními adresáty, termínem a auditní stopou. Nesmí být odvozeno automaticky z projektové role.
