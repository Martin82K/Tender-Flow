import React from "react";
import { LegalPageLayout } from "./LegalPageLayout";

export const LegalCookies: React.FC = () => {
  return (
    <LegalPageLayout
      title="Zásady používání cookies"
      lead="Tyto zásady vysvětlují, jak používáme cookies a podobné technologie."
      updatedAt="4. února 2026"
    >
      <section>
        <h2 className="text-white text-lg font-semibold">1. Co jsou cookies</h2>
        <p className="mt-2">
          Cookies jsou malé textové soubory, které web ukládá do zařízení
          uživatele a které pomáhají zajistit funkčnost a bezpečnost Služby.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">2. Typy cookies</h2>
        <p className="mt-2">
          Používáme nezbytné cookies pro přihlášení a zabezpečení, funkční
          cookies pro zapamatování preferencí a analytické cookies pro zlepšení
          výkonu a uživatelské zkušenosti.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">3. Správa cookies</h2>
        <p className="mt-2">
          Uživatel může nastavení cookies upravit ve svém prohlížeči. Omezení
          cookies může ovlivnit funkčnost některých částí Služby.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">4. Kontakt</h2>
        <p className="mt-2">
          V případě dotazů k cookies nás kontaktujte na
          martinkalkus@icloud.com.
        </p>
      </section>
    </LegalPageLayout>
  );
};
