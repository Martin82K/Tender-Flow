import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthCard } from "./AuthCard";
import { Link, navigate, useLocation } from "@/shared/routing/router";
import { isDesktop, platformAdapter } from "@/services/platformAdapter";
import { Fingerprint } from "lucide-react";
import logo from "@/assets/logo.svg";
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

export const LoginPage: React.FC = () => {
  const { login, loginWithBiometric, canUseBiometric, hasSavedCredentials } = useAuth();
  const { search } = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const nextPath = getNext(search);
  const registerHref = `/register?next=${encodeURIComponent(nextPath)}`;

  const biometricLabel = platformAdapter.platform.os === "win32" ? "Windows Hello" : "Touch ID / Face ID";

  const showBiometricButton = isDesktop && canUseBiometric && hasSavedCredentials;

  const handleBiometricLogin = async () => {
    if (biometricLoading) return;
    setError("");
    setBiometricLoading(true);
    try {
      const success = await loginWithBiometric();
      if (success) {
        navigate(nextPath, { replace: true });
      } else {
        setError("Biometrické ověření selhalo. Použijte heslo.");
      }
    } catch (err: any) {
      setError(err?.message || "Chyba při biometrickém přihlášení");
    } finally {
      setBiometricLoading(false);
    }
  };

  const dochubError = (() => {
    try {
      const u = new URL(nextPath, window.location.origin);
      const code = u.searchParams.get("dochub_error");
      const desc = u.searchParams.get("dochub_error_description");
      if (!code && !desc) return null;
      return [code, desc].filter(Boolean).join(": ") || null;
    } catch {
      return null;
    }
  })();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Nastala chyba");
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
            <button className="btn-login" onClick={() => navigate(registerHref)}>
              Vytvořit účet
            </button>
            <button className="auth-nav-back" onClick={() => navigate("/")}>
              Zpět
            </button>
          </div>
        </div>
      </header>

      <AuthCard title="Přihlášení" subtitle="Pokračujte do aplikace Tender Flow">
        <form onSubmit={onSubmit} className="auth-form">
          {dochubError ? (
            <div className="auth-alert auth-alert-warn">
              DocHub připojení (Microsoft): {dochubError}
            </div>
          ) : null}
          <input
            type="email"
            placeholder="Email"
            name="email"
            id="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            required
          />
          <input
            type="password"
            placeholder="Heslo"
            name="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
          />

          {isDesktop && (
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Zapamatovat si mě ({biometricLabel})</span>
            </label>
          )}

          {error ? (
            <div className="auth-alert auth-alert-error">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading || biometricLoading}
            className="auth-btn-primary"
          >
            {loading ? "Pracuji..." : "Přihlásit se"}
          </button>

          {showBiometricButton && (
            <>
              <div className="auth-divider">
                <span>nebo</span>
              </div>
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={loading || biometricLoading}
                className="auth-btn-secondary"
              >
                <Fingerprint className="auth-btn-icon" />
                {biometricLoading ? "Ověřuji..." : `Přihlásit přes ${biometricLabel}`}
              </button>
            </>
          )}

          <div className="auth-links">
            <Link to="/forgot-password">Zapomenuté heslo?</Link>
            <Link to={registerHref}>Vytvořit účet</Link>
          </div>
        </form>
      </AuthCard>
    </div>
  );
};
