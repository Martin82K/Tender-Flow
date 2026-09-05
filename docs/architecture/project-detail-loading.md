# Načítání a obnova detailu projektu

Při otevření projektu se rozlišuje načítání, dostupný detail, chyba požadavku a nedostupný projekt. Skeleton se zobrazuje při prvním načítání. Chyba bez dříve načteného detailu nabízí **Zkusit znovu** a **Zpět na projekty**. Během opakování je tlačítko zakázané; navigace zůstává dostupná. Při výpadku aktualizace již načteného detailu zůstávají poslední úspěšná data zobrazena.

Nedostupný projekt zobrazuje společnou zprávu pro odstraněný projekt a projekt bez přístupu. Pokud ID není v aktuálním seznamu viditelných projektů, detail se nezobrazuje ani z cache a samostatný požadavek na toto ID se nespouští. U projektu, který zůstává v seznamu, lze zopakovat jeho detail. Změnu oprávnění nebo seznamu projektů lze ověřit návratem na přehled a obnovením stránky.

## Technické chování

- `useAllProjectDetailsQuery` nadále načítá všechny detaily a zachovává klíče cache `['projectDetails', projectId]`. Optimalizace startu aplikace není součástí této změny.
- `useAppData` odvozuje stav vybraného detailu z odpovídajícího výsledku dotazu a aktuálního seznamu projektů. Při otevřeném projektu se načítání detailů řeší uvnitř obrazovky; základní data aplikace si zachovávají globální načítání a zpracování chyb.
- `retrySelectedProjectDetails` volá pouze `refetch` vybraného výsledku. `cancelRefetch: false` a kontrola probíhajícího požadavku brání duplicitnímu opakování. Nekoná se globální invalidace cache.
- Pokud selže samotný seznam projektů a pro vybrané ID ještě neexistuje dotaz na detail, obrazovka hlásí chybu načtení a opakuje pouze seznam projektů. Selhání seznamu se nepovažuje za důkaz nedostupnosti projektu.
- Dotaz na řádek projektu používá `maybeSingle()`: prázdný výsledek se převádí na `ProjectUnavailableError`. RLS a autentizace zůstávají v existujícím databázovém adaptéru. Databázové zprávy se nevypisují do obrazovky.
- Stav nedostupnosti má přednost před starším detailem v cache. Chyba jiného projektu neovlivňuje stav otevřeného detailu.

## Ověření a provoz

Regresní testy pokrývají chybu, opakování pouze jednoho požadavku, souběžná kliknutí, přepnutí projektu, chybějící řádek, cizí ID v cache, lokální načítání a čekání na seznam projektů. Testy obrazovky ověřují zprávy, skeleton, tlačítka, návrat na `/app/projects` a úspěšně načtený detail.

Ruční kontrola: otevřít projekt při nedostupném požadavku na jeho detail, ověřit chybovou zprávu, obnovit spojení a zvolit **Zkusit znovu**. Otevřít nedostupné ID a ověřit zprávu **Projekt není dostupný**, potom použít **Zpět na projekty**.

Změna nevyžaduje migraci, nové proměnné prostředí ani nové závislosti. GitHub před implementací nevracel analýzy Code Scanning a měl vypnutá upozornění Dependabot; úspěšné CI tyto chybějící signály nenahrazuje.

Audit závislostí v CI prvního commitu opravy prošel s prahem `high`, ale hlásil sedm nálezů střední závažnosti v existujících závislostech (xmldom, fflate a qs včetně navazujících balíčků). Aktualizace těchto závislostí je samostatný rozsah práce.
