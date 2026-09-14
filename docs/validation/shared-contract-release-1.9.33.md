# Ověření připomínek ke sdíleným smlouvám před 1.9.33

- PR #456, P2: vítězná karta nyní hledá vazbu přes všechny nabídky stejného VŘ.
  Regresní test před opravou selhal; po opravě otevře smlouvu a nemění příznak
  zasmluvnění. Historické vyhledání podle dodavatele zůstává záložní možností.
- P1, obnova tenant zálohy: původní wrapper vyžadoval osobní práva k projektu,
  i když vnitřní obnova již ověřila správce organizace a zachovává vlastníky.
  Migrace `20260914225440` mění pouze tuto dodatečnou kontrolu tenant wrapperu
  na kontrolu správce cílové organizace. Osobní obnova, limity vstupu, kontrola
  členství, filtry organizace a vazby v rámci projektu zůstávají zachované.
- `scripts/check-tenant-shared-contract-restore.sql` klonuje nasazený wrapper
  do dočasného schématu a používá syntetická data. Před opravou ověřen RED
  (42501 pro správce bez osobních práv). Po aplikaci migrace na tento klon GREEN:
  správce uspěje, cizí projekt/tenant, neadministrátor a anonymní přístup selžou.
  Vše končí ROLLBACK; žádná zákaznická záloha se neobnovuje.
- P1, kaskádové mazání: podezření se nepotvrdilo. PostgreSQL FK kaskádu spouští
  pod vlastníkem referenční tabulky, takže invoker trigger může uklidit vazbu
  i při chybějícím přímém UPDATE oprávnění uživatele ke smlouvě. Probe
  `scripts/check-shared-contract-cascade-role.sql` ověřuje mazání nabídky i celé
  kategorie, vyčištění původní vazby a zamítnutí přímého odpojení. Produkční
  trigger ani oprávnění se proto kvůli této připomínce nemění.

Databázové probe skripty vytvářejí pouze dočasné objekty, běží v transakci
s ROLLBACK a nečtou zákaznická data. Nejde o úplnou obnovu skutečné zálohy;
opravovaný wrapper je skutečný, jeho již dříve ověřený vnitřní restorer je
v testu nahrazen kontrolou oprávnění. Uživatelské chování ověřují Vitest testy.

Migrace nasazena 15. 9. 2026, následný test klonu nasazené funkce prošel.
Katalog: migrace evidována právě jednou, žádné osiřelé vazby, anon nemá EXECUTE;
závěrečný CLI dry-run hlásí „Remote database is up to date“.
Security advisors nemají nový typ ani počet nálezů proti preflightu. U wrapperu
zůstává očekávané upozornění na authenticated SECURITY DEFINER: vstup autorizuje
správce, má prázdný search_path a uzavřený grant pro anon. Existující ostatní
nálezy (mutable search_path, veřejně volatelné funkce, vypnutá kontrola uniklých
hesel) nejsou tímto patchem řešeny. Viz [Supabase security linter](https://supabase.com/docs/guides/database/database-linter)
a [ochrana hesel](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Performance advisor nemá nález pro změněnou funkci; dotazy ani indexy se nemění.
