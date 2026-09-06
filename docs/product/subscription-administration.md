# Správa balíčků a dostupnosti funkcí

## První etapa: přehled a oddělená pokročilá správa

V Nastavení → Administrace → Balíčky a funkce se nejprve zobrazuje přehled tarifů pouze pro čtení. Tlačítko Spravovat firmy vede na stávající správu organizací, kde zůstává nastavení plánu, licencí a fakturačních údajů. Dosavadní URL s `subTab=subscriptions` zůstává platná.

`features/settings/SubscriptionOverview.tsx` načítá katalog a přiřazení funkcí přes veřejný entrypoint `SubscriptionApi`. React Query spravuje načítání, chybu a opakování. Přehled zahrnuje jen explicitně povolené položky přítomné v katalogu; chybějící přiřazení neznamená povolení. Používá skutečná data backendu, nikoli statické definice `PLANS`. Nejde o výpočet efektivního přístupu konkrétního uživatele.

Původní `SubscriptionFeaturesManagement` se připojí až po otevření pokročilé správy. Nad maticí je vysvětleno, že změny jsou okamžité a platí pro společná pravidla celého tarifu. Během libovolného zápisu (přepnutí, úpravy metadat nebo mazání) jsou ostatní zápisové ovladače i ruční obnova blokované a nelze pokročilou správu zavřít; po zavření se přehled znovu načte.

## Zachované hranice

- Administrace zůstává za existujícím ověřením role a `AdminMfaGuard`.
- Přehled provádí jen čtení. Stávající zápisová API, RLS, tarify a individuální výjimky se nemění.
- Viditelnost ovládacích prvků nenahrazuje autorizaci backendu.
- Změna nevyžaduje migrace, nové balíčky ani změnu Electron IPC.
- Pokročilá matice zatím stále ukládá jednotlivé změny okamžitě; publikování verzí tarifu není součástí této etapy.

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
