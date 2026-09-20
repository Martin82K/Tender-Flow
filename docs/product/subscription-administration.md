# Správa balíčků a dostupnosti funkcí

## První etapa: přehled a oddělená pokročilá správa

V Nastavení → Administrace → Balíčky a funkce se nejprve zobrazuje přehled tarifů pouze pro čtení. Tlačítko Spravovat firmy vede na stávající správu organizací, kde zůstává nastavení plánu, licencí a fakturačních údajů. Dosavadní URL s `subTab=subscriptions` zůstává platná.

`features/settings/SubscriptionOverview.tsx` načítá katalog a přiřazení funkcí přes veřejný entrypoint `SubscriptionApi`. React Query spravuje načítání, chybu a opakování. Přehled zahrnuje jen explicitně povolené položky přítomné v katalogu; chybějící přiřazení neznamená povolení. Používá skutečná data backendu, nikoli statické definice `PLANS`. Nejde o výpočet efektivního přístupu konkrétního uživatele.

Původní `SubscriptionFeaturesManagement` se připojí až po otevření pokročilé správy. Nad maticí je vysvětleno, že změny jsou okamžité a platí pro společná pravidla celého tarifu. Během libovolného zápisu (přepnutí, úpravy metadat nebo mazání) jsou ostatní zápisové ovladače i ruční obnova blokované a nelze pokročilou správu zavřít; po zavření se přehled znovu načte.

## Povinné předplatné

Free není nabízený účet ani tarif. Interní hodnota `free` zůstává kvůli starším klientům a databázovým vazbám a znamená **bez přístupu**. Administrátor může tento stav rozpoznat jako „Bez předplatného“; otevření existujícího záznamu nepřiřadí automaticky placený tarif.

`AppEntry` ověřuje předplatné před připojením pracovní aplikace, datových dotazů a realtime odběrů. Nová organizace dostane 14denní plně funkční Enterprise trial počítaný od `organizations.created_at`. V aplikaci je vidět zbývající počet dní. Po vypršení platí dosavadní zeď bez licence (obrazovka obnovy, kontakt na podporu, odhlášení). Správce platformy převede trial na smluvní Enterprise ve Správě organizací; samoobslužná platba se nezavádí. Právní dokumenty zůstávají veřejné. Historické krátké odkazy zobrazí veřejné oznámení o ukončení služby. Lokální demo používá vzorová data a není předplatným ani oprávněním k backendu.

Nové osobní i firemní organizace se zakládají s trialem Enterprise na 14 dní od data vzniku. Připojení do už existující organizace dědí její stav (trial, Enterprise i zeď po expiraci), ale jen když je volná licence. Kontrola sedadel jde přes `_org_billable_seats_available`, které uzamkne řádek organizace (`FOR UPDATE`) pro domain-join, přidání člena přes UUID i e-mail, schválení i aktivaci člena. Backfill trialu vynechá firmy, které už mají víc aktivních fakturovatelných členů než `max_seats`. Při plném počtu licencí se nový účet do firmy nepřidá: vznikne osobní prostor Free/expired bez dalšího trialu a po potvrzení e-mailu zůstane čekající žádost o členství. Osobní signup trial ani osobní organizační trial neotevře zeď firmy, ve které je uživatel členem. Placená nebo ručně spravovaná osobní organizace zůstane po vstupu do firmy platná. Vlastník trialu nemůže zvýšit `max_seats`; to zůstává správci platformy. Profilový Pro trial se při registraci neseeduje; organizační trial vznikne až po ověření e-mailu. Globální `has_active_subscription` dovoluje vstup do aplikace; přístup k datům vždy navíc kontroluje licenci konkrétní organizace podle již nasazené migrace `20260917150544_tenant_scoped_subscription_boundary.sql`. Ručně udělený osobní trial (`start_user_trial`) zůstává jen účtům bez firemního členství. Veřejné e-mailové domény (`is_public_email_domain`, sjednocení se `is_free_email_provider` včetně `aol.com`, `post.cz`, `pm.me`, `gmx.com`, `mail.com`, `ymail.com`) zakládají osobní org, ne sdíleného tenanta. Authenticated recovery nemění chráněná pole `user_profiles`. Placená, ručně spravovaná a Stripe předplatná se založením nového účtu nepřepisují.

Obě generace databázových RPC používají stejný resolver. Platí aktivní firemní členství a nevypršené firemní předplatné. Profilové osobní zkušební období platí jen u účtů bez aktivního firemního členství. Ruční přidělení a uhrazené osobní období (včetně zrušeného do data konce) zůstávají. Individuální příznak funkce sám přístup neobnoví. Správci platformy se ověřují přes `platform_admins`.

