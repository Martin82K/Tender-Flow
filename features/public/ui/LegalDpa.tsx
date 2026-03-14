import React from "react";
import {
  COMPLIANCE_PUBLIC_UPDATED_AT,
  complianceBootstrapProcessingActivities,
  complianceBootstrapSubprocessors,
  getBootstrapSubprocessorsForActivity,
} from "@/shared/compliance/complianceRegistryBootstrap";
import { LegalPageLayout } from "./LegalPageLayout";

export const LegalDpa: React.FC = () => {
  return (
    <LegalPageLayout
      title="Zpracovatelská doložka (DPA)"
      lead="Tento dokument upravuje podmínky zpracování osobních údajů, pokud Tender Flow vystupuje vůči zákazníkovi jako zpracovatel."
      updatedAt={COMPLIANCE_PUBLIC_UPDATED_AT}
    >
      <section>
        <h2 className="text-white text-lg font-semibold">
          1. Co je DPA
        </h2>
        <p className="mt-2">
          DPA je zkratka pro `Data Processing Agreement`, tedy smlouvu nebo
          doložku o zpracování osobních údajů. Upravuje situace, kdy zákazník
          jako správce osobních údajů využívá Tender Flow a provozovatel služby
          pro něj osobní údaje technicky zpracovává jako zpracovatel.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          2. Smluvní strany a role
        </h2>
        <p className="mt-2">
          Zákazník je ve vztahu k osobním údajům vloženým do služby zpravidla
          správcem osobních údajů. Provozovatel Tender Flow je v tomto rozsahu
          zpracovatelem, pokud zpracovává osobní údaje jménem zákazníka a podle
          jeho pokynů.
        </p>
        <p className="mt-2">
          Tato doložka se použije zejména pro `B2B` zákazníky a pro všechny
          případy, kdy zákazník ve službě eviduje osobní údaje svých
          zaměstnanců, kontaktních osob, dodavatelů, subdodavatelů nebo jiných
          fyzických osob.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          3. Předmět a účel zpracování
        </h2>
        <p className="mt-2">
          Předmětem zpracování jsou osobní údaje, které zákazník do služby
          vloží, importuje nebo jinak zpřístupní při používání Tender Flow.
          Účelem zpracování je umožnit poskytování služby, správu účtu,
          ukládání a organizaci dat, spolupráci uživatelů, technickou podporu,
          zabezpečení a související provozní činnosti.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          4. Kategorie údajů a subjektů údajů
        </h2>
        <p className="mt-2">
          Rozsah zpracovávaných osobních údajů určuje zákazník. Může jít
          zejména o identifikační a kontaktní údaje, pracovní nebo obchodní
          zařazení, údaje obsažené v projektových podkladech a komunikaci a
          další údaje, které zákazník do služby vloží.
        </p>
        <p className="mt-2">
          Subjekty údajů mohou být zejména zaměstnanci zákazníka, členové týmu,
          kontaktní osoby obchodních partnerů, dodavatelé, subdodavatelé nebo
          jiné fyzické osoby související s projekty a výběrovými řízeními.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {complianceBootstrapProcessingActivities.map((activity) => (
            <li key={activity.id}>
              <strong>{activity.activityName}</strong>: {activity.dataCategories.join(", ")}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          5. Pokyny správce
        </h2>
        <p className="mt-2">
          Provozovatel zpracovává osobní údaje pouze na základě pokynů
          zákazníka, které vyplývají zejména ze smlouvy, nastavení služby,
          funkcionality aplikace a této doložky, ledaže je zpracování vyžadováno
          právním předpisem.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          6. Povinnosti provozovatele jako zpracovatele
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>zpracovávat osobní údaje pouze v rozsahu nutném pro poskytování služby,</li>
          <li>zajistit důvěrnost osob oprávněných s údaji nakládat,</li>
          <li>přijímat přiměřená technická a organizační bezpečnostní opatření,</li>
          <li>pomoci zákazníkovi v přiměřeném rozsahu při plnění práv subjektů údajů, pokud to povaha služby umožňuje,</li>
          <li>oznámit zákazníkovi bez zbytečného odkladu zjištěné porušení zabezpečení osobních údajů, pokud se týká údajů zpracovávaných podle této doložky.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          7. Subzpracovatelé
        </h2>
        <p className="mt-2">
          Zákazník bere na vědomí, že provozovatel může pro poskytování služby
          využívat subzpracovatele, zejména poskytovatele hostingu, cloudové
          infrastruktury, databází, podpůrných technologií a souvisejících
          technických služeb.
        </p>
        <p className="mt-2">
          Provozovatel odpovídá za to, že subzpracovatelé budou vázáni
          odpovídající smluvní povinností chránit osobní údaje alespoň v
          rozsahu srovnatelném s touto doložkou.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {complianceBootstrapSubprocessors.map((subprocessor) => (
            <li key={subprocessor.id}>
              <strong>{subprocessor.name}</strong>: {subprocessor.purpose} ({subprocessor.region})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          8. Předávání do třetích zemí
        </h2>
        <p className="mt-2">
          Pokud by v souvislosti s poskytováním služby docházelo k předání
          osobních údajů mimo Evropský hospodářský prostor, zajistí provozovatel
          odpovídající právní mechanismus, například standardní smluvní
          doložky nebo jinou přípustnou záruku podle GDPR.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          9. Doba zpracování a výmaz
        </h2>
        <p className="mt-2">
          Osobní údaje jsou zpracovávány po dobu trvání smluvního vztahu se
          zákazníkem a po jeho ukončení pouze po dobu nezbytně nutnou k
          dokončení technických procesů, splnění právní povinnosti, ochraně
          právních nároků nebo zajištění bezpečnosti.
        </p>
        <p className="mt-2">
          Po odpadnutí účelu zpracování provozovatel údaje vymaže,
          anonymizuje nebo je dále uchová jen v minimálním rozsahu a po
          minimální dobu vyžadovanou právním předpisem. Totéž platí pro
          technické logy a zálohy, které jsou drženy pouze po nezbytně nutnou
          dobu odpovídající provozu a zabezpečení služby.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {complianceBootstrapProcessingActivities.map((activity) => (
            <li key={activity.id}>
              <strong>{activity.activityName}</strong>: {getBootstrapSubprocessorsForActivity(activity)
                .map((subprocessor) => subprocessor.name)
                .join(", ") || "bez subprocesorů"}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          10. Součinnost a audity
        </h2>
        <p className="mt-2">
          Provozovatel poskytne zákazníkovi na přiměřenou žádost součinnost
          potřebnou k doložení souladu s touto doložkou, pokud je taková
          součinnost rozumná, přiměřená a neohrožuje bezpečnost služby,
          důvěrnost ostatních zákazníků ani obchodní tajemství provozovatele.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          11. Odpovědnost zákazníka jako správce
        </h2>
        <p className="mt-2">
          Zákazník odpovídá za zákonnost zpracování osobních údajů, které do
          služby vloží, za existenci právního titulu, splnění informačních
          povinností vůči subjektům údajů a za to, že jeho pokyny vůči
          provozovateli jsou v souladu s právními předpisy.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          12. Závěrečná ustanovení
        </h2>
        <p className="mt-2">
          Tato zpracovatelská doložka tvoří součást smluvního rámce mezi
          zákazníkem a provozovatelem v rozsahu, v jakém provozovatel vystupuje
          jako zpracovatel. V případě rozporu mezi touto doložkou a kogentními
          právními předpisy mají přednost právní předpisy.
        </p>
      </section>
    </LegalPageLayout>
  );
};
