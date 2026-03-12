import React from "react";
import { LegalPageLayout } from "./LegalPageLayout";

export const LegalImprint: React.FC = () => {
  return (
    <LegalPageLayout
      title="Provozovatel a kontaktní údaje"
      lead="Základní identifikační a kontaktní údaje provozovatele služby."
      updatedAt="4. února 2026"
    >
      <section>
        <h2 className="text-white text-lg font-semibold">Provozovatel</h2>
        <p className="mt-2">
          Martin Kalkuš
          <br />
          Fyzická osoba podnikající (OSVČ)
          <br />
          IČO: 74907026
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">Kontakt</h2>
        <p className="mt-2">
          E-mail: martinkalkus [zavináč] icloud [tečka] com
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          Odpovědná osoba
        </h2>
        <p className="mt-2">Martin Kalkuš</p>
      </section>
    </LegalPageLayout>
  );
};
