import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useLocation, navigate } from "@/shared/routing/router";
import { APP_VERSION } from "../config/version";
import { DEMO_REQUEST_URL } from "@features/public/model/demoRequest";
import logo from "@/assets/logo.svg";
import "@/features/public/ui/landing-apex.css";

const ENTERPRISE_FEATURE_GROUPS: ReadonlyArray<{
  title: string;
  items: ReadonlyArray<string>;
}> = [
  {
    title: "Tendry & projekty",
    items: [
      "Command Center s prioritami dne",
      "TODO Osobní s podúkoly",
      "Neomezené projekty",
      "Plán výběrových řízení",
      "Importy VŘ",
      "Harmonogram měsíc / týden / den",
      "Modul subdodavatelé",
      "Hodnocení dodavatelů",
      "Sdílení projektů v týmu",
      "Archivace projektů",
      "Základní i detailní reporty",
    ],
  },
  {
    title: "Dokumenty & AI",
    items: [
      "Modul Smlouvy",
      "OCR čtení dokumentů (AI)",
      "Složkomat — automatizace složek",
      "Excel Indexace VŘ",
      "Excel Spojení listů",
      "Excel – odemčení",
      "Export do Excel",
      "Export do PDF",
    ],
  },
  {
    title: "Platforma & integrace",
    items: [
      "Desktopová aplikace",
      "Automatické aktualizace v aplikaci",
      "Okamžitý přístup k novinkám",
      "Pokročilé integrace",
      "Geokódování kontaktů",
      "Integrace mapy s kontakty",
      "Onboarding asistence",
    ],
  },
];

/** Animated counter that counts up from 0 to `target` when visible. */
const AnimatedCounter: React.FC<{ target: number; suffix?: string }> = ({
  target,
  suffix = "+",
}) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const startTime = performance.now();
          const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="counter-value">
      {count}
      {suffix}
    </span>
  );
};

