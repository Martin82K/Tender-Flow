# Správa balíčků a dostupnosti funkcí

## První etapa: přehled a oddělená pokročilá správa

V Nastavení → Administrace → Balíčky a funkce se nejprve zobrazuje přehled tarifů pouze pro čtení. Tlačítko Spravovat firmy vede na stávající správu organizací, kde zůstává nastavení plánu, licencí a fakturačních údajů. Dosavadní URL s `subTab=subscriptions` zůstává platná.

`features/settings/SubscriptionOverview.tsx` načítá katalog a přiřazení funkcí přes veřejný entrypoint `SubscriptionApi`. React Query spravuje načítání, chybu a opakování. Přehled zahrnuje jen explicitně povolené položky přítomné v katalogu; chybějící přiřazení neznamená povolení. Používá skutečná data backendu, nikoli statické definice `PLANS`. Nejde o výpočet efektivního přístupu konkrétního uživatele.

Původní `SubscriptionFeaturesManagement` se připojí až po otevření pokročilé správy. Nad maticí je vysvětleno, že změny jsou okamžité a platí pro společná pravidla celého tarifu. Během libovolného zápisu (přepnutí, úpravy metadat nebo mazání) jsou ostatní zápisové ovladače i ruční obnova blokované a nelze pokročilou správu zavřít; po zavření se přehled znovu načte.

## Povinné předplatné

Free není nabízený účet ani tarif. Interní hodnota `free` zůstává kvůli starším klientům a databázovým vazbám a znamená **bez přístupu**. Administrátor může tento stav rozpoznat jako „Bez předplatného“; otevření existujícího záznamu nepřiřadí automaticky placený tarif.

`AppEntry` ověřuje předplatné před připojením pracovní aplikace, datových dotazů a realtime odběrů. Bez platného předplatného zůstává obrazovka obnovy, kontakt na podporu a odhlášení. Právní dokumenty a veřejné krátké odkazy si zachovávají vlastní přístupová pravidla. Lokální demo používá vzorová data a není předplatným ani oprávněním k backendu.

Nové osobní i firemní organizace se vytvářejí bez aktivního tarifu. Automatické založení organizace nepředstavuje úhradu ani časově neomezený nárok. Existující placená a ručně spravovaná předplatná se tím nepřepisují.

Obě generace databázových RPC používají stejný resolver. Platí aktivní firemní členství a nevypršené firemní nebo osobní předplatné. Platné zkušební období a ruční přidělení jsou zachované. Zrušené předplatné funguje do konce již uhrazeného období, musí však mít datum konce. Individuální příznak funkce sám přístup neobnoví. Správci platformy se ověřují přes `platform_admins`.

Ověření se obnovuje každou minutu a při návratu do okna. Známé datum vypršení uzamkne UI i při neodpovídajícím serveru; poslední ověření bez kratšího data má nejvýše 90 sekund platnosti. Backend kontroluje každý nový datový požadavek. Starší klienti používají opravené RPC a stejnou databázovou ochranu.

Migrace `20260906181346_require_active_subscription.sql` skládá REST kontrolu s existující ochranou MCP. Restriktivní RLS doplňuje dosavadní pravidla firem a rolí u pracovních tabulek a Storage. Edge Functions ověřují předplatné před použitím servisního klienta nebo externího poskytovatele; OAuth callback kontroluje vlastníka spotřebovaného stavu.

Odebrání přístupu nemaže zákaznická data. Již stažené soubory nelze odvolat a dříve vydané podepsané odkazy mohou fungovat do své expirace. Externí oprávnění k souborům v Google Drive nebo Microsoft 365 se řídí také pravidly daného poskytovatele.

Administrace stále vyžaduje existující roli a MFA. Pokročilá matice ukládá změny okamžitě; publikování verzí tarifů není součástí této úpravy. Nové závislosti nejsou potřeba.

## Nasazení a kontrola

Před změnou proveďte `supabase db push --dry-run`. Tato úprava obsahuje hlavní migraci výše a následnou `20260906185438_use_invoker_for_subscription_guard.sql`, která pomocnou kontrolu provozuje s oprávněními volajícího. Kontrola vrací jen stav aktuálního uživatele a deleguje na existující resolver; sama nepotřebuje `SECURITY DEFINER`. Nejdříve nasaďte migraci, poté změněné Edge Functions přes API a web. Ověřte katalog RLS, granty, počty a security/performance advisors a opakujte dry-run do stavu „Remote database is up to date“.

`supabase/tests/subscription-provisioning.sql` kontroluje založení osobní i firemní organizace bez automatického předplatného. `supabase/tests/subscription-required.sql` ověřuje oba resolvery, vypršení, aktivitu členství, placené období po zrušení, individuální výjimky, REST 402, Storage/projektové RLS a obnovení přístupu. Používá krátkou transakci nad dočasně změněnými záznamy a končí rollbackem; nespouštějte jednotlivé UPDATE samostatně. Nevyžaduje ani nevypisuje identifikátory zákazníků.

Po nasazení ověřte přihlášení bez předplatného, pokus o otevření projektu přímou URL, odhlášení a obnovení platného předplatného. Testovací prodloužení ani rušení skutečných předplatných neprovádějte mimo rollbackovou transakci.

## Návrh dalšího rozdělení katalogu

Toto je podklad pro další produktové rozhodnutí, nikoli nová pravidla dostupnosti:

| Skupina | Příklady současných funkcí | Navrhovaný způsob řízení |
| --- | --- | --- |
| Kandidáti na pevné jádro | Projekty, kontakty, úkoly | Společný základ; rozsah ještě vyžaduje rozhodnutí o tarifech. |
| Obsah pracovních balíčků | Import kontaktů, export PDF/Excel, harmonogram, Excel nástroje | Srozumitelné balíčky namísto jednotlivého přepínání pro každou firmu. |
| Funkce s vlastními náklady | OCR, mapové operace | Doplněk nebo limit podle skutečných nákladů a využití. |
| Oprávnění k akcím | Práva členů organizace a projektů | Zachovat samostatné ověřování rolí a přístupu k datům. |
| Provozní řízení | Budoucí postupné zavádění a nouzové vypnutí | Oddělit od předplatného; dočasným přepínačům určit vlastníka a termín vyhodnocení. |

Před sjednocením balíčků je nutné inventarizovat produkční přiřazení a výjimky, porovnat efektivní přístup před změnou a po ní a stanovit pravidla zachování existujících nároků. Výše uvedené příklady nelze použít jako migrační seznam bez tohoto ověření.

## Ověření

Regresní testy `tests/AdminSettings.subscriptions.test.tsx` ověřují přehled bez zápisů, navigaci, otevření a zavření pokročilé správy, obnovení dat, chybu s opakováním, prázdný katalog a nepřístupnost bez administrátorské role. Testy `tests/SubscriptionFeaturesManagement.busy.test.tsx` navíc ověřují vzájemné blokování přepnutí, úpravy a mazání během zápisu. Při ruční kontrole rozbalte funkce balíčku, otevřete pokročilou správu a po dokončení změny ověřte aktualizovaný přehled. Zápisovou kontrolu provádějte na testovacích datech.

V této etapě nejsou dostupné produkční code-scanning nálezy (GitHub vrací „no analysis found“) a Dependabot alerts jsou vypnuté. Lokální bezpečnostní regresní testy a CI tak nepředstavují náhradu těchto nedostupných signálů.
