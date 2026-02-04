import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { PublicLayout } from "../public/PublicLayout";
import { PublicHeader } from "../public/PublicHeader";
import { AuthCard } from "./AuthCard";
import { Link, navigate, useLocation } from "../routing/router";
import { isDesktop, platformAdapter } from "../../services/platformAdapter";
import { Fingerprint } from "lucide-react";

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

  const biometricLabel = platformAdapter.platform.os === "win32" ? "Windows Hello" : "Touch ID / Face ID";

  // Show biometric button if available and has saved credentials
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
      const message = [code, desc].filter(Boolean).join(": ");
      return message || null;
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
    <PublicLayout>
      <PublicHeader variant="auth" />
      <AuthCard title="Přihlášení" subtitle="Pokračujte do aplikace Tender Flow">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {dochubError ? (
            <div className="text-amber-200 text-sm text-center bg-amber-500/10 py-2 rounded-lg border border-amber-500/20">
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
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
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
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
            required
          />

          {/* Remember me checkbox - only on desktop */}
          {isDesktop && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/10 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
              />
              <span className="text-sm text-white/70">
                Zapamatovat si mě ({biometricLabel})
              </span>
            </label>
          )}

          {error ? (
            <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || biometricLoading}
            className="w-full py-3.5 px-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-orange-500/30"
          >
            {loading ? "Pracuji..." : "Přihlásit se"}
          </button>

          {/* Biometric login button */}
          {showBiometricButton && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-white/20"></div>
                <span className="text-white/40 text-sm">nebo</span>
                <div className="flex-1 h-px bg-white/20"></div>
              </div>
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={loading || biometricLoading}
                className="w-full py-3.5 px-6 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300 border border-white/20 flex items-center justify-center gap-3"
              >
                <Fingerprint className="w-5 h-5" />
                {biometricLoading ? "Ověřuji..." : `Přihlásit přes ${biometricLabel}`}
              </button>
            </>
          )}

          <div className="flex items-center justify-between text-sm text-white/50 mt-2">
            <Link to="/forgot-password" className="hover:text-white transition-colors">
              Zapomenuté heslo?
            </Link>
            <Link to="/register" className="hover:text-white transition-colors">
              Vytvořit účet
            </Link>
          </div>
        </form>
      </AuthCard>
    </PublicLayout>
  );
};