Ověření se obnovuje každou minutu a při návratu do okna. Známé datum vypršení uzamkne UI i při neodpovídajícím serveru; poslední ověření bez kratšího data má nejvýše 90 sekund platnosti. Backend kontroluje každý nový datový požadavek. Starší klienti používají opravené RPC a stejnou databázovou ochranu.

Pravidelná kontrola probíhá na pozadí bez zavření formulářů, ztráty rozepsaného textu nebo fokusu. Minutový časovač nesmí vynechat kontrolu kvůli nedávno dokončené odpovědi serveru či návratu do okna: další pokus až za dvě minuty by překročil 90sekundovou platnost a zbytečně odpojil rozhraní. Minutový časovač nezneplatňuje probíhající ověření. Návrat do okna naopak okamžitě zahájí nový pokus, aby se přístup mohl obnovit po výpadku sítě ještě před vypršením. Samostatný časovač po 90 sekundách nahradí zaseknutý požadavek, a to i při prvním ověření bez dosud uděleného přístupu. Časovač se ruší při dokončení, změně identity a odpojení provideru. Skutečné vypršení nebo neúspěšné ověření přístup nadále uzamkne. Při ruční kontrole ponechte rozepsaný formulář otevřený alespoň šest minut, zopakujte návrat do okna a ověřte zachování textu i kurzoru.

Migrace `20260906181346_require_active_subscription.sql` skládá REST kontrolu s existující ochranou MCP. Restriktivní RLS doplňuje dosavadní pravidla firem a rolí u pracovních tabulek a Storage. Edge Functions ověřují předplatné před použitím servisního klienta nebo externího poskytovatele; OAuth callback kontroluje vlastníka spotřebovaného stavu.

Odebrání přístupu nemaže zákaznická data. Již stažené soubory nelze odvolat a dříve vydané podepsané odkazy mohou fungovat do své expirace. Externí oprávnění k souborům v Google Drive nebo Microsoft 365 se řídí také pravidly daného poskytovatele.

Administrace stále vyžaduje existující roli a MFA. Pokročilá matice ukládá změny okamžitě; publikování verzí tarifů není součástí této úpravy. Nové závislosti nejsou potřeba.

## Nasazení a kontrola

