import React from "react";
import { CURRENT_TERMS_UPDATED_AT_LABEL } from "@/shared/legal/legalDocumentVersions";
import { LegalPageLayout } from "./LegalPageLayout";

export const LegalTerms: React.FC = () => {
  return (
    <LegalPageLayout
      title="Podmínky užívání služby Tender Flow"
      lead="Tyto podmínky upravují přístup ke službě Tender Flow, její používání a základní pravidla smluvního vztahu mezi provozovatelem a uživatelem."
      updatedAt={CURRENT_TERMS_UPDATED_AT_LABEL}
    >
      <section>
        <h2 className="text-white text-lg font-semibold">1. Provozovatel</h2>
        <p className="mt-2">
          Provozovatelem služby je Martin Kalkuš, IČO: 74907026. Kontaktní
          e-mail: martinkalkus [zavináč] icloud [tečka] com.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          2. Vymezení služby a smluvního vztahu
        </h2>
        <p className="mt-2">
          Tender Flow je softwarová služba poskytovaná formou SaaS, dostupná
          zejména jako webová a případně desktopová aplikace. Služba slouží
          především ke správě výběrových řízení, projektových podkladů,
          dokumentů, nabídek, interní spolupráce a souvisejících procesů.
        </p>
        <p className="mt-2">
          Smluvní vztah vzniká okamžikem registrace, objednání placeného tarifu
          nebo jiným způsobem, kterým uživatel začne službu oprávněně používat.
          Tyto podmínky se vztahují na každého uživatele služby, včetně osob,
          které přistupují do účtu jménem firmy nebo jiné organizace.
        </p>
        <p className="mt-2">
          Služba může být využívána jak podnikateli a právnickými osobami
          (`B2B`), tak spotřebiteli (`B2C`). Pokud je uživatel spotřebitelem,
          použijí se vedle těchto podmínek také kogentní ustanovení právních
          předpisů na ochranu spotřebitele; tato práva nelze těmito podmínkami
          vyloučit ani omezit.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          3. Registrace, účet a přístupové údaje
        </h2>
        <p className="mt-2">
          Registrací Uživatel potvrzuje, že poskytované údaje jsou pravdivé a
          aktuální. Uživatel odpovídá za to, že k účtu budou přistupovat pouze
          oprávněné osoby, a že rozsah jejich oprávnění odpovídá jejich roli.
        </p>
        <p className="mt-2">
          Uživatel je povinen chránit přihlašovací údaje, používat dostatečně
          bezpečné heslo a bez zbytečného odkladu oznámit podezření na
          neoprávněný přístup, zneužití účtu nebo bezpečnostní incident.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          4. Tarify, cena a platební podmínky
        </h2>
        <p className="mt-2">
          Rozsah funkcí se může lišit podle zvoleného tarifu, individuální
          nabídky nebo aktuálně dostupných modulů. Aktuální ceny jsou uvedeny
          na webu, v aplikaci nebo v individuální nabídce schválené uživatelem.
        </p>
        <p className="mt-2">
          Není-li výslovně uvedeno jinak, jsou ceny uváděny bez DPH. Uživatel
          souhlasí s tím, že služba může být účtována opakovaně po sjednaných
          fakturačních obdobích, případně na základě vystavené faktury nebo
          objednávky.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          5. Uživatelská data a odpovědnost uživatele
        </h2>
        <p className="mt-2">
          Uživatel nese odpovědnost za obsah dat, která do služby vloží,
          zpřístupní nebo prostřednictvím služby zpracovává. Uživatel je dále
          odpovědný za to, že má k těmto datům potřebná oprávnění a že jejich
          použití neporušuje právní předpisy ani práva třetích osob.
        </p>
        <p className="mt-2">
          Provozovatel neprovádí průběžnou obsahovou kontrolu uživatelských dat.
          Je však oprávněn přijmout přiměřená opatření, pokud je to nutné z
          důvodu bezpečnosti služby, splnění právní povinnosti nebo ochrany
          vlastních práv.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          6. Zakázané užití služby
        </h2>
        <p className="mt-2">
          Uživatel nesmí službu používat způsobem, který by ohrožoval její
          bezpečnost, dostupnost nebo integritu, obcházel technická omezení,
          narušoval práva třetích osob nebo byl v rozporu s právními předpisy.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>šířit prostřednictvím služby škodlivý kód nebo nevyžádaný obsah,</li>
          <li>pokoušet se o neoprávněný přístup k účtům, datům nebo infrastruktuře,</li>
          <li>zpřístupňovat službu třetím osobám mimo sjednaný rozsah oprávnění,</li>
          <li>používat službu k porušování mlčenlivosti, autorských práv nebo GDPR.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          7. Dostupnost, údržba a změny služby
        </h2>
        <p className="mt-2">
          Provozovatel usiluje o vysokou dostupnost Služby. V rámci údržby může
          dojít k dočasnému omezení dostupnosti. Provozovatel je oprávněn službu
          průběžně měnit, rozvíjet, aktualizovat nebo upravovat její jednotlivé
          funkce, pokud tím podstatně nesnižuje sjednanou hodnotu služby bez
          rozumného důvodu.
        </p>
        <p className="mt-2">
          Pokud to bude možné, budou plánované odstávky nebo významné změny
          komunikovány předem vhodným způsobem, zejména v aplikaci nebo e-mailem.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          8. Duševní vlastnictví
        </h2>
        <p className="mt-2">
          Služba, její obsah a software jsou chráněny právními předpisy o
          duševním vlastnictví. Uživatel získává nevýhradní licenci k užívání
          Služby v rozsahu nezbytném pro její využití v rámci sjednaného
          tarifu. Bez předchozího písemného souhlasu Provozovatele není
          dovoleno Službu ani její části kopírovat, upravovat, distribuovat,
          zpřístupňovat třetím osobám ani používat k tvorbě odvozených řešení.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          9. Ochrana osobních údajů a důvěrnost
        </h2>
        <p className="mt-2">
          Zpracování osobních údajů se řídí samostatným dokumentem „Zásady
          ochrany osobních údajů“. V rozsahu, ve kterém uživatel do služby
          ukládá osobní údaje třetích osob, odpovídá za zákonnost takového
          zpracování a za splnění svých informačních povinností.
        </p>
        <p className="mt-2">
          Provozovatel přijímá přiměřená technická a organizační opatření k
          ochraně dat a zpracovává pouze nezbytné provozní, bezpečnostní a
          incidentní záznamy potřebné pro provoz, obranu systému a řešení chyb.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          10. Odpovědnost a omezení záruk
        </h2>
        <p className="mt-2">
          Služba je poskytována v podobě, v jaké je průběžně nabízena.
          Provozovatel neodpovídá za škodu vzniklou v důsledku nesprávného
          použití služby, nedostatečného zabezpečení účtu ze strany uživatele,
          vad vstupních dat, výpadků služeb třetích stran nebo okolností, které
          nemohl přiměřeně ovlivnit.
        </p>
        <p className="mt-2">
          Uživatel bere na vědomí, že služba nepředstavuje právní, daňové ani
          účetní poradenství a že za finální kontrolu dokumentů, termínů,
          obchodních podmínek a souladu s právními předpisy odpovídá vždy
          uživatel.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          11. Doba trvání, pozastavení a ukončení
        </h2>
        <p className="mt-2">
          Smluvní vztah trvá po dobu aktivního účtu nebo aktivního tarifu,
          nebylo-li mezi stranami dohodnuto jinak. Uživatel může službu přestat
          používat nebo tarif ukončit způsobem dostupným v aplikaci, e-mailem
          nebo jiným sjednaným postupem.
        </p>
        <p className="mt-2">
          Provozovatel může přístup dočasně omezit nebo smluvní vztah ukončit,
          pokud uživatel podstatně porušuje tyto podmínky, používá službu v
          rozporu s právními předpisy nebo ohrožuje bezpečnost a stabilitu
          systému.
        </p>
        <p className="mt-2">
          Po ukončení smluvního vztahu jsou osobní údaje a další uživatelská
          data uchovávány pouze po dobu nezbytně nutnou pro splnění právní
          povinnosti, ochranu právních nároků, zajištění bezpečnosti nebo
          dokončení technických procesů, jako je rotace záloh. V ostatním
          rozsahu jsou data bez zbytečného odkladu mazána nebo anonymizována.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          12. Reklamace, podpora a komunikace
        </h2>
        <p className="mt-2">
          Uživatel může své dotazy, technické požadavky, reklamace nebo žádosti
          týkající se účtu uplatnit prostřednictvím kontaktního e-mailu
          uvedeného v těchto podmínkách. Provozovatel vyřídí požadavek bez
          zbytečného odkladu, zpravidla podle jeho povahy a složitosti.
        </p>
        <p className="mt-2">
          Je-li uživatel spotřebitelem, může se v případě spotřebitelského
          sporu obrátit také na Českou obchodní inspekci jako subjekt
          mimosoudního řešení spotřebitelských sporů. Tím není dotčeno jeho
          právo obrátit se na soud.
        </p>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold">
          13. Změny podmínek a závěrečná ustanovení
        </h2>
        <p className="mt-2">
          Tyto Podmínky jsou účinné od data uvedeného výše. Provozovatel si
          vyhrazuje právo Podmínky v přiměřeném rozsahu měnit; o podstatných
          změnách bude Uživatel informován prostřednictvím aplikace nebo e-mailem.
        </p>
        <p className="mt-2">
          Pokud některé ustanovení těchto podmínek bude neplatné nebo
          nevymahatelné, nemá to vliv na platnost ostatních ustanovení.
          Právní vztahy se řídí právním řádem České republiky.
        </p>
      </section>
    </LegalPageLayout>
  );
};
