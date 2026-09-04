import React, { useEffect, useState } from "react";
import { Link, useLocation, navigate } from "@/shared/routing/router";
import { APP_VERSION } from "@/config/version";
import { DEMO_REQUEST_URL } from "@features/public/model/demoRequest";
import logo from "@/assets/logo.svg";
import tenderLandscape from "@/assets/landing/tender-landscape.jpg";
import { TENDER_STORY_STEPS } from "../model/landingContent";
import { LandingPricing } from "./LandingPricing";
import { LandingIntegrations } from "./LandingIntegrations";
import "./landing-apex.css";

export const LandingPage: React.FC = () => {
  const { hash } = useLocation();
  const [activeStoryStep, setActiveStoryStep] = useState("offers");
  const activeStory =
    TENDER_STORY_STEPS.find((step) => step.id === activeStoryStep) ??
    TENDER_STORY_STEPS[1];

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;
    requestAnimationFrame(() =>
      el.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [hash]);

  return (
    <div className="landing-apex" id="top">
      {/* ═══ NAV ═══ */}
      <header>
        <div className="nav-wrap">
          <a className="logo-group" href="#top" aria-label="TenderFlow – úvod">
            <img
              src={logo}
              alt="TenderFlow, CRM pro stavební tendry"
              className="logo-img"
              width={32}
              height={32}
              decoding="async"
              fetchPriority="high"
            />
            <div className="logo-text">
              TenderFlow
            </div>
          </a>
          <nav className="nav-center" aria-label="Hlavní navigace">
            <a href="#funkce">Funkce</a>
            <a href="#ai-data">AI a data</a>
            <a href="#mcp">MCP</a>
            <a href="#ceny">Cen&iacute;k</a>
            <a href="#reference">Reference</a>
          </nav>
          <div className="nav-right">
            <button className="btn-login" onClick={() => navigate("/login")}>
              Přihl&aacute;sit se
            </button>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-shell">
          <div className="hero-content">
            <h1>
              Méně chaosu
              <br />
              kolem tendrů.
              <span> Více jistoty v každé zakázce.</span>
            </h1>
            <p className="hero-sub">
              TenderFlow propojí poptávky, nabídky, dodavatele, termíny i
              smlouvy do jednoho řízeného procesu.
            </p>
            <div className="hero-actions">
              <a className="btn-hero-primary" href={DEMO_REQUEST_URL}>
                Domluvit ukázku
              </a>
            </div>
            <div className="social-strip">
              <div className="social-text">
                Jeden proces. Jedna historie. Jasné rozhodnutí.
              </div>
            </div>
          </div>

          <div
            className="hero-landscape"
            aria-label="Cesta stavebního tendru od podkladů ke smlouvě"
          >
            <img
              src={tenderLandscape}
              alt="Architektonický model krajiny a stavby propojený procesem výběrového řízení"
              width={1586}
              height={992}
              decoding="async"
              fetchPriority="high"
            />
            <div className="story-panel" aria-live="polite">
              <span className="story-panel-kicker">
                {activeStory.number} / {activeStory.label}
              </span>
              <strong>{activeStory.title}</strong>
              <p>{activeStory.detail}</p>
              <span className="story-panel-metric">{activeStory.metric}</span>
            </div>
            <div className="story-steps" aria-label="Fáze výběrového řízení">
              {TENDER_STORY_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className={step.id === activeStory.id ? "active" : ""}
                  aria-pressed={step.id === activeStory.id}
                  onClick={() => setActiveStoryStep(step.id)}
                >
                  <span>{step.number}</span>
                  {step.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MARQUEE ═══ */}
      <div className="marquee-section">
        <div className="marquee-track">
          {[
            "Pipeline tendrů",
            "Správa kontaktů",
            "AI analýza smluv",
            "TODO Osobní",
            "Dokumentový hub",
            "Harmonogram",
            "Excel nástroje",
            "Desktop & Web",
            "Reporting",
          ]
            .concat([
              "Pipeline tendrů",
              "Správa kontaktů",
              "AI analýza smluv",
              "TODO Osobní",
              "Dokumentový hub",
              "Harmonogram",
              "Excel nástroje",
              "Desktop & Web",
              "Reporting",
            ])
            .map((item, i) => (
              <div key={i} className="marquee-item">
                {item}
              </div>
            ))}
        </div>
      </div>

      {/* ═══ FEATURES ═══ */}
      <section id="funkce">
        <div className="container">
          <div className="sec-label">Funkce</div>
          <h2 className="sec-title">
            Vše co potřebujete pro <span className="serif">Vaše v&iacute;tězstv&iacute;</span>
          </h2>
          <p className="sec-desc">
            Sedm modulů navržen&yacute;ch specificky pro česk&eacute; a
            slovensk&eacute; stavebn&iacute; firmy.
          </p>

          <div className="f-bento">
            <div className="f-card f-1">
              <div className="f-tag">Kl&iacute;čov&yacute; modul</div>
              <h3>Inteligentn&iacute; pipeline tendrů</h3>
              <p>
                Vizu&aacute;ln&iacute; Kanban board se sledov&aacute;n&iacute;m
                f&aacute;z&iacute;, automatick&yacute;mi notifikacemi a
                deadliny. Vid&iacute;te přesně kde jsou vaše nab&iacute;dky v
                re&aacute;ln&eacute;m čase.
              </p>
              <div className="f-mini-dash">
                <div className="mini-stats">
                  <div className="mini-stat">
                    <div className="val orange">24</div>
                    <div className="lbl">Aktivn&iacute;</div>
                  </div>
                  <div className="mini-stat">
                    <div className="val green">87%</div>
                    <div className="lbl">Win rate</div>
                  </div>
                  <div className="mini-stat">
                    <div className="val">12.4M</div>
                    <div className="lbl">Objem Kč</div>
                  </div>
                </div>
                <div className="mini-bars">
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              </div>
            </div>
            <div className="f-card f-2">
              <div className="f-tag">AI</div>
              <h3>OCR čten&iacute; objedn&aacute;vek, smluv</h3>
              <p>
                Mistral AI čte naskenované dokumenty a pomáhá získat
                jejich klíčové údaje. Výsledky si zkontrolujete před uložením
                ke smlouvě. ZDR chrání obsah zpracovaný podporovaným API.
              </p>
            </div>
            <div className="f-card f-3">
              <h3>CRM kontakty</h3>
              <p>
                360° pohled na subdodavatele: historie, hodnocen&iacute;,
                nab&iacute;dky, kontaktn&iacute; osoby. Auto doplňov&aacute;n&iacute;
                informac&iacute; o dodavateli z veřejně dostupn&yacute;ch
                rejstř&iacute;ků dle zad&aacute;n&iacute; IČ.
              </p>
            </div>
            <div className="f-card f-4">
              <h3>Složkomat</h3>
              <p>
                Centralizovan&eacute; dokumenty s automatickou strukturou.
                Google Drive, OneDrive nebo lok&aacute;ln&iacute; disk.
              </p>
            </div>
            <div className="f-card f-5">
              <h3>Harmonogram</h3>
              <p>
                Ganttův diagram s miln&iacute;ky, z&aacute;vislostmi a
                t&yacute;movou kolaborac&iacute; v re&aacute;ln&eacute;m čase.
              </p>
            </div>
            <div className="f-card f-6">
              <div className="f-tag">Produktivita</div>
              <h3>TODO Osobn&iacute;</h3>
              <p>
                Osobn&iacute; seznamy, pod&uacute;koly, připom&iacute;nky a
                kalend&aacute;ř drž&iacute; vlastn&iacute; pr&aacute;ci přehledně oddělenou
                od projektů.
              </p>
              <div className="todo-preview" aria-hidden="true">
                <div className="todo-preview-item done">Připravit rozpočet</div>
                <div className="todo-preview-item active">Zavolat investorovi</div>
                <div className="todo-preview-item">Doplnit dokumentaci</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PLATFORM ═══ */}
      <section id="platforma" className="platform-section">
        <div className="container">
          <div className="platform-split">
            <div className="platform-text">
              <div className="sec-label">Platforma</div>
              <h2 className="sec-title">
                Navrženo pro stavebn&iacute;{" "}
                <span className="serif">profesion&aacute;ly</span>
              </h2>
              <p className="sec-desc">
                Dashboard, kter&yacute; ukazuje přesně to, co potřebujete. Web
                i desktop verze se synchronizuj&iacute; v re&aacute;ln&eacute;m
                čase.
              </p>
              <ul className="check-list">
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>TODO Osobn&iacute;</strong>: soukrom&eacute;
                    &uacute;koly, pod&uacute;koly, projekty a připom&iacute;nky
                    v samostatn&eacute;m pracovn&iacute;m prostoru
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>Neomezen&eacute; projekty</strong>: spravujte
                    cel&eacute; portfolio z jednoho m&iacute;sta
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>Real-time synchronizace</strong>: v&aacute;š
                    t&yacute;m vid&iacute; změny okamžitě
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>Export jedn&iacute;m klikem</strong>: PDF, Excel,
                    CSV pro vaše reporty
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>Desktop & Web</strong>: nativn&iacute; Electron
                    app + plnohodnotn&yacute; web
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>GDPR & bezpečnost</strong>: RLS,
                    šifrov&aacute;n&iacute; dat, compliance
                  </span>
                </li>
              </ul>
            </div>
            <div className="app-frame">
              <div className="app-titlebar">
                <div className="app-dot app-dot-r" />
                <div className="app-dot app-dot-y" />
                <div className="app-dot app-dot-g" />
                <div className="app-titlebar-text">
                  TenderFlow Dashboard
                </div>
                <div />
              </div>
              <div className="app-body">
                <div className="app-sidebar">
                  <div className="app-nav-item active">
                    <span className="dot" /> TODO Osobn&iacute;
                  </div>
                  <div className="app-nav-item">
                    <span className="dot" /> Projekty
                  </div>
                  <div className="app-nav-item">
                    <span className="dot" /> Pipeline
                  </div>
                  <div className="app-nav-item">
                    <span className="dot" /> Kontakty
                  </div>
                  <div className="app-nav-item">
                    <span className="dot" /> Dokumenty
                  </div>
                  <div className="app-nav-item">
                    <span className="dot" /> Harmonogram
                  </div>
                  <div className="app-nav-item">
                    <span className="dot" /> Nastaven&iacute;
                  </div>
                </div>
                <div className="app-main">
                  <div className="app-header-row">
                  <div className="app-page-title">TODO Osobn&iacute;</div>
                    <div className="app-mini-btn">+ Rychl&yacute; &uacute;kol</div>
                  </div>
                  <div className="app-kpi-row">
                    <div className="app-kpi">
                      <div className="kv o">7</div>
                      <div className="kl">Akce dnes</div>
                    </div>
                    <div className="app-kpi">
                      <div className="kv g">4</div>
                      <div className="kl">TODO hotovo</div>
                    </div>
                    <div className="app-kpi">
                      <div className="kv">2</div>
                      <div className="kl">Rizika</div>
                    </div>
                  </div>
                  <div className="app-kanban">
                    <div className="kanban-col">
                      <div className="kanban-header">
                        Priorita <span className="count">3</span>
                      </div>
                      <div className="kanban-card">
                        <div className="kc-title">
                          Odeslat poptávku na Vinohrady
                        </div>
                        Dnes 14:00
                        <div className="kc-tag orange">Deadline</div>
                      </div>
                      <div className="kanban-card">
                        <div className="kc-title">Zkontrolovat chyběj&iacute;c&iacute; položky</div>
                        Tender T-2418
                        <div className="kc-tag blue">Riziko</div>
                      </div>
                    </div>
                    <div className="kanban-col">
                      <div className="kanban-header">
                        TODO Osobn&iacute; <span className="count">5</span>
                      </div>
                      <div className="kanban-card">
                        <div className="kc-title">Zavolat investorovi</div>
                        Osobn&iacute; seznam
                        <div className="kc-tag orange">Připom&iacute;nka</div>
                      </div>
                      <div className="kanban-card">
                        <div className="kc-title">Doplnit pozn&aacute;mky z porady</div>
                        2 pod&uacute;koly
                        <div className="kc-tag green">Rozpracovan&eacute;</div>
                      </div>
                    </div>
                    <div className="kanban-col">
                      <div className="kanban-header">
                        Term&iacute;ny{" "}
                        <span className="count">2</span>
                      </div>
                      <div className="kanban-card">
                        <div className="kc-title">Hotel Centrum</div>
                        Nab&iacute;dka za 14 dn&iacute;
                        <div className="kc-tag green">Pl&aacute;n</div>
                      </div>
                    </div>
                    <div className="kanban-col">
                      <div className="kanban-header">
                        Hotovo <span className="count">4</span>
                      </div>
                      <div className="kanban-card">
                        <div className="kc-title">
                          Připraven export podkladů
                        </div>
                        Dokumentový hub
                        <div className="kc-tag green">Vyřešeno</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingIntegrations />
      <LandingPricing />

      {/* ═══ TESTIMONIALS ═══ */}
      <section id="reference">
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <div className="sec-label" style={{ justifyContent: "center" }}>
              Reference
            </div>
            <h2 className="sec-title" style={{ margin: "0 auto" }}>
              Co ř&iacute;kaj&iacute; naši{" "}
              <span className="serif">klienti</span>
            </h2>
          </div>
          <div className="testi-grid">
            <div className="testi-card">
              <div className="testi-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p className="testi-text">
                &bdquo;TenderFlow n&aacute;m přinesl ř&aacute;d do
                nab&iacute;dkov&yacute;ch ř&iacute;zen&iacute;. Co dř&iacute;v
                trvalo dny, zvl&aacute;dneme za hodiny. ROI se n&aacute;m
                vr&aacute;til do tř&iacute; měs&iacute;ců.&ldquo;
              </p>
              <div className="testi-author">
                <div
                  className="testi-avatar"
                  style={{
                    background:
                      "linear-gradient(135deg,var(--orange),var(--orange-dim))",
                  }}
                >
                  JN
                </div>
                <div className="testi-info">
                  <div className="testi-name">Ing. Jan Nov&aacute;k</div>
                  <div className="testi-role">
                    Ředitel divize, Stavebn&iacute; firma
                  </div>
                </div>
              </div>
            </div>
            <div className="testi-card">
              <div className="testi-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p className="testi-text">
                &bdquo;Konečně n&aacute;stroj, kter&yacute; rozum&iacute;
                stavebnictv&iacute;. Pipeline tendrů a automatick&aacute;
                spr&aacute;va dokumentů n&aacute;m ušetřily des&iacute;tky
                hodin měs&iacute;čně.&ldquo;
              </p>
              <div className="testi-author">
                <div
                  className="testi-avatar"
                  style={{
                    background: "linear-gradient(135deg,#06b6d4,#0891b2)",
                  }}
                >
                  PS
                </div>
                <div className="testi-info">
                  <div className="testi-name">Petr Svoboda</div>
                  <div className="testi-role">Projektov&yacute; manažer</div>
                </div>
              </div>
            </div>
            <div className="testi-card">
              <div className="testi-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p className="testi-text">
                &bdquo;Desktop aplikace je skvěl&aacute; pro pr&aacute;ci
                offline. AI anal&yacute;za smluv zachytila podm&iacute;nky,
                kter&eacute; bychom ručně přehl&eacute;dli.&ldquo;
              </p>
              <div className="testi-author">
                <div
                  className="testi-avatar"
                  style={{
                    background:
                      "linear-gradient(135deg,var(--green),#059669)",
                  }}
                >
                  MK
                </div>
                <div className="testi-info">
                  <div className="testi-name">
                    Mgr. Marie Kratochv&iacute;lov&aacute;
                  </div>
                  <div className="testi-role">Legal & Compliance</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ENTERPRISE CTA ═══ */}
      <section className="cta-section">
        <h2>
          Ukažte nám svůj proces.
          <br />
          <span>My vám ukážeme TenderFlow.</span>
        </h2>
        <p>
          Společně projdeme vaše výběrová řízení, tým i způsob práce.
        </p>
        <div className="cta-features">
          <span className="cta-feat">Ukázka nad vaším procesem</span>
          <span className="cta-feat">Firemní onboarding</span>
          <span className="cta-feat">Licence sestavené na míru</span>
        </div>
        <a
          className="btn-hero-primary"
          style={{ fontSize: "1rem", padding: "1.0625rem 3rem" }}
          href={DEMO_REQUEST_URL}
        >
          Domluvit ukázku
        </a>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <div className="footer-brand">
                <img
                  src={logo}
                  alt="TenderFlow"
                  className="logo-img"
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                />
                <div className="footer-brand-name">TenderFlow</div>
              </div>
              <p className="footer-about">
                Modern&iacute; CRM platforma pro ř&iacute;zen&iacute;
                stavebn&iacute;ch tendrů a nab&iacute;dkov&yacute;ch
                ř&iacute;zen&iacute; v Česk&eacute; republice a na Slovensku.
              </p>
            </div>
            <div className="footer-col">
              <h4>Produkt</h4>
              <a href="#funkce">Funkce</a>
              <a href="#ceny">Cen&iacute;k</a>
              <a href="#ai-data">Mistral AI a data</a>
              <a href="#mcp">MCP server</a>
              <a href="/user-manual/">Uživatelská dokumentace</a>
              <a href={DEMO_REQUEST_URL}>Demo na vyž&aacute;d&aacute;n&iacute;</a>
            </div>
            <div className="footer-col">
              <h4>Společnost</h4>
              <Link to="/imprint">Provozovatel</Link>
              <a href="mailto:martin@tenderflow.cz">Kontakt</a>
            </div>
            <div className="footer-col">
              <h4>Pr&aacute;vn&iacute;</h4>
              <Link to="/terms">Obchodn&iacute; podm&iacute;nky</Link>
              <Link to="/privacy">Ochrana soukrom&iacute;</Link>
              <Link to="/cookies">Cookies</Link>
              <Link to="/dpa">DPA</Link>
              <Link to="/imprint">Imprint</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              &copy; {new Date().getFullYear()} TenderFlow s.r.o.
              Všechna pr&aacute;va vyhrazena. v{APP_VERSION}
            </span>
            <div className="footer-bottom-links">
              <Link to="/terms">Podm&iacute;nky</Link>
              <Link to="/privacy">Soukrom&iacute;</Link>
              <Link to="/cookies">Cookies</Link>
            </div>
            <div className="billing-note">
              Fakturace · Bankovní převod
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