Před změnou proveďte `supabase db push --dry-run`. Tato úprava obsahuje hlavní migraci výše a následnou `20260906185438_use_invoker_for_subscription_guard.sql`, která pomocnou kontrolu provozuje s oprávněními volajícího. Migrace `20260906185734_read_subscription_subject_from_verified_claims.sql` čte podepsané `sub` z `request.jwt.claims`, aby také MCP fungovalo bez přístupu do schématu `auth`; nikdy nečte uživatelsky měnitelná metadata. Tento zdroj identity používá i [autorizace Supabase Realtime](https://supabase.com/docs/guides/realtime/authorization). Kontrola vrací jen stav aktuálního uživatele a deleguje na existující resolver; sama nepotřebuje `SECURITY DEFINER`. Nejdříve nasaďte migraci, poté změněné Edge Functions přes API a web. Ověřte katalog RLS, granty, počty a security/performance advisors a opakujte dry-run do stavu „Remote database is up to date“.

`supabase/tests/subscription-provisioning.sql` a `supabase/tests/org-signup-trial.sql` kontrolují založení osobní i firemní organizace s 14denním Enterprise trialem od `created_at`, zeď po expiraci, domain-join bez osobního trialu, limit licencí při automatickém připojení a převod na aktivní Enterprise. `supabase/tests/subscription-required.sql` ověřuje oba resolvery, vypršení, aktivitu členství, placené období po zrušení, individuální výjimky, REST 402, Storage/projektové RLS a obnovení přístupu. Používá krátkou transakci nad dočasně změněnými záznamy a končí rollbackem; nespouštějte jednotlivé UPDATE samostatně. Nevyžaduje ani nevypisuje identifikátory zákazníků.

Po nasazení ověřte registraci nového účtu (plný přístup a zbývající dny trialu), expiraci trialu (dosavadní zeď bez licence) a ruční převod na Enterprise ve Správě organizací. Testovací prodloužení ani rušení skutečných předplatných neprovádějte mimo rollbackovou transakci.

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

### Obnovení platebního období

Migrace `20260906192005_reconcile_subscription_periods.sql` používá u Stripe organizací `expires_at`, aby staré ruční `billing_period_end` nezkrátilo ani neprodloužilo předplatné. Webhook zapisuje obě hodnoty společně. Při `past_due` zachovává pouze původní konec přístupu; `incomplete` nedostane placené období. Stav `pending` vyžaduje konkrétní budoucí konec. Ověřeno SQL testem s rollbackem, testy výpočtu období a zpracováním webhooku včetně odmítnutí neplatného podpisu. Rozdíl stavů odpovídá [životnímu cyklu předplatného Stripe](https://docs.stripe.com/billing/subscriptions/overview).

Hlavní migrace před přidáním restriktivní politiky kontroluje existenci volitelných tabulek. Na již nasazené databázi tato úprava nic nemění; umožňuje průchod instalacemi bez volitelných rozpočtových tabulek.

### Opravy hranic vydání 1.9.26

Migrace `20260907065230_close_release_subscription_boundaries.sql` obnovuje veřejný provisioning pouze pro vlastní přihlášenou identitu. Argumenty mohou zůstat prázdné jako v původním wrapperu; explicitní ID a e-mail se porovnávají s ověřeným účtem. Anonymní volání nemá oprávnění ani k veřejné, ani k interní funkci. Interní bootstrap zůstává dostupný servisní roli a registračnímu triggeru. Nové osobní i firemní organizace dostanou 14denní Enterprise trial od `created_at`; po expiraci platí dosavadní zeď bez licence.

Historická REST výjimka zahrnuje přesně `get_short_url_target`, ale vyřazovací migrace zkracovače klientům odebrala oprávnění tento resolver spouštět. Krátké odkazy již nefungují; veřejná stránka pouze oznámí ukončení služby. Ochrana MCP, přímý přístup k tabulce a ostatní RPC zůstávají zachované. Test `supabase/tests/release-subscription-boundaries.sql` kontroluje oprávnění, identitu, vlastní provisioning a přesný rozsah výjimky; končí rollbackem.

`stripe-sync-org-subscription` sdílí výpočet období s webhookem. Synchronizuje oba sloupce konce přístupu a u `past_due` zachovává pouze již uložený konec; `incomplete` neuděluje nové období. Stejnou hodnotu vrací klientovi. Regrese handleru používají mockované Stripe odpovědi a neprovádějí skutečné platby.

Legacy `SubscriptionSettings`, která není připojena v hlavních Nastaveních, opět obsahuje samostatnou akci **Zrušit automatické platby** přes Stripe. Odstranění nabídky Free tuto akci neruší. Stripe nepoužívá původní přepínač, který měnil pouze databázi bez změny u poskytovatele; tento přepínač zůstává pro ostatní předplatná. Nejde o nový samoobslužný prodej v `OrgBillingTab`; současný firemní Enterprise přehled zůstává zachován.

## Licence jednotlivých organizací

Platná licence jedné organizace neodemyká pracovní data jiné expirované organizace.
Podrobnosti, zachované osobní licence a postup ověření popisuje
[licenční hranice organizace](../operations/tenant-subscription-boundary.md).

## Dokončení registračního trialu (19. 9. 2026)

Verzovaná migrace `20260919070618_org_signup_enterprise_trial.sql` navazuje na již nasazenou hranici organizací. Původní nenasažená verze `20260916223000` byla přesunuta za aktuální migrace. Před nasazením ověřte dry-run a počet nedávných Free/expired organizací bez override a fakturace, které ještě mají část 14denního období a nepřekračují limit licencí. Backfill nezakládá nové období od nasazení; počítá od `created_at`.

Registrační SQL test používá syntetické účty a skutečné auth triggery v izolované databázi, vše vrací rollbackem. Ověřuje i zákaz NULL limitu licencí pro vlastníka. Změna limitu a rezervace licence používají společný zámek organizace. Po deployi zkontrolujte oprávnění funkcí, triggery, výsledné počty, security/performance advisors a závěrečný dry-run bez čekajících migrací.

Veřejné odkazy vedou na existující instalační soubory: Windows 1.9.38 a macOS Apple Silicon 1.9.36. Verze jsou úmyslně nezávislé, protože vydání 1.9.38 obsahuje pouze Windows. Nové desktopové vydání tato změna nevytváří.

### Potvrzení e-mailu před prvním přihlášením

Enterprise trial vyžaduje serverové ověření e-mailu: v Supabase Auth musí být `mailer_autoconfirm=false` a `mailer_allow_unverified_email_sign_ins=false`. Veřejné registrace zůstávají povolené podle současného produktového nastavení; klientská kontrola `app_settings` není bezpečnostní hranice. Při budoucím uzavření registrací je nutné uzavřít také Supabase Auth signup.

Ověřovací zprávy odesílá funkce `auth-send-email` přes existující `RESEND_API_KEY` a `DEFAULT_EMAIL_FROM`. Nepoužívá klientskou session: každé volání ověřuje podpis Standard Webhooks pomocí `SEND_EMAIL_HOOK_SECRET`, přesné tělo, ID a časové okno pěti minut. Resend idempotency klíč omezuje duplicitní doručení při opakování hooku. Odkazy směřují na Auth URL daného projektu a poté na `https://www.tenderflow.cz`; recovery vede přímo na formulář obnovy hesla na téže doméně. Registrační potvrzení zachová původní cílovou cestu pouze v `/app` na `https://www.tenderflow.cz`; ostatní cíle se zahodí. Podporované jsou registrace, pozvánka, obnova hesla, magic link, reautentizace a obě adresy při bezpečné změně e-mailu. Tajemství ani ověřovací tokeny se nelogují.

Pořadí nasazení: nastavte stejné náhodné podpisové tajemství v Auth hooku a Edge secrets, nasaďte `auth-send-email` přes API s vypnutým JWT ověřováním (autentizaci zajišťuje HMAC), ověřte odmítnutí nepodepsaného požadavku a doručení podepsaného testu přes Resend. Teprve potom aktivujte Send Email hook a potvrzování e-mailu. Nepoužívejte plošný `config push`, který by přepsal nesouvisející produkční nastavení. Nová registrace nesmí před potvrzením vrátit session a přihlášení musí vrátit `email_not_confirmed`. Chyba Resend vrací chybu Auth, nikoli falešný úspěch. Bez funkčního hooku a potvrzování tento trial nenasazujte.

Bez session aplikace požádá o potvrzení e-mailu. Zaškrtnuté verze právních dokumentů uchová jako čekající požadavek v registračních metadatech. Po ověření e-mailu je při načtení profilu dokončí autentizované RPC se serverovým auditním časem. Metadata nejsou zdrojem oprávnění; zastaralé verze, neověřený účet nebo chyba RPC automatické potvrzení neudělí a zůstává stávající právní brána. Již uložené souhlasy se nepřepisují. Nastavení v lokálním `config.toml` rovněž vyžaduje potvrzení e-mailu.

### Ověření registrace a obnova hesla

Neověřený signup nevytváří organizaci ani členství a nerezervuje firemní doménu či licenci. Organizaci založí trigger až při prvním potvrzení e-mailu; chyba provisioningu rollbackne i potvrzení a dovolí opakování odkazu. Již potvrzené účty (např. OAuth) zpracuje také původní INSERT trigger. Čtrnáctidenní Enterprise trial běží od vzniku organizace, bez souběžného profilového Pro trialu. Registrace bez session zobrazí potvrzení s výzvou ke kontrole e-mailu.

Resend Auth recovery zpráva směřuje na `/reset-password?auth_token_hash=…`. Formulář ověří jednorázový recovery token až při odeslání nového hesla a následně aktualizuje heslo přes Supabase Auth. Při chybě aktualizace umožní opakování bez opětovného spotřebování tokenu. Původní odkazy s `?token=…` nadále obsluhuje stávající reset endpoint. Hodnoty recovery tokenů se při zápisu diagnostiky redigují.

### Konfigurace návratového prostředí

Frontend používá `VITE_AUTH_APP_ORIGIN`, případně aktuální webový origin; desktop bez webového originu používá produkci. Edge hook používá `AUTH_APP_ORIGIN` (výchozí `https://www.tenderflow.cz`). Pro staging nastavte oba na stejný HTTPS origin a přidejte odpovídající `/app/**` do Auth Redirect URLs. Pro lokální Auth lze použít `http://127.0.0.1:3000` na obou stranách a lokální Supabase URL; HTTP je povoleno pouze na loopbacku. Hodnota musí být samotný origin bez cesty, query, fragmentu či přihlašovacích údajů. Hook důvěřuje konfiguraci prostředí, nikoli originu zaslanému klientem. Produkční Supabase z lokálního náhledu zachovává produkční omezení.

### Souběh registrací a omezení resolveru licence

Navazující migrace `20260919083458_serialize_signup_and_scope_licence_resolver.sql` serializuje první založení firmy transakčním zámkem normalizované domény. Dva současně potvrzené účty stejné nové firemní domény tak sdílí jednu organizaci. Osobní domény nadále vytvářejí samostatné organizace. Resolver licence dovoluje vlastní identitu, platformového správce a servisní volání; role MCP si zachovává vlastní licenci, nikoli přístup k cizím údajům. Pomocník rezervace míst není veřejné klientské RPC. SQL test identity i test souběhu používejte pouze v izolované databázi se syntetickými účty.

Po ověření recovery tokenu se pro opakování po obnovení stránky uloží do sessionStorage pouze SHA-256 otisk spotřebovaného tokenu, ID uživatele a konec platnosti (nejvýše hodina a do konce session). Obnovení vyžaduje shodu otisku, platnosti i aktuální identity; heslo ani token se do této značky neukládají. Úspěšná změna hesla značku odstraní. Neplatné procentní kódování návratové cesty se odmítne před vytvořením odkazu. Tarif override `free` ani neznámá hodnota nepřepisují stav předplatného na aktivní.

### Další adresa plné firmy a změna účtu během recovery

Migrace `20260919085612_prevent_full_company_trial_renewal.sql` ponechává při plném firemním limitu osobní prostor, ale s tarifem Free a stavem expired, nikoli s dalším Enterprise trialem. Nevydává tak opakovaná zkušební období dalším adresám stejné plné firemní domény. Již existující licence nemění. Ověření e-mailu samo o sobě neprokazuje unikátní fyzickou osobu napříč nesouvisejícími doménami; vlastník produktu dne 20. 9. 2026 výslovně přijal riziko opakovaných osobních trialů přes nové adresy či aliasy veřejných e-mailových domén, včetně opakovaného čerpání kvótovaných AI funkcí. Další ověření identity se v této etapě nezavádí. Jde o přijaté zbytkové riziko, nikoli technicky odstraněnou možnost opakované registrace.

Každý pokus o změnu hesla znovu porovná recovery marker s aktuální session. Požadavek PUT na Auth `/user` používá výhradně zachycený access token této ověřené identity, nikoli znovu načítanou sdílenou session klienta. Tím je pokryta i změna účtu v jiné kartě mezi kontrolou a odesláním. Heslo ani access token se nezapisují do diagnostiky či recovery markeru; při nedostupném sessionStorage funguje omezená značka pouze v paměti otevřené stránky.

### Legacy sdílení a registrační triggery

Migrace `20260919090957_preserve_legacy_licence_and_verified_join_requests.sql` odděluje interní výpočet licence do neuděleného helperu ve schématu private. Veřejný resolver stále kontroluje vlastní identitu/správce/server; RLS sdílených legacy projektů bez organizace může interně vyhodnotit licenci zaznamenaného vlastníka. Přístup k samotnému projektu nadále řídí původní sdílení a RLS.

Také starší `assign_org_membership_by_domain` nyní vyžaduje potvrzenou skutečnou adresu účtu, běží jen z triggeru/servisního kontextu a používá doménový i organizační zámek a společný limit míst. Automatické žádosti o členství vznikají až po potvrzení; automatické přijetí uzavře případnou starší pending žádost. Plná firma ponechá jednu čekající žádost. Databázový trigger navíc brání schválení neověřeného účtu i přes starou existující žádost. Produkční preflight nenašel neověřené pending žádosti ani pending žádosti již přijatých členů; žádný backfill se neprovádí.

### Rezervace licencí přes členská RPC (20. 9. 2026)

Migrace `20260920080223_enforce_member_rpc_seat_limits.sql` doplňuje společný zámek a kontrolu kapacity do `add_org_member`. Opakované přidání existujícího člena nadále nic nemění, také u neaktivního či neúčtovaného členství a plné firmy. `activate_org_member` rezervuje místo také při převodu aktivního neúčtovaného člena na účtovaného. E-mailové přidání a schválení žádosti drží stejný zámek už před kontrolou existence člena, aby souběžné odstranění a náhrada neobešly limit. Anonymní EXECUTE je těmto čtyřem funkcím odebrán, autorizace vlastníka/správce zůstává. Migrace nemění tabulky, RLS, indexy ani existující data a nepotřebuje backfill.

Před nasazením zaznamenejte definice a granty čtyř dotčených funkcí, počty organizací/členství/profilů a advisors; dry-run musí obsahovat jen tuto čekající migraci. `supabase/tests/org-member-seat-limits.sql` ověřuje kapacitu, oprávnění, zachování existujících členů, aktivaci a neomezený i nulový limit. `supabase/tests/org-member-seat-concurrency.cjs` testuje skutečný souběh UUID přidání s dalším přidáním, aktivací a souběžným odstraněním/náhradou člena. Oba testy patří pouze do izolované databáze se syntetickými účty. Po nasazení porovnejte definice, granty, počty a advisors a zopakujte dry-run do aktuálního stavu.
