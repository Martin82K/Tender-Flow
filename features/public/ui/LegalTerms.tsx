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
          Službu nabízíme jako firemní licenci Enterprise s individuální
          cenou. Rozsah funkcí, počet uživatelů, cena, fakturační období a
          případné další podmínky jsou sjednány v nabídce nebo objednávce
          schválené zákazníkem.
        </p>
        <p className="mt-2">
          U nově sjednaných licencí platba probíhá výhradně bankovním převodem
          na základě vystavené faktury.
          Číslo účtu, splatnost a platební údaje jsou uvedeny na faktuře.
          Při opakovaném poskytování služby vystavujeme fakturu za sjednané
          období. Nové platby kartou ani automatické strhávání z karty nenabízíme.
        </p>
        <p className="mt-2">
          U dříve uzavřených smluv se způsob úhrady řídí dosavadním ujednáním
          až do sjednání změny. Samotné přijetí těchto podmínek nemění ani
          neruší dříve sjednaný způsob platby; přechod na fakturaci převodem
          je třeba dohodnout s provozovatelem.
        </p>
        <p className="mt-2">
          Není-li v nabídce pro podnikatele výslovně uvedeno jinak, jsou ceny
          uváděny bez DPH. Spotřebiteli je před objednáním sdělena konečná
          cena včetně všech daní a povinných poplatků.
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
          9. Ochrana dat, umělá inteligence a propojení služeb
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
        <p className="mt-2">
          Při čtení dokumentů prostřednictvím Mistral AI platí následující
          ochrana: Mistral AI po zpracování dokumentu neukládá jeho obsah ani
          odpověď ve svém API. Pro toto
          zpracování máme aktivovaný režim Zero Data Retention (ZDR).
          Dokumenty a výsledky uložené v TenderFlow zůstávají dostupné pro
          vaši práci a jejich uchování se řídí těmito podmínkami a zásadami
          ochrany osobních údajů.
        </p>
        <p className="mt-2">
          Toto ujištění platí pro zpracování prostřednictvím Mistral AI.
          Při volbě jiné AI služby v nastavení organizace se uplatní pravidla
          dané služby. Správce organizace před takovou změnou ověří ochranu dat
          a informuje uživatele o zvoleném zpracování.
        </p>
        <p className="mt-2">
          Při používání AI se řídíme příslušnými pravidly EU AI Act
          (nařízení Evropského parlamentu a Rady (EU) 2024/1689).
          AI slouží jako pomocný nástroj. Její výstupy mohou obsahovat chyby;
          uživatel je před použitím zkontroluje podle původních podkladů
          a odpovídá za konečné rozhodnutí.
        </p>
        <p className="mt-2">
          Vlastní MCP server umožňuje připojení dalších aplikací na základě
          oprávnění udělených uživatelem. Přístup lze odvolat v nastavení.
          Podporované změny dat vyžadují potvrzení. Připojený klient má vlastní
          pravidla zpracování dat; ochrana ZDR pro Mistral AI v TenderFlow se
          na něj automaticky nevztahuje. Před připojením uživatel ověří, jaká
          data aplikaci zpřístupňuje a zda k tomu má potřebná oprávnění.
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
          Toto znění je dostupné pro nově uzavírané smlouvy od data uvedeného
          výše. Pro stávající smluvní vztahy se nové znění použije až po jeho
          přijetí uživatelem nebo po jiné výslovné dohodě stran. Do té doby
          platí dosavadní ujednání.
        </p>
        <p className="mt-2">
          Provozovatel může navrhnout přiměřené změny podmínek. O podstatných
          změnách informuje uživatele prostřednictvím aplikace nebo e-mailem
          a zpřístupní mu nové znění k přijetí.
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
