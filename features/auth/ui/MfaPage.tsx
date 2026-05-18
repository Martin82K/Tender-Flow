import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthCard } from "./AuthCard";
import { Link, navigate, useLocation } from "@/shared/routing/router";
import { DEFAULT_APP_URL } from "@/shared/routing/routeUtils";
import logo from "@/assets/logo.svg";
import "@/features/public/ui/landing-apex.css";
import "@/features/auth/ui/auth-apex.css";

const getNext = (search: string) => {
  const raw = new URLSearchParams(search).get("next") || DEFAULT_APP_URL;
  const decodeOnce = (val: string) => {
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  };
  const next = decodeOnce(raw);
  const next2 = next.startsWith("%2F") ? decodeOnce(next) : next;
  return next2.startsWith("/") ? next2 : DEFAULT_APP_URL;
};

export const MfaPage: React.FC = () => {
  const { pendingMfa, verifyMfaLogin, refreshMfaStatus, logout } = useAuth();
  const { search } = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const nextPath = getNext(search);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await refreshMfaStatus();
        if (!active) return;
        if (!status.needsVerification) {
          navigate(nextPath, { replace: true });
        }
      } catch {
        if (active) {
          setError("Nepodařilo se ověřit stav dvoufázového ověření. Přihlaste se znovu.");
        }
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [nextPath, refreshMfaStatus]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.replace(/\s+/g, "");
    if (!normalizedCode) return;

    setError("");
    setLoading(true);
    try {
      const result = await verifyMfaLogin(normalizedCode);
      if (result.status === "authenticated") {
        navigate(nextPath, { replace: true });
        return;
      }
      setError("Ověření se nezdařilo. Přihlaste se znovu.");
    } catch {
      setError("Kód se nepodařilo ověřit. Zkontrolujte authenticator aplikaci a zkuste to znovu.");
    } finally {
      setLoading(false);
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
            <button className="auth-nav-back" onClick={() => void logout()}>
              Zrušit přihlášení
            </button>
          </div>
        </div>
      </header>

      <AuthCard title="Dvoufázové ověření" subtitle="Zadejte kód z authenticator aplikace">
        <form onSubmit={onSubmit} className="auth-form">
          <p style={{ fontSize: "0.8125rem", color: "var(--gray-1)" }}>
            Účet má zapnuté 2FA. Použijte aktuální 6místný kód z aplikace
            {pendingMfa?.friendlyName ? ` ${pendingMfa.friendlyName}` : ""}.
          </p>

          {error ? <div className="auth-alert auth-alert-error">{error}</div> : null}

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, "").slice(0, 8))}
            className="auth-input"
            required
            disabled={loading || checking}
            aria-label="Kód dvoufázového ověření"
          />

          <button
            type="submit"
            disabled={loading || checking || !code.trim()}
            className="auth-btn-primary"
          >
            {loading ? "Ověřuji..." : checking ? "Kontroluji..." : "Ověřit a pokračovat"}
          </button>

          <div className="auth-links">
            <Link to="/login">Zpět na přihlášení</Link>
          </div>
        </form>
      </AuthCard>
    </div>
  );
};
