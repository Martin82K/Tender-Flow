# Známá omezení

Tento dokument popisuje ověřené mezery nebo vědomá rozhodnutí. Nejde o seznam
slíbených termínů.

## Testování

### Živé RLS integrační testy

Nejsou součástí CI na základě vědomého rozhodnutí projektu. Security testy
kontrolují SQL migrační kontrakty staticky; neověřují aplikované cloudové schéma
se dvěma reálnými identitami.

### Coverage

`npm run test:coverage` je definovaný, ale chybí provider
`@vitest/coverage-v8`. Coverage není měřená ani vynucená.

### Placeholder backend v CI

Quality workflow používá bezpečné placeholder Supabase hodnoty. Test suite je
unit/contract/build brána, nikoli cloud end-to-end test.

## Architektura

Legacy kořeny stále existují a architektonický audit eviduje přechodové importy.
Migrace probíhá po malých testovaných smyčkách; plošný přesun by byl rizikový.

## Bundle

Vite 8 s Rolldownem stále hlásí dynamický `exceljs` chunk větší než 750 kB.
ExcelJS se načítá až při odpovídajícím exportu, takže nezatěžuje start aplikace,
ale první použití těžkého Excel exportu zůstává evidovaným výkonovým dluhem.
PDF runtime (`jspdf`, `jspdf-autotable`), Markdown parser a vložený Roboto font
se rovněž načítají až při prvním PDF exportu. První export proto může podle sítě
krátce čekat na dynamické chunky; další exporty používají cacheovaný runtime.

## Platformní rozdíly

- Filesystem, biometrika, auto-backup, watcher a některé Excel operace jsou
  desktopové.
- Web potřebuje HTTP/Edge alternativu nebo zobrazí unavailable stav.
- Desktop přístup je navíc omezený tarifem.

## Plánované feature keys

`module_invoicing` a `module_documents` jsou v feature konfiguraci označené jako
plánované. Neznamenají samostatně dokončený veřejný modul.

## Dokumentace vs. uživatelský manuál

Technická dokumentace v `docs/` popisuje vývoj a provoz. Uživatelský manuál má
vlastní build a statická aktiva; jeho obsah se neaktualizuje automaticky při
každé technické změně.
