import React from "react";
import { LegalPageLayout } from "./LegalPageLayout";

export const LegalTerms: React.FC = () => {
  return (
    <LegalPageLayout
      title="Podmínky užívání služby Tender Flow"
      lead="Níže uvedené podmínky upravují užívání služby Tender Flow a souvisejících služeb."
      updatedAt="4. února 2026"
    >
      <section>
        <h2 className="text-white text-lg font-semibold">1. Provozovatel</h2>
        <p className="mt-2">
          Provozovatelem služby je Martin Kalkuš, IČO: 74907026, místo
          podnikání: Karlovy Vary. Kontaktní e-mail:
          martinkalkus@icloud.com.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">2. Definice</h2>
        <p className="mt-2">
          „Služba“ znamená webovou a desktopovou aplikaci Tender Flow a všechny
          související funkce. „Uživatel“ je fyzická či právnická osoba, která
          Službu používá. „Účet“ je přístup k Službě chráněný přihlašovacími
          údaji.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          3. Registrace a účet
        </h2>
        <p className="mt-2">
          Registrací Uživatel potvrzuje, že poskytované údaje jsou pravdivé a
          aktuální. Uživatel je odpovědný za bezpečné uchování přihlašovacích
          údajů a za veškeré aktivity v rámci svého Účtu.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          4. Poskytovaná služba
        </h2>
        <p className="mt-2">
          Služba je poskytována jako „software jako služba“ s funkcemi pro
          správu výběrových řízení, dokumentů, nabídek a týmové spolupráce.
          Konkrétní funkce se mohou lišit dle zvoleného tarifu.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">5. Cena a platby</h2>
        <p className="mt-2">
          Aktuální ceny a tarifní plány jsou uvedeny v aplikaci a na webu.
          Uživatel souhlasí s tím, že služby budou účtovány dle zvoleného tarifu.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          6. Doba trvání a ukončení
        </h2>
        <p className="mt-2">
          Smluvní vztah trvá po dobu aktivního tarifu. Uživatel může tarif kdykoli
          zrušit podle pravidel uvedených v nastavení účtu.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          7. Dostupnost a údržba
        </h2>
        <p className="mt-2">
          Provozovatel usiluje o vysokou dostupnost Služby. V rámci údržby může
          dojít k dočasnému omezení dostupnosti, o kterém bude Uživatel vhodným
          způsobem informován.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          8. Duševní vlastnictví
        </h2>
        <p className="mt-2">
          Služba, její obsah a software jsou chráněny právními předpisy o
          duševním vlastnictví. Uživatel získává nevýhradní licenci k užívání
          Služby v rozsahu nezbytném pro její využití.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          9. Odpovědnost a záruky
        </h2>
        <p className="mt-2">
          Služba je poskytována „tak, jak je“. Provozovatel neodpovídá za škody
          způsobené nesprávným použitím Služby, ztrátou dat nebo výpadky služeb
          třetích stran.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">10. Reklamace</h2>
        <p className="mt-2">
          Uživatel může uplatnit reklamaci prostřednictvím kontaktů uvedených v
          těchto Podmínkách. Provozovatel se zavazuje reklamaci vyřídit bez
          zbytečného odkladu.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          11. Ochrana osobních údajů
        </h2>
        <p className="mt-2">
          Zpracování osobních údajů se řídí samostatným dokumentem „Zásady
          ochrany osobních údajů“.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">12. Závěrečná</h2>
        <p className="mt-2">
          Tyto Podmínky jsou účinné od data uvedeného výše. Provozovatel si
          vyhrazuje právo Podmínky měnit; o změnách bude Uživatel informován
          prostřednictvím aplikace nebo e-mailem.
        </p>
      </section>
    </LegalPageLayout>
  );
};
