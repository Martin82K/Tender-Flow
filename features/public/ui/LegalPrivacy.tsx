import React from "react";
import { LegalPageLayout } from "./LegalPageLayout";

export const LegalPrivacy: React.FC = () => {
  return (
    <LegalPageLayout
      title="Zásady ochrany osobních údajů"
      lead="Tento dokument popisuje, jak v rámci služby Tender Flow zpracováváme osobní údaje, z jakých důvodů tak činíme a jaká práva mohou subjekty údajů uplatnit."
      updatedAt="12. března 2026"
    >
      <section>
        <h2 className="text-white text-lg font-semibold">1. Správce</h2>
        <p className="mt-2">
          Správcem osobních údajů je Martin Kalkuš, IČO: 74907026. Kontaktní
          e-mail: martinkalkus [zavináč] icloud [tečka] com.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          2. Role při zpracování osobních údajů
        </h2>
        <p className="mt-2">
          Ve vztahu k údajům o zákaznících, uživatelích účtů, fakturaci,
          komunikaci a provozu služby vystupujeme zpravidla jako správce
          osobních údajů. V rozsahu, ve kterém uživatel do služby ukládá osobní
          údaje třetích osob v rámci vlastních procesů, může provozovatel
          vystupovat také jako zpracovatel pro daného uživatele.
        </p>
        <p className="mt-2">
          Postavení stran se vždy posuzuje podle konkrétního účelu zpracování a
          role, ve které jsou údaje do služby vloženy nebo prostřednictvím
          služby spravovány.
        </p>
        <p className="mt-2">
          Tyto zásady se použijí jak na vztahy s podnikateli a organizacemi,
          tak na vztahy se spotřebiteli. Rozsah zpracování se může lišit podle
          typu účtu, objednané služby a role konkrétní osoby v systému.
        </p>
        <p className="mt-2">
          Pokud provozovatel při poskytování služby zpracovává osobní údaje pro
          zákazníka jako jeho zpracovatel, řídí se tento vztah také samostatnou
          zpracovatelskou doložkou dostupnou v dokumentu „DPA“.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          3. Kategorie zpracovávaných údajů
        </h2>
        <p className="mt-2">
          Můžeme zpracovávat zejména identifikační a kontaktní údaje, údaje o
          uživatelském účtu, přihlašování a oprávněních, fakturační a platební
          údaje, údaje o komunikaci se zákaznickou podporou a technické údaje o
          používání služby.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>jméno, příjmení, e-mail, telefon a firma,</li>
          <li>údaje spojené s registrací, přístupem a rolí v účtu,</li>
          <li>obsah požadavků na podporu a související komunikaci,</li>
          <li>fakturační údaje a informace o tarifu,</li>
          <li>technické a provozní logy, IP adresa, zařízení a časové údaje.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          4. Účely a právní základy zpracování
        </h2>
        <p className="mt-2">
          Osobní údaje zpracováváme pouze v rozsahu, který je nezbytný pro
          konkrétní účel a odpovídající právní titul.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>plnění smlouvy a poskytování služby, včetně správy účtu a podpory,</li>
          <li>plnění právních povinností, zejména v oblasti účetnictví a daní,</li>
          <li>oprávněný zájem na zabezpečení služby, prevenci zneužití a řešení incidentů,</li>
          <li>oprávněný zájem na základní provozní analytice a zlepšování stability,</li>
          <li>souhlas, pokud je vyžadován pro konkrétní typ zpracování nebo cookies.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          5. Zdroje osobních údajů
        </h2>
        <p className="mt-2">
          Osobní údaje získáváme především přímo od subjektu údajů při
          registraci, objednávce, komunikaci s podporou nebo používání služby.
          V omezeném rozsahu mohou být údaje do systému vloženy také
          oprávněným uživatelem, například při správě týmu, kontaktů nebo
          projektových dat.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          6. Příjemci a zpracovatelé
        </h2>
        <p className="mt-2">
          Osobní údaje mohou být zpřístupněny poskytovatelům cloudové
          infrastruktury, hostingu, databází, analytických nástrojů, platebních
          služeb, účetních nebo právních služeb a dalším zpracovatelům, pokud
          je to nezbytné pro provoz služby nebo splnění zákonných povinností.
        </p>
        <p className="mt-2">
          Se zpracovateli spolupracujeme pouze v nezbytném rozsahu a usilujeme
          o to, aby byli vázáni odpovídajícími smluvními a bezpečnostními
          závazky.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          7. Předávání do třetích zemí
        </h2>
        <p className="mt-2">
          Pokud dochází k předávání údajů mimo EHP, děje se tak v souladu s
          platnými právními předpisy a při použití odpovídajících záruk,
          například standardních smluvních doložek nebo jiného zákonného
          mechanismu.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          8. Doba uchování
        </h2>
        <p className="mt-2">
          Osobní údaje uchováváme pouze po dobu nezbytnou pro naplnění
          konkrétního účelu zpracování. Jakmile účel odpadne, údaje mažeme,
          anonymizujeme nebo dále uchováváme jen tehdy, pokud to vyžaduje
          právní předpis nebo je to nezbytné pro ochranu právních nároků.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>údaje účtu a smluvní komunikace po dobu trvání účtu a jen po nezbytně nutnou dobu po jeho ukončení,</li>
          <li>fakturační, účetní a daňové údaje pouze po minimální dobu vyžadovanou právními předpisy,</li>
          <li>provozní, bezpečnostní a incidentní logy pouze po krátkou dobu nutnou k zabezpečení, prevenci zneužití a diagnostice.</li>
        </ul>
        <p className="mt-2">
          Nestanovujeme delší obecné retenční lhůty, než jaké jsou nezbytné pro
          daný účel. Pokud právní předpis ukládá minimální dobu uchování,
          uchováváme údaje pouze po tuto minimální dobu, ledaže je v konkrétním
          případě nutné delší uchování za účelem obrany nebo uplatnění právních
          nároků.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          9. Zabezpečení a minimalizace
        </h2>
        <p className="mt-2">
          Přijímáme přiměřená technická a organizační opatření na ochranu osobních
          údajů před neoprávněným přístupem, ztrátou, změnou nebo zneužitím.
          Rozsah zpracování se snažíme omezovat na údaje, které jsou skutečně
          potřebné pro konkrétní účel.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          10. Práva subjektů údajů
        </h2>
        <p className="mt-2">
          Uživatelé mají právo na přístup, opravu, výmaz, omezení zpracování,
          přenositelnost a vznést námitku. Pokud je zpracování založeno na
          souhlasu, lze tento souhlas kdykoli odvolat, aniž je tím dotčena
          zákonnost předchozího zpracování.
        </p>
        <p className="mt-2">
          Žádost je možné zaslat na adresu martinkalkus [zavináč] icloud
          [tečka] com. Subjekt údajů má současně právo podat stížnost u Úřadu
          pro ochranu osobních údajů.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          11. Cookies, logy a provozní analytika
        </h2>
        <p className="mt-2">
          V rámci provozu webu a aplikace můžeme používat cookies a podobné
          technologie. Podrobnosti o jejich kategoriích, účelu a správě jsou
          uvedeny v samostatném dokumentu „Zásady používání cookies“.
        </p>
        <p className="mt-2">
          Za účelem zabezpečení, prevence zneužití, diagnostiky a zajištění
          stability zpracováváme také nezbytné technické a incidentní logy.
          Tyto záznamy neslouží k obsahové kontrole uživatelských dat.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          12. Změny těchto zásad
        </h2>
        <p className="mt-2">
          Tyto zásady můžeme průběžně aktualizovat, zejména při změně služby,
          právních požadavků nebo používaných technologií. Aktuální verze je
          vždy zveřejněna na této stránce s datem poslední aktualizace.
        </p>
      </section>
    </LegalPageLayout>
  );
};