export const LandingPage: React.FC = () => {
  const { hash } = useLocation();

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
    <div className="landing-apex">
      {/* ═══ NAV ═══ */}
      <header>
        <div className="nav-wrap">
          <div
            className="logo-group"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <img
              src={logo}
              alt="TenderFlow — CRM pro stavební tendry"
              className="logo-img"
              width={32}
              height={32}
              decoding="async"
              fetchPriority="high"
            />
            <div className="logo-text">
              TenderFlow
            </div>
          </div>
          <nav className="nav-center">
            <a onClick={() => scrollToSection("funkce")}>Funkce</a>
            <a onClick={() => scrollToSection("platforma")}>Platforma</a>
            <a onClick={() => scrollToSection("ceny")}>Cen&iacute;k</a>
            <a onClick={() => scrollToSection("reference")}>Reference</a>
          </nav>
          <div className="nav-right">
            <button className="btn-login" onClick={() => navigate("/login")}>
              Přihl&aacute;sit se
            </button>
            <button
              className="btn-start"
              onClick={() => navigate("/register")}
            >
              Začít zdarma
            </button>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-line" />
        <div className="hero-line" />
        <div className="hero-line" />
        <div className="hero-line" />
        <div className="hero-content">
          <div className="hero-badge">
            <span>AI-powered spr&aacute;va tendrů</span>
            <span className="badge-new">Nov&eacute;</span>
          </div>
          <h1>
            Stavebn&iacute; tendry,
            <br />
            <span className="serif">přehledně.</span>
          </h1>
          <p className="hero-sub">
            Kompletn&iacute; platforma pro ř&iacute;zen&iacute;
            nab&iacute;dkov&yacute;ch ř&iacute;zen&iacute;, subdodavatelů a
            projektov&eacute; dokumentace. Od správy kontaktů k poptávce až po zápisy, přehledy a smlouvy.
          </p>
          <div className="hero-actions">
            <button
              className="btn-hero-primary"
              onClick={() => navigate("/register")}
            >
              Vyzkoušet 14 dn&iacute; zdarma
            </button>
            <a className="btn-hero-secondary" href={DEMO_REQUEST_URL}>
              Vyž&aacute;dat demo →
            </a>
          </div>
          <div className="social-strip">
            <div className="social-text">
              Platforma pro efektivn&iacute; ř&iacute;zen&iacute; tendrů
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
            "Command Center",
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
              "Command Center",
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
            Osm modulů navržen&yacute;ch specificky pro česk&eacute; a
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
                Pomoc&iacute; AI je zajištěno čten&iacute; naskenovan&yacute;ch
                dokumentů pro z&iacute;sk&aacute;n&iacute; parametrů. Buduje
                přehled o parametrech subdod&aacute;vek pro stavbu.
                &Uacute;spora času proti proč&iacute;t&aacute;n&iacute;
                naskenovan&yacute;ch dokumentů.
              </p>
            </div>
            <div className="f-card f-3">
              <h3>CRM kontakty</h3>
              <p>
                360° pohled na subdodavatele — historie, hodnocen&iacute;,
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
              <div className="f-tag">Nov&eacute;</div>
              <h3>Command Center</h3>
              <p>
                Denn&iacute; operačn&iacute; přehled spojuje term&iacute;ny,
                rizika, akce z tendrů a osobn&iacute; &uacute;koly do jednoho
                prioritn&iacute;ho frontu.
              </p>
              <div className="command-preview" aria-hidden="true">
                <div className="command-preview-row urgent">
                  <span>!</span>
                  <strong>Dnes odeslat poptávku</strong>
                </div>
                <div className="command-preview-row">
                  <span>✓</span>
                  <strong>Zkontrolovat smlouvu</strong>
                </div>
                <div className="command-preview-row muted">
                  <span>•</span>
                  <strong>Navázat kontakt s dodavatelem</strong>
                </div>
              </div>
            </div>
            <div className="f-card f-7">
              <div className="f-tag">Produktivita</div>
              <h3>TODO Osobn&iacute;</h3>
              <p>
                Osobn&iacute; seznamy, pod&uacute;koly, připom&iacute;nky a
                kalend&aacute;ř drž&iacute; vlastn&iacute; pr&aacute;ci oddělenou
                od projektů, ale viditelnou v Command Center.
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
                    <strong>Command Center</strong> — prioritn&iacute; fronta
                    akc&iacute;, term&iacute;nů a osobn&iacute;ch TODO na jednom
                    m&iacute;stě
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>TODO Osobn&iacute;</strong> — soukrom&eacute;
                    &uacute;koly, pod&uacute;koly, projekty a připom&iacute;nky
                    napojen&eacute; na denn&iacute; přehled
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>Neomezen&eacute; projekty</strong> — spravujte
                    cel&eacute; portfolio z jednoho m&iacute;sta
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>Real-time synchronizace</strong> — v&aacute;š
                    t&yacute;m vid&iacute; změny okamžitě
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>Export jedn&iacute;m klikem</strong> — PDF, Excel,
                    CSV pro vaše reporty
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>Desktop & Web</strong> — nativn&iacute; Electron
                    app + plnohodnotn&yacute; web
                  </span>
                </li>
                <li>
                  <div className="check-icon">&#10003;</div>
                  <span>
                    <strong>GDPR & bezpečnost</strong> — RLS,
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
                  TenderFlow — Dashboard
                </div>
                <div />
              </div>
              <div className="app-body">
                <div className="app-sidebar">
                  <div className="app-nav-item active">
                    <span className="dot" /> Command Center
                  </div>
                  <div className="app-nav-item">
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
                    <div className="app-page-title">Command Center</div>
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

      {/* ═══ PRICING ═══ */}
      <section id="ceny">
        <div className="pricing-container">
          <div style={{ textAlign: "center" }}>
            <div className="sec-label" style={{ justifyContent: "center" }}>
              Cen&iacute;k
            </div>
            <h2
              className="sec-title"
              style={{ margin: "0 auto 0.75rem" }}
            >
              Firemn&iacute; licence,{" "}
              <span className="serif">
                domluven&eacute; na m&iacute;ru
              </span>
            </h2>
            <p
              className="sec-desc"
              style={{ margin: "0 auto 2rem", textAlign: "center" }}
            >
              TenderFlow nab&iacute;z&iacute;me v&yacute;hradně jako Enterprise
              řešen&iacute; pro stavebn&iacute; firmy. Cenu, fakturačn&iacute;
              obdob&iacute; a počet licenc&iacute; sestavujeme na m&iacute;ru
              po firemn&iacute; konzultaci.
            </p>
          </div>

          <div className="enterprise-card">
            <div className="enterprise-card-head">
              <div className="enterprise-card-tier">
                <div className="tier-icon enterprise">&#9670;</div>
                <span>Enterprise</span>
              </div>
              <div className="enterprise-card-price">
                <span className="price-amount custom">Na m&iacute;ru</span>
                <span className="enterprise-card-price-note">
                  podle počtu licenc&iacute; a obdob&iacute;
                </span>
              </div>
            </div>

            <p className="enterprise-card-lead">
              Kompletn&iacute; platforma pro ř&iacute;zen&iacute; tendrů,
              obchodn&iacute; pipeline, dokumentů, reportingu a t&yacute;mov&yacute;ch
              licenc&iacute; v jednom firemn&iacute;m syst&eacute;mu — včetně
              všech modulů a AI funkc&iacute;.
            </p>

            <div className="price-divider" />

            <div className="enterprise-feature-grid">
              {ENTERPRISE_FEATURE_GROUPS.map((group) => (
                <div key={group.title} className="enterprise-feature-col">
                  <div className="enterprise-feature-col-title">
                    {group.title}
                  </div>
                  <ul className="price-features">
                    {group.items.map((item) => (
                      <li key={item}>
                        <span className="pf-check on">&#10003;</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="price-divider" />

            <div className="enterprise-pricing-actions">
              <a
                className="enterprise-pricing-cta"
                href="mailto:martin@tenderflow.cz?subject=Enterprise%20TenderFlow%20demo"
              >
                Domluvit firemn&iacute; konzultaci
              </a>
              <a
                className="enterprise-pricing-secondary"
                href={DEMO_REQUEST_URL}
              >
                Vyž&aacute;dat demo
              </a>
            </div>
          </div>

          <p className="price-note">
            Enterprise fakturace prob&iacute;h&aacute; smluvně bankovn&iacute;m
            převodem podle dohodnut&eacute;ho obdob&iacute; a počtu licenc&iacute;.
          </p>
        </div>
      </section>

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

      {/* ═══ CTA with animated counter ═══ */}
      <section className="cta-section">
        <h2>
          Připraveni ř&iacute;dit tendry
          <br />
          <span className="serif">přehledně?</span>
        </h2>
        <p>
          Přidejte se k firm&aacute;m, kter&eacute; stav&iacute; efektivněji.
        </p>
        <div className="cta-features">
          <span className="cta-feat">14 dn&iacute; zdarma</span>
          <span className="cta-feat">Bez kreditn&iacute; karty</span>
          <span className="cta-feat">Zrušen&iacute; kdykoliv</span>
        </div>
        <button
          className="btn-hero-primary"
          style={{ fontSize: "1rem", padding: "1.0625rem 3rem" }}
          onClick={() => navigate("/register")}
        >
          Vytvořit &uacute;čet zdarma
        </button>
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
              <a onClick={() => scrollToSection("funkce")}>Funkce</a>
              <a onClick={() => scrollToSection("ceny")}>Cen&iacute;k</a>
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
            <div className="stripe-badge">
              Platby přes{" "}
              <strong style={{ color: "var(--gray-1)" }}>Stripe</strong>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
