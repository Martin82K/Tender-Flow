import React from "react";
import { Link } from "@shared/routing/router";

export const LandingIntegrations: React.FC = () => (
  <>
    <section id="ai-data" aria-labelledby="landing-ai-title">
      <div className="container">
        <div className="sec-label">Mistral AI · Ochrana dat</div>
        <div className="integration-heading">
          <h2 className="sec-title" id="landing-ai-title">Mistral AI pro vaše dokumenty</h2>
          <p className="sec-desc">
            Z naskenované smlouvy k přehledným údajům. Mistral AI pomáhá
            přečíst dokument a získat podklady, které si před uložením zkontrolujete.
          </p>
        </div>
        <div className="integration-grid">
          <article className="integration-card">
            <span className="integration-eyebrow">01 / Dokumenty</span>
            <h3>Podstatné údaje bez přepisování</h3>
            <p>
              Čtení smluv a objednávek pomocí OCR usnadňuje práci s cenou,
              termíny a dalšími parametry subdodávky. Originál zůstává podkladem
              pro kontrolu získaných údajů.
            </p>
            <a className="integration-link" href="/user-manual/">Prohlédnout uživatelský manuál →</a>
          </article>
          <article className="integration-card integration-card-highlight">
            <span className="integration-eyebrow">02 / Ochrana dat</span>
            <h3>Vaše dokumenty zůstávají vaše</h3>
            <p>
              Mistral AI po zpracování dokumentu neukládá jeho obsah ani odpověď
              ve svém API. Používáme režim Zero Data Retention.
            </p>
            <p className="integration-note">
              Při používání AI se řídíme příslušnými pravidly EU AI Act.
              Výsledky máte vždy pod kontrolou a před použitím je ověříte.
            </p>
            <Link className="integration-link" to="/terms">
              Ochrana dat a podmínky používání →
            </Link>
          </article>
        </div>
      </div>
    </section>

    <section id="mcp" aria-labelledby="landing-mcp-title">
      <div className="container">
        <div className="sec-label">MCP · Propojená práce</div>
        <div className="integration-heading">
          <h2 className="sec-title" id="landing-mcp-title">Od e-mailu k dalšímu kroku v projektu</h2>
          <p className="sec-desc">
            Díky vlastnímu MCP serveru může váš AI asistent spojit informace
            z TenderFlow s podklady z e-mailů, kalendáře a dokumentů.
            Místo přepínání mezi aplikacemi zadáte jeden požadavek.
          </p>
        </div>
        <ol className="integration-steps">
          <li>
            <span className="integration-eyebrow">01 / Nová informace</span>
            <h3>Zachytí, co se změnilo</h3>
            <p>
              V připojeném e-mailu najde novou nabídku nebo zprávu dodavatele
              o posunu termínu. Doplní podklady z dokumentů a porovná termín
              s vaším kalendářem.
            </p>
          </li>
          <li>
            <span className="integration-eyebrow">02 / Souvislosti</span>
            <h3>Dohledá souvislosti</h3>
            <p>
              V TenderFlow vyhledá odpovídající projekt, nabídky, smluvní
              přehledy a termíny. Ukáže, jak nová informace souvisí
              s rozpracovanou zakázkou.
            </p>
          </li>
          <li>
            <span className="integration-eyebrow">03 / Další krok</span>
            <h3>Připraví další krok</h3>
            <p>
              Navrhne odpověď dodavateli a navazující úkol. Po vašem schválení
              může v TenderFlow vytvořit úkol nebo upravit stav či cenu nabídky.
            </p>
          </li>
        </ol>
        <div className="integration-card">
          <span className="integration-eyebrow">Příklad zadání</span>
          <p>
            „Najdi poslední e-mail od dodavatele, porovnej nový termín
            s projektem v TenderFlow a mým kalendářem. Připrav odpověď
            a navrhni úkol pro kontrolu nabídky.“
          </p>
          <p className="integration-note">
            E-mail a kalendář zajišťují jejich vlastní konektory. Dostupné kroky
            závisí na připojených službách a oprávněních; o provedení změn
            rozhodujete vy. Připojené služby mají vlastní pravidla ochrany dat.
          </p>
        </div>
      </div>
    </section>
  </>
);
