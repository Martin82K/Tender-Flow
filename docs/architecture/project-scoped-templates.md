# Projektově omezené šablony

## Účel a stav

E-mailové šablony v `public.templates` jsou uživatelská data chráněná RLS a
feature flagem `dynamic_templates`. Volitelný `project_id` odděluje šablony
jednotlivých staveb a zachovává původní uživatelské šablony s
`project_id IS NULL`.

Migrace `20260605120000`, `20260605133000` a `20260605150000` tvoří jeden
pořadově závislý rollout a v propojeném produkčním projektu už jsou aplikované.
Upravené historické soubory se proto nesmějí znovu nasazovat; další změny musí
být dopředné migrace.

Migrace `20260813110454` přidává osobní aktivní volbu šablony v
`project_template_selections`. Sdílený projekt už není zdrojem uživatelského
UUID šablony. Klíč `(project_id, user_id, template_kind)` odděluje volbu pro
poptávku, materiálovou poptávku a e-mail nevybraným.

## Copy-on-write kontrakt

- `default_templates` jsou neměnné systémové vzory dostupné pouze ke čtení.
- První uložení nebo výběr vzoru vytvoří projektovou kopii vlastněnou aktuálním
  uživatelem; další úpravy mění tutéž kopii.
- Výběr aktivní šablony se ukládá osobně pro uživatele, stavbu a typ. Výběr
  spolupracovníka nemění volbu jiného uživatele.
- Složený foreign key vyžaduje, aby vybraná šablona patřila stejnému uživateli
  i projektu.
- Nejvýše jeden `is_default` je vynucen unikátními částečnými indexy. Změna
  defaultu probíhá atomicky přes `save_scoped_template`.

## Autorizační kontrakt

Každá operace vyžaduje přihlášenou roli, shodu `templates.user_id` s
`auth.uid()` a zapnutou funkci `dynamic_templates`.

| Scope a operace | Povolení |
| --- | --- |
| Legacy šablona (`project_id IS NULL`) | vlastník šablony s aktivním feature flagem |
| Projektová šablona – čtení | vlastník šablony a současně vlastník nebo aktuálně sdílený uživatel projektu |
| Projektová šablona – vložení, změna, smazání | vlastník šablony a současně vlastník projektu nebo sdílený editor |
| Anonymní uživatel | bez přístupu |
| Uživatel bez `dynamic_templates` | bez přístupu |

Odstranění sdílení projektu musí okamžitě odebrat možnost číst projektovou
šablonu. UI gating je pouze UX kontrola a nesmí nahrazovat RLS.

## Backfill

Backfill kopíruje legacy šablony pouze:

- vlastníkům projektů,
- uživatelům s explicitním oprávněním `edit`.

Sdílení `view` vlastní kopie nevytváří. Pokud dvojice uživatel–projekt nemá
legacy šablony, použijí se `default_templates`. Existuje-li už ve scope alespoň
jedna šablona, migrace scope znovu neplní. Toto chování zabraňuje hromadnému
duplikování, ale není mechanismem pro doplňování částečně inicializovaných
scope.

## Preflight a rollout

Před nasazením:

1. Ověřit `supabase migration list` a `supabase db push --dry-run --include-all`.
2. Potvrdit, že `20260813110454` ještě není v cílové historii.
3. Zkontrolovat aktuální RLS politiky `templates`; nesmí se ztratit
   `user_has_feature('dynamic_templates')`.
4. Agregovaně spočítat vlastníky/editory a očekávaný počet kopií, bez výpisu
   obsahu šablon.
5. Nasazovat mimo špičku. Přidání sloupce, foreign key a indexů krátce zamyká
   `templates`.

Po nasazení ověřit:

- existenci `templates.project_id` typu `varchar(36)` a foreign key do
  `projects(id)`,
- indexy `idx_templates_user_project` a `idx_templates_project_default`,
- unikátní indexy `uq_templates_one_project_default` a
  `uq_templates_one_legacy_default`,
- RLS a granty `project_template_selections`,
- nulový počet osobních voleb odkazujících na šablonu jiného uživatele nebo
  projektu,
- existenci čtyř zamýšlených projektových politik a zachovaný feature gating,
- nulový počet projektových kopií vytvořených pouze pro `view` sdílení,
- přepsání existujících `template:<uuid>` odkazů na šablony stejného projektu,
- Supabase security a performance advisors.

## Testovací plán

Automatické kontrakty kontrolují:

- absenci plošného mazání politik přes `pg_policies`,
- explicitní nahrazení pouze známých politik,
- feature gating ve všech čtyřech operacích,
- vlastnictví nebo sdílení pro čtení,
- vlastnictví nebo `edit` oprávnění pro zápis,
- vyloučení `view` sdílení z backfillu,
- filtrování klientských dotazů podle `project_id`.

Statické migrační testy nejsou živým databázovým RLS důkazem. Manuální ověření
na izolovaném testovacím projektu má pokrýt vlastníka, editora, diváka, odebrané
sdílení, vypnutý feature flag a anonymní požadavek.

## Rollback

Po databázovém nasazení se preferuje dopředná opravná migrace. Bez explicitního
provozního rozhodnutí se nemaže `project_id` ani nakopírovaná data. Při problému
s RLS se nejprve obnoví poslední známé bezpečné politiky se zachovaným feature
gatingem; obsah šablon se nemění. Destruktivní rollback vyžaduje ověřenou zálohu.
