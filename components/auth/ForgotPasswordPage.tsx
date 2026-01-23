import React, { useState } from "react";
import { PublicLayout } from "../public/PublicLayout";
import { PublicHeader } from "../public/PublicHeader";
import { AuthCard } from "./AuthCard";
import { Link } from "../routing/router";
import { authService } from "../../services/authService";

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
    <PublicLayout>
      <PublicHeader variant="auth" />
      <AuthCard title="Obnova hesla" subtitle="Zadejte svůj email">
        {status === "success" ? (
          <div className="flex flex-col gap-4 text-center">
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl">
              <p className="font-medium">Odkaz odeslán!</p>
              <p className="text-sm mt-1 opacity-90">
                Pokud účet s tímto emailem existuje, poslali jsme vám instrukce pro obnovu hesla.
              </p>
            </div>
            <Link
              to="/login"
              className="w-full text-center py-3.5 px-6 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
            >
              Zpět na přihlášení
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-white/70">
              Zadejte emailovou adresu spojenou s vaším účtem. Pošleme vám odkaz pro nastavení nového hesla.
            </p>

            {status === "error" && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
                {errorMessage}
              </div>
            )}

            <input
              type="email"
              placeholder="Váš email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
              required
              disabled={status === "loading"}
            />

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full text-center py-3.5 px-6 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white rounded-xl font-medium transition-colors shadow-lg shadow-orange-500/20 flex justify-center items-center"
            >
              {status === "loading" ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Odeslat odkaz"
              )}
            </button>

            <div className="flex items-center justify-between text-sm text-white/50">
              <Link to="/login" className="hover:text-white transition-colors">
                Zpět na přihlášení
              </Link>
              <Link to="/" className="hover:text-white transition-colors">
                Landing
              </Link>
            </div>
          </form>
        )}
      </AuthCard>
    </PublicLayout>
  );
};
