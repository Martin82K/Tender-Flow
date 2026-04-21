import React from "react";
import logo from "@/assets/logo.svg";
import { Link, navigate } from "@/shared/routing/router";
import { APP_VERSION } from "@/config/version";
import "@/features/public/ui/landing-apex.css";

type LegalPageLayoutProps = {
  title: string;
  lead?: string;
  updatedAt: string;
  children: React.ReactNode;
};

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  title,
  lead,
  updatedAt,
  children,
}) => {
  return (
    <div className="landing-apex">
      <header>
        <div className="nav-wrap">
          <div
            className="logo-group"
            onClick={() => navigate("/")}
          >
            <img src={logo} alt="TenderFlow" className="logo-img" />
            <div className="logo-text">TenderFlow</div>
          </div>
          <div className="nav-right">
            <button className="btn-login" onClick={() => navigate("/login")}>
              Přihlásit se
            </button>
            <button className="btn-start" onClick={() => navigate("/")}>
              Zpět
            </button>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "7rem 2rem 4rem",
          position: "relative",
          zIndex: 2,
        }}
      >
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: "2.5rem",
            boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Top accent line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              height: 1,
              background:
                "linear-gradient(90deg, transparent, var(--orange-glow-strong), transparent)",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <span className="sec-label">Právní informace</span>
            <h1
              style={{
                fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                fontWeight: 700,
                letterSpacing: "-0.035em",
                lineHeight: 1.12,
                color: "var(--white)",
              }}
            >
              {title}
            </h1>
            {lead ? (
              <p style={{ color: "var(--gray-1)", lineHeight: 1.7, fontWeight: 350 }}>
                {lead}
              </p>
            ) : null}
            <p style={{ fontSize: "0.75rem", color: "var(--gray-2)" }}>
              Poslední aktualizace: {updatedAt}
            </p>
          </div>

          <div
            className="legal-content"
            style={{
              marginTop: "2.5rem",
              fontSize: "0.9375rem",
              color: "var(--gray-1)",
              lineHeight: 1.8,
            }}
          >
            {children}
          </div>
        </section>

        {/* Footer links */}
        <div
          style={{
            marginTop: "2.5rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "center",
            gap: "2rem",
            flexWrap: "wrap",
            fontSize: "0.8125rem",
          }}
        >
          <Link to="/terms" style={{ color: "var(--gray-2)", transition: "color .2s" }}>
            Podmínky
          </Link>
          <Link to="/privacy" style={{ color: "var(--gray-2)", transition: "color .2s" }}>
            Soukromí
          </Link>
          <Link to="/cookies" style={{ color: "var(--gray-2)", transition: "color .2s" }}>
            Cookies
          </Link>
          <Link to="/dpa" style={{ color: "var(--gray-2)", transition: "color .2s" }}>
            DPA
          </Link>
          <Link to="/imprint" style={{ color: "var(--gray-2)", transition: "color .2s" }}>
            Provozovatel
          </Link>
        </div>
        <div
          style={{
            textAlign: "center",
            marginTop: "1rem",
            fontSize: "0.6875rem",
            color: "var(--gray-2)",
          }}
        >
          &copy; {new Date().getFullYear()} TenderFlow s.r.o. v{APP_VERSION}
        </div>
      </main>
    </div>
  );
};
