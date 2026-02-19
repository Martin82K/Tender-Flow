import React from "react";
import { LegalPageLayout } from "./LegalPageLayout";

export const LegalPrivacy: React.FC = () => {
  return (
    <LegalPageLayout
      title="Zásady ochrany osobních údajů"
      lead="Tento dokument popisuje, jak zpracováváme osobní údaje uživatelů služby Tender Flow."
      updatedAt="4. února 2026"
    >
      <section>
        <h2 className="text-white text-lg font-semibold">1. Správce</h2>
        <p className="mt-2">
          Správcem osobních údajů je Martin Kalkuš, IČO: 74907026, místo
          podnikání: Karlovy Vary. Kontaktní e-mail:
          martinkalkus@icloud.com.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          2. Rozsah zpracovávaných údajů
        </h2>
        <p className="mt-2">
          Zpracováváme identifikační a kontaktní údaje, údaje o uživatelském
          účtu, údaje o využívání Služby a případně fakturační údaje.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">3. Účely</h2>
        <p className="mt-2">
          Údaje zpracováváme za účelem poskytování Služby, zákaznické podpory,
          zajištění bezpečnosti, diagnostiky incidentů a zvyšování stability a
          funkčnosti aplikace, vedení účetnictví a splnění zákonných
          povinností. V rámci těchto účelů můžeme zpracovávat nezbytné provozní
          a incident logy. Neprovádíme obsahovou kontrolu uživatelských dat a
          neslouží nám k profilování uživatelů.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">4. Právní základ</h2>
        <p className="mt-2">
          Zpracování probíhá na základě plnění smlouvy, plnění právních
          povinností, oprávněného zájmu a případně souhlasu Uživatelů.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          5. Příjemci a zpracovatelé
        </h2>
        <p className="mt-2">
          Údaje mohou být zpřístupněny poskytovatelům cloudové infrastruktury,
          platebním bránám, nástrojům analytiky a dalším zpracovatelům na základě
          smlouvy o zpracování.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          6. Předávání do třetích zemí
        </h2>
        <p className="mt-2">
          Pokud dochází k předávání údajů mimo EHP, děje se tak v souladu s
          platnými právními předpisy a při použití odpovídajících záruk.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          7. Doba uchování
        </h2>
        <p className="mt-2">
          Údaje uchováváme po dobu trvání smluvního vztahu a dále po dobu
          nezbytnou k ochraně našich právních nároků a splnění zákonných
          povinností. Provozní a incident logy uchováváme po přiměřenou dobu
          nutnou pro bezpečnostní analýzu, řešení incidentů a audit provozu,
          přičemž omezujeme rozsah záznamů na technické informace nezbytné pro
          řešení ohrožení funkčnosti služby.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">8. Práva subjektů</h2>
        <p className="mt-2">
          Uživatelé mají právo na přístup, opravu, výmaz, omezení zpracování,
          přenositelnost a vznést námitku. V případě dotazů lze kontaktovat
          správce na martinkalkus@icloud.com.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">9. Cookies</h2>
        <p className="mt-2">
          Podrobnosti o používání cookies jsou uvedeny v samostatném dokumentu
          „Zásady používání cookies“.
        </p>
      </section>
    </LegalPageLayout>
  );
};
