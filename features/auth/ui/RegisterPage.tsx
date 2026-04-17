import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthCard } from "./AuthCard";
import { Link, navigate, useLocation } from "@/shared/routing/router";
import { authService } from "@/services/authService";
import { getCurrentLegalAcceptanceInput } from "@/shared/legal/legalDocumentVersions";
import { getLegalDocumentUrl } from "@/shared/legal/legalDocumentLinks";
import logo from "@/assets/logo.png";
import "@/features/public/ui/landing-apex.css";
import "@/features/auth/ui/auth-apex.css";

const getNext = (search: string) => {
  const raw = new URLSearchParams(search).get("next") || "/app";
  const decodeOnce = (val: string) => {
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  };
  const next = decodeOnce(raw);
  const next2 = next.startsWith("%2F") ? decodeOnce(next) : next;
  return next2.startsWith("/") ? next2 : "/app";
};

export const RegisterPage: React.FC = () => {
  const { search } = useLocation();
  const termsUrl = getLegalDocumentUrl("/terms");
  const privacyUrl = getLegalDocumentUrl("/privacy");
  const { register, loginAsDemo } = useAuth();
  const nextPath = getNext(search);
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<{
    isOpen: boolean;
    allowedDomains: string[];
  } | null>(null);

  useEffect(() => {
    authService.getAppSettings().then(settings => {
      setRegistrationStatus({
        isOpen: settings.allowPublicRegistration,
        allowedDomains: settings.allowedDomains
      });
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (password !== confirmPassword) throw new Error("Hesla se neshodují");
      if (!termsAccepted || !privacyAccepted) {
        throw new Error("Pro registraci musíš potvrdit podmínky používání i zásady ochrany osobních údajů.");
      }
      await register(name, email, password, getCurrentLegalAcceptanceInput());
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Nastala chyba");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    loginAsDemo();
    navigate(nextPath, { replace: true });
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
            <button className="btn-login" onClick={() => navigate(loginHref)}>
              Přihlásit se
            </button>
            <button className="btn-start" onClick={() => navigate("/")}>
              Zpět
            </button>
          </div>
        </div>
      </header>

      <AuthCard
        title="Registrace"
        subtitle="Vytvořte si účet a začněte během minuty"
        registrationStatus={registrationStatus}
      >
        <form onSubmit={onSubmit} className="auth-form">
          <input
            type="text"
            placeholder="Jméno a Příjmení"
            name="name"
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input"
            required
          />
          <input
            type="email"
            placeholder="Email"
            name="email"
            id="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            required
          />
          <input
            type="password"
            placeholder="Heslo"
            name="new-password"
            id="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
          />
          <input
            type="password"
            placeholder="Potvrzení hesla"
            name="confirm-password"
            id="confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="auth-input"
            required
          />

          <label className="auth-legal-check">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              required
            />
            <span>
              Souhlasím s{" "}
              <a href={termsUrl} target="_blank" rel="noreferrer">
                podmínkami používání
              </a>
              .
            </span>
          </label>

          <label className="auth-legal-check">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              required
            />
            <span>
              Potvrzuji seznámení se{" "}
              <a href={privacyUrl} target="_blank" rel="noreferrer">
                zásadami ochrany osobních údajů
              </a>
              {" "}a informacemi o zpracování osobních údajů podle GDPR.
            </span>
          </label>

          {error ? (
            <div className="auth-alert auth-alert-error">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="auth-btn-primary"
          >
            {loading ? "Pracuji..." : "Vytvořit účet"}
          </button>

<div className="auth-links">
            <Link to={loginHref}>Již mám účet</Link>
            <Link to="/">Zpět na hlavní stránku</Link>
          </div>
        </form>
      </AuthCard>
    </div>
  );
};
