import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { PublicLayout } from "../public/PublicLayout";
import { PublicHeader } from "../public/PublicHeader";
import { AuthCard } from "./AuthCard";
import { Link, navigate, useLocation } from "../routing/router";

const getNext = (search: string) => {
  const next = new URLSearchParams(search).get("next") || "/app";
  return next.startsWith("/") ? next : "/app";
};

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { search } = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(getNext(search), { replace: true });
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
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
            required
          />
          <input
            type="password"
            placeholder="Heslo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
            required
          />

          {error ? (
            <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-orange-500/30"
          >
            {loading ? "Pracuji..." : "Přihlásit se"}
          </button>

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

