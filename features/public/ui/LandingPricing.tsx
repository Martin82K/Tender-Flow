import React from "react";
import { DEMO_REQUEST_URL } from "../model/demoRequest";
import { ENTERPRISE_FEATURE_GROUPS } from "../model/landingContent";

export const LandingPricing: React.FC = () => (
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
              licenc&iacute; v jednom firemn&iacute;m syst&eacute;mu, včetně
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
);
