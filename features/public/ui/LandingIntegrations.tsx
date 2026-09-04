import React from "react";
import { Link } from "@shared/routing/router";
import { buildAppUrl } from "@shared/routing/routeUtils";

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
            <span className="integration-eyebrow">02 / Zero Data Retention</span>
            <h3>Co znamená Zero Data Retention?</h3>
            <p>
              ZDR znamená, že Mistral AI u podporovaných API požadavků
              neuchovává vstupy ani výstupy déle, než je nutné k vytvoření
              odpovědi. ZDR máme aktivované pro naši produkční organizaci.
            </p>
            <p className="integration-note">
              Vztahuje se na podporované OCR a další bezstavové API.
              Samostatně uložené soubory a služby s historií mají vlastní
              pravidla. ZDR nemaže dokumenty, které si uložíte v TenderFlow.
              Použití dat k trénování modelů je samostatné nastavení.
            </p>
            <a className="integration-link" href="https://docs.mistral.ai/admin/monitor-comply/zero-data-retention" target="_blank" rel="noopener noreferrer">
              Podmínky ZDR u Mistral AI ↗
            </a>
          </article>
        </div>
      </div>
    </section>

    <section id="mcp" aria-labelledby="landing-mcp-title">
      <div className="container">
        <div className="sec-label">Integrace · Model Context Protocol</div>
        <div className="integration-heading">
          <h2 className="sec-title" id="landing-mcp-title">Vlastní MCP server TenderFlow</h2>
          <p className="sec-desc">
            Propojte svého AI klienta s kontextem projektů. Náš MCP server
            zpřístupňuje vybraná data a podporované operace v rozsahu vašich oprávnění.
          </p>
        </div>
        <ol className="integration-steps">
          <li>
            <span className="integration-eyebrow">01 / Přehled</span>
            <h3>Správné podklady</h3>
            <p>Projekty, nabídky, smluvní přehledy a termíny. Kontaktní údaje vyžadují zvláštní oprávnění.</p>
          </li>
          <li>
            <span className="integration-eyebrow">02 / Změny</span>
            <h3>Nejdříve návrh</h3>
            <p>Vytvoření úkolu nebo podporovaná změna stavu či ceny nabídky: příprava, potvrzení a provedení s auditní stopou.</p>
          </li>
          <li>
            <span className="integration-eyebrow">03 / Kontrola</span>
            <h3>Přístup ve vašich rukou</h3>
            <p>Připojení přes OAuth. Přístupy jednotlivých klientů můžete spravovat a odvolat v nastavení TenderFlow.</p>
          </li>
        </ol>
        <details className="integration-connect">
          <summary>Jak připojit MCP server</summary>
          <div className="integration-connect-body">
            <ol>
              <li>V klientovi s podporou vzdáleného MCP a OAuth přidejte adresu serveru:</li>
            </ol>
            <code>https://www.tenderflow.cz/api/mcp</code>
            <ol start={2}>
              <li>Přihlaste se svým účtem TenderFlow a zkontrolujte souhlas s připojením.</li>
              <li>V Nastavení → Nástroje → MCP přístupy spravujte oprávnění pro kontakty a zápis.</li>
            </ol>
            <p className="integration-note">
              Připojený klient má vlastní pravidla zpracování dat. ZDR u Mistral AI
              se na něj automaticky nevztahuje. Dostupnost nástrojů závisí na vašich
              oprávněních a podpoře klienta.
            </p>
            <Link className="integration-link" to={buildAppUrl("settings", { settingsTab: "tools", settingsSubTab: "mcp" })}>
              Spravovat MCP přístupy
            </Link>
          </div>
        </details>
      </div>
    </section>
  </>
);
