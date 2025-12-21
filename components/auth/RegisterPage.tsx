import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { PublicLayout } from "../public/PublicLayout";
import { PublicHeader } from "../public/PublicHeader";
import { AuthCard } from "./AuthCard";
import { Link, navigate } from "../routing/router";
import { authService } from "../../services/authService";

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      await register(name, email, password);
      navigate("/app", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Nastala chyba");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <PublicHeader variant="auth" />
      <AuthCard 
        title="Registrace" 
        subtitle="Vytvořte si účet a začněte během minuty"
        registrationStatus={registrationStatus}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Jméno a Příjmení"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
            required
          />
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
          <input
            type="password"
            placeholder="Potvrzení hesla"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? "Pracuji..." : "Vytvořit účet"}
          </button>

          <div className="flex items-center justify-between text-sm text-white/50 mt-2">
            <Link to="/login" className="hover:text-white transition-colors">
              Již mám účet
            </Link>
            <Link to="/" className="hover:text-white transition-colors">
              Zpět na landing
            </Link>
          </div>
        </form>
      </AuthCard>
    </PublicLayout>
  );
};

