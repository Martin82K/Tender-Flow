# Moduly TODO a přímé odkazy

`features/tasks/ui/TasksPage.tsx` koordinuje výběr pohledu, úkolu, projektů TODO,
načítání a přesuny úkolů. Kalendář (`TodoCalendarView`), agenda (`TodoAgendaView`),
řádek seznamu (`TaskListItem`), detail (`TaskDetail`), formuláře (`QuickAdd`,
`AddSubtaskDialog`) a správa projektů TODO (`TodoProjectSection`) mají vlastní moduly.
Společné formátování a malé UI prvky jsou v `taskPresentation`, kalendářní výpočty
v `taskCalendarUtils`. Původní exporty z `TasksPage` zůstávají kompatibilní.

Výchozí ověření při tomto rozdělení: 23 souborů nad 800 řádků v adresářích
`app`, `features`, `shared`, `components`, `hooks`, `services`, `context`, `utils`;
`TasksPage.tsx` měl 3 721 řádků. Rozdělení zachovává značky `data-help-id`,
DOM strukturu, styly, lokální stav formulářů a stávající mutační hooky.

## Přímý odkaz na úkol

`buildAppUrl("todo", { taskId })` vytváří `/app/todo?taskId=…`.
`parseAppRoute` vrací identifikátor v `taskId`; aplikační integrace jej předává
jako `TasksPage.initialTaskId`. Callback `onCloseInitialTask` při zavření detailu
odstraní `taskId` z aktuální URL pomocí běžné aplikační navigace; díky tomu lze
stejný výsledek hledání znovu otevřít. Bez parametru zůstává výchozí kalendář bez detailu.
Odkaz otevře přímo detail úkolu nebo podúkolu i mimo aktuální filtr, včetně
archivovaných a dokončených úkolů. Na mobilu používá stávající celoobrazovkový detail.
Při nedostupném úkolu se zobrazí hlášení; chyba načítání má odlišné hlášení.
Zavření detailu jej ponechá zavřený i při obnově dat. Nový odkaz nebo změna identity
založí novou instanci pracovního prostoru, aby se nepřenášel detail ani rozepsaný formulář.

Odkaz sám neuděluje přístup. Detail se vybírá pouze z výsledků stávajícího
uživatelského dotazu `useTasksQuery({ user, filter: { includeArchived: true } })`.
Stránka navíc ověřuje `createdBy` proti aktuálnímu uživateli, aby nezobrazila
případná zastaralá data při změně identity. Funkční oprávnění zajišťuje stávající
aplikační guard TODO; serverová oprávnění a mutační hranice zůstávají beze změny.
Úplnost odkazů závisí na stránkovaném `listTasks`, sdíleném také s vyhledáváním.

## Ověření

Regrese v `tests/routeUtils.todo.test.ts` ověřují URL encoding a parsování.
`tests/features/tasks/TasksPage.notePreview.test.tsx` pokrývá archivovaný podúkol,
načítání, další navigaci, změnu uživatele, nedostupný úkol, chybu dotazu,
mobilní detail a zavření při obnově dat. Stávající testy zachovávají pokrytí
kalendáře, drag and drop, seznamu, detailu, přidávání úkolů a projektů TODO.
