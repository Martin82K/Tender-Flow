# Licence konkrétní organizace

Globální `get_effective_user_tier` a `has_active_subscription` popisují účet a
umožňují vstup do aplikace. Neudělují licenci k datům jiné organizace.

Migrace `20260917150544_tenant_scoped_subscription_boundary.sql` přidává kontrolu
předplatného organizace odvozené z uloženého projektu nebo řádku. Oprávnění
vlastníka, členství, týmové role, externí sdílení a MCP proof se kontrolují dál.
Platná licence firmy A nesmí zpřístupnit expirovanou firmu B, i když je uživatel
členem obou. Licence správce platformy má zachovanou výjimku; sama nepřidává
oprávnění k cizím datům.

Kontrola respektuje platné organizační overrides, konec trialu, placené období
po zrušení a Stripe `expires_at`. Historické osobní předplatné může zpřístupnit
osobní prostor, nikoli firemní organizaci. Globální stavy kontaktů zůstávají
přístupné účtům s platným předplatným. Účet, členství a billing nejsou skryty,
aby bylo možné obnovit licenci.

Kromě restriktivních RLS chrání migrace projektové autorizátory, vytvoření a
klonování projektu, přehled smluv, export a obnovu zálohy. Oba DocHub OAuth
callbacky ověřují projekt uložený v jednorázovém serverovém OAuth state ještě
před token exchange. Globální osobní Microsoft připojení zůstává bez vazby na
projekt. RPC s explicitní identitou uživatele je dostupné pouze `service_role`.

## Ověření a nasazení

1. Porovnejte aktuální schéma a grants s cílovou databází. Migrace při neočekávané
   definici měněného RPC skončí chybou a její transakce se vrátí zpět.
2. V izolovaném PostgreSQL 17 načtěte schéma bez zákaznických dat, aplikujte
   verzovanou migraci a spusťte `supabase/tests/tenant-subscription-boundary.sql`
   pomocí `psql -v ON_ERROR_STOP=1`. Tento test vytváří syntetické identity a končí
   rollbackem; není určen pro produkční databázi.
3. Test pokrývá čtení a zápis A/B, kontakty, nabídky a štítky, audit, Storage,
   export/restore, klonování a vytvoření projektu, obnovu licence, osobní licenci,
   OAuth service RPC, externí sdílení, MCP a výjimku správce.
4. Spusťte Vitest včetně `tests/oauthSubscription.test.ts`, typecheck, web build,
   desktop compile, kontroly dokumentace a architektury.
5. Nasazujte databázovou migraci před Edge Functions
   `dochub-google-callback` a `dochub-microsoft-callback`; cloudové funkce lze
   nasadit přes CLI s `--use-api`, bez lokálního Dockeru.
6. Po nasazení ověřte katalog RLS, funkční ACL, migrační historii, security a
   performance advisors a závěrečný migration dry-run.

Změna neprovádí backfill ani nemění zákaznická data, indexes či foreign keys.
Existující indexy projektů a organizací slouží i scoped kontrolám. Vytvořené
privátní resolvery nelze přímo volat z klientských rolí.

Ruční smoke test: účet se členstvím v platné a expirované firmě vidí a upravuje
projekty platné firmy, ale ne pracovní data expirované firmy. Správa předplatného
zůstává přístupná. Po obnově licence cílové firmy se její data opět zpřístupní.
