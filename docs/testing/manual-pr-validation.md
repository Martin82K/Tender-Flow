# Manuální validační mapa PR

Tento dokument se průběžně doplňuje po každé změně, která má uživatelsky
pozorovatelné chování. Slouží jako základ budoucího regresního testovacího kola.
Stav „čeká“ znamená, že automatické testy prošly, ale scénář ještě nebyl ručně
potvrzen v cílovém prostředí.

| PR | Oblast | Manuální scénář | Stav |
| --- | --- | --- | --- |
| [#160](https://github.com/Martin82K/Tender-Flow/pull/160) | Electron reset hesla | Vyžádat reset, otevřít odkaz v desktopu, nastavit nové heslo a přihlásit se; zopakovat na webu. | čeká |
| [#161](https://github.com/Martin82K/Tender-Flow/pull/161) | TypeScript CI | Bez samostatného runtime scénáře. | automaticky ověřeno |
| [#162](https://github.com/Martin82K/Tender-Flow/pull/162) | Desktop dependency audit | Spustit desktop build/aplikaci jako obecný smoke test. | čeká |
| [#163](https://github.com/Martin82K/Tender-Flow/pull/163) | Root dependency audit | Bez samostatného runtime scénáře. | automaticky ověřeno |
| [#164](https://github.com/Martin82K/Tender-Flow/pull/164) | Pipeline formatter | Otevřít Pipeline a ověřit ceny, rozpočty a souhrny kategorií. | čeká |
| [#165](https://github.com/Martin82K/Tender-Flow/pull/165), [#166](https://github.com/Martin82K/Tender-Flow/pull/166) | Theme typy | Přepnout light/dark, skin, hlavní barvu a UI scale. | čeká |
| [#167](https://github.com/Martin82K/Tender-Flow/pull/167) | Chybové reference | Vyvolat chybu načítání a ověřit stabilní kód + `INC-…`, bez syrového backend payloadu. | čeká |
| [#168](https://github.com/Martin82K/Tender-Flow/pull/168) | Viditelnost projektů | Pod různými účty ověřit vlastní, sdílený, cizí a demo projekt. | čeká |
| [#169](https://github.com/Martin82K/Tender-Flow/pull/169) | Seznam projektů | Ověřit řazení, sdílené projekty, demo režim a chybový stav bez sítě. | čeká |
| [#170](https://github.com/Martin82K/Tender-Flow/pull/170) | Čisté testovací logy | Bez samostatného runtime scénáře. | automaticky ověřeno |
| [#171](https://github.com/Martin82K/Tender-Flow/pull/171) | Dokumentace | Projít technický rozcestník a ověřit použitelnost odkazů. | čeká |
| [#172](https://github.com/Martin82K/Tender-Flow/pull/172) | Detail projektu | Projít Přehled, Pipeline, Dokumenty, Smlouvy a Mapu; ověřit kategorie, nabídky, finance a DocHub. | čeká |
| [#173](https://github.com/Martin82K/Tender-Flow/pull/173) | Tenant overview | Přepnout tenant/project scope a ověřit, že organizace nevidí data jiného tenantu. | čeká |
| [#174](https://github.com/Martin82K/Tender-Flow/pull/174) | Kontakty query | Otevřít Kontakty; ověřit seznam, řazení, specializace, osoby, geodata a hodnocení. Zopakovat v demo režimu bez sítě, po přidání/úpravě/smazání kontaktu a s více než 1 000 záznamy. | čeká |
| [#175](https://github.com/Martin82K/Tender-Flow/pull/175) | Identita přehledu projektů | Po přihlášení otevřít Přehled projektů; přepnout tenant/project scope a ověřit projekty, dodavatele, kontaktní hodnocení a filtry. Ověřit také demo účet a admin debug banner s `?debugOverview=1`. | čeká |
| [#176](https://github.com/Martin82K/Tender-Flow/pull/176) | Identita seznamu projektů | Ověřit vlastní a sdílené projekty v Projektovém řízení, Command Center a projektových volbách úkolů. Přepnout běžný/demo účet a odhlásit/přihlásit jiného uživatele; ověřit, že se cache ani projekty mezi identitami nepromíchají. | čeká |
| [#177](https://github.com/Martin82K/Tender-Flow/pull/177) | Identita task query | Ověřit Inbox, Kalendář, archiv/hotové filtry, osobní TODO projekty a Akční frontu Command Center. Zopakovat s demo účtem a po přepnutí dvou běžných účtů; úkoly ani cache se nesmějí mezi identitami promíchat. | čeká |
| [#178](https://github.com/Martin82K/Tender-Flow/pull/178) | Identita create task mutací | Běžným účtem vytvořit úkol přes rychlé přidání i formulář, podúkol a osobní TODO projekt; ověřit okamžité obnovení seznamů a správného vlastníka po přepnutí účtů A/B. V demo režimu ověřit srozumitelné odmítnutí bez síťového zápisu. | čeká |
| [#179](https://github.com/Martin82K/Tender-Flow/pull/179) | Identita notifikací | Pod účtem A otevřít notifikační centrum, označit jednu/všechny notifikace jako přečtené a jednu/všechny skrýt. Bez reloadu přepnout na B; badge ani obsah A se nesmí zobrazit a pozdní realtime událost A nesmí vyvolat desktopovou notifikaci. Po odhlášení a v demo režimu nesmí otevření ani čekání přes polling interval spustit notifikační RPC, realtime kanál nebo desktopovou notifikaci. | čeká |
| [#180](https://github.com/Martin82K/Tender-Flow/pull/180) | Autor hodnocení dodavatele | Na detailu smlouvy pod účtem A uložit hvězdičky s poznámkou, pouze poznámku a následně clear; po refreshi ověřit hodnoty a autorizovaně zkontrolovat serverový `vendor_rating_by` a `vendor_rating_at`. Se síťovým throttlingem přepnout během save na B; B nesmí zdědit dialog, chybu ani refresh A. Bez identity, v demo režimu a jako uživatel bez edit práva ověřit bezpečné odmítnutí bez změny řádku. | čeká |

## Jak mapu udržovat

- Nový PR přidat po vytvoření stabilního čísla nebo v bezprostředně následující
  dokumentační změně.
- Uvádět pouze scénáře, které člověk může pozorovat; CI-only změny označit
  „automaticky ověřeno“.
- Po ručním ověření změnit stav na „prošlo“ nebo zapsat stručný nález a odkaz na
  navazující issue/PR.
- Nikdy do výsledku nevkládat tokeny, osobní data ani nesanitizované logy.
