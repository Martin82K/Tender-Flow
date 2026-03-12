import React from "react";
import { LegalPageLayout } from "./LegalPageLayout";

export const LegalCookies: React.FC = () => {
  return (
    <LegalPageLayout
      title="Zásady používání cookies"
      lead="Tyto zásady vysvětlují, jaké cookies a podobné technologie můžeme používat na webu a v souvisejících částech služby Tender Flow."
      updatedAt="12. března 2026"
    >
      <section>
        <h2 className="text-white text-lg font-semibold">1. Co jsou cookies</h2>
        <p className="mt-2">
          Cookies jsou malé textové soubory, které web ukládá do zařízení
          uživatele. Podobné technologie mohou zahrnovat také lokální úložiště,
          identifikátory relace nebo technické značky používané k zajištění
          funkčnosti, bezpečnosti a měření provozu služby.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          2. Jaké kategorie cookies můžeme používat
        </h2>
        <p className="mt-2">
          Rozsah používaných cookies se může v čase měnit podle funkcí webu a
          aplikace. Typicky mohou být používány tyto kategorie:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>nezbytné cookies pro přihlášení, zabezpečení a správné fungování služby,</li>
          <li>funkční cookies pro zapamatování voleb a preferencí uživatele,</li>
          <li>analytické cookies pro měření návštěvnosti, výkonu a stability.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          3. Právní základ používání cookies
        </h2>
        <p className="mt-2">
          Nezbytné cookies používáme na základě našeho oprávněného zájmu na
          bezpečném a funkčním provozu služby. Ostatní cookies používáme pouze
          tehdy, pokud to vyžadují právní předpisy a pokud k tomu byl udělen
          odpovídající souhlas.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          4. Cookies třetích stran
        </h2>
        <p className="mt-2">
          Některé cookies mohou být nastavovány nebo vyhodnocovány také
          externími poskytovateli, například v souvislosti s hostingem,
          analytikou nebo technickou podporou. Tito poskytovatelé mohou
          vystupovat jako samostatní správci nebo zpracovatelé podle povahy
          konkrétní služby.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          5. Jak lze cookies spravovat
        </h2>
        <p className="mt-2">
          Uživatel může své preference upravit prostřednictvím cookie lišty,
          pokud je na webu zobrazena, a dále v nastavení svého prohlížeče.
          Omezení nebo blokace některých cookies může ovlivnit funkčnost,
          pohodlí používání nebo dostupnost některých částí služby.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          6. Kontakt a změny těchto zásad
        </h2>
        <p className="mt-2">
          V případě dotazů k používání cookies nás kontaktujte na
          martinkalkus@icloud.com. Tyto zásady můžeme průběžně aktualizovat a
          aktuální verze je vždy zveřejněna na této stránce.
        </p>
      </section>
    </LegalPageLayout>
  );
};
