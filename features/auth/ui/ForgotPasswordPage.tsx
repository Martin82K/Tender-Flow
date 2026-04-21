import React, { useState } from "react";
import { AuthCard } from "./AuthCard";
import { Link, navigate } from "@/shared/routing/router";
import { authService } from "@/services/authService";
import logo from "@/assets/logo.svg";
import "@/features/public/ui/landing-apex.css";
import "@/features/auth/ui/auth-apex.css";

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      await authService.requestPasswordReset(email);
      setStatus("success");
    } catch (error: any) {
      console.error("Password reset error:", error);
      setStatus("error");
      setErrorMessage("Nepodařilo se odeslat email pro obnovu hesla. Zkuste to prosím později.");
    }
  };

  return (
    <div className="landing-apex auth-apex-page">
      <div className="auth-apex-grid" />
      <div className="auth-apex-glow" />

      <header>
        <div className="nav-wrap">
          <div className="logo-group" onClick={() => navigate("/")}>
            <img src={logo} alt="TenderFlow" className="logo-img" />
            <div className="logo-text">TenderFlow</div>
          </div>
          <div className="nav-right">
            <button className="btn-login" onClick={() => navigate("/login")}>
              Přihlásit se
            </button>
            <button className="auth-nav-back" onClick={() => navigate("/")}>
              Zpět
            </button>
          </div>
        </div>
      </header>

      <AuthCard title="Obnova hesla" subtitle="Zadejte svůj email">
        {status === "success" ? (
          <div className="auth-form">
            <div className="auth-alert" style={{ color: "var(--green)", background: "var(--green-dim)", border: "1px solid rgba(52,211,153,0.2)", padding: "1rem" }}>
              <p style={{ fontWeight: 600 }}>Odkaz odeslán!</p>
              <p style={{ fontSize: "0.8125rem", marginTop: "0.25rem", opacity: 0.9 }}>
                Pokud účet s tímto emailem existuje, poslali jsme vám instrukce pro obnovu hesla.
              </p>
            </div>
            <Link
              to="/login"
              className="auth-btn-secondary"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Zpět na přihlášení
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <p style={{ fontSize: "0.8125rem", color: "var(--gray-1)" }}>
              Zadejte emailovou adresu spojenou s vaším účtem. Pošleme vám odkaz pro nastavení nového hesla.
            </p>

            {status === "error" && (
              <div className="auth-alert auth-alert-error">{errorMessage}</div>
            )}

            <input
              type="email"
              placeholder="Váš email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              required
              disabled={status === "loading"}
            />

            <button
              type="submit"
              disabled={status === "loading"}
              className="auth-btn-primary"
            >
              {status === "loading" ? "Odesílám..." : "Odeslat odkaz"}
            </button>

            <div className="auth-links">
              <Link to="/login">Zpět na přihlášení</Link>
              <Link to="/">Hlavní stránka</Link>
            </div>
          </form>
        )}
      </AuthCard>
    </div>
  );
};
