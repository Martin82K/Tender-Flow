import React, { useState, useEffect } from "react";
import { AuthCard } from "./AuthCard";
import { Link, navigate, useLocation } from "@/shared/routing/router";
import { authService } from "@/services/authService";
import logo from "@/assets/logo.png";
import "@/features/public/ui/landing-apex.css";
import "@/features/auth/ui/auth-apex.css";

export const ResetPasswordPage: React.FC = () => {
  const { search } = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setErrorMessage("Neplatný odkaz (chybí token).");
      setStatus("error");
    }
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 6) {
      setErrorMessage("Heslo musí mít alespoň 6 znaků.");
      setStatus("error");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Hesla se neshodují.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      await authService.confirmPasswordReset(token, password);
      setStatus("success");
    } catch (error: any) {
      console.error("Reset confirmation error:", error);
      setStatus("error");
      let msg = "Nastavení hesla se nezdařilo. Odkaz může být expirovaný.";
      if (error?.message?.includes("expirovaný")) msg = "Odkaz pro obnovu hesla vypršel.";
      else if (error?.message?.includes("Neplatný")) msg = "Neplatný odkaz pro obnovu hesla.";
      setErrorMessage(msg);
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
            <button className="btn-start" onClick={() => navigate("/")}>
              Zpět
            </button>
          </div>
        </div>
      </header>

      <AuthCard title="Nové heslo" subtitle="Nastavte si nové heslo">
        {status === "success" ? (
          <div className="auth-form">
            <div className="auth-alert" style={{ color: "var(--green)", background: "var(--green-dim)", border: "1px solid rgba(52,211,153,0.2)", padding: "1rem" }}>
              <p style={{ fontWeight: 600 }}>Heslo změněno!</p>
              <p style={{ fontSize: "0.8125rem", marginTop: "0.25rem", opacity: 0.9 }}>
                Vaše heslo bylo úspěšně nastaveno. Nyní se můžete přihlásit.
              </p>
            </div>
            <button
              className="auth-btn-primary"
              onClick={() => navigate("/login")}
            >
              Přejít na přihlášení
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {status === "error" && (
              <div className="auth-alert auth-alert-error">{errorMessage}</div>
            )}

            <input
              type="password"
              placeholder="Nové heslo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
              disabled={status === "loading" || !token}
              minLength={6}
            />
            <input
              type="password"
              placeholder="Potvrzení hesla"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="auth-input"
              required
              disabled={status === "loading" || !token}
              minLength={6}
            />

            <button
              type="submit"
              disabled={status === "loading" || !token}
              className="auth-btn-primary"
            >
              {status === "loading" ? "Ukládám..." : "Nastavit heslo"}
            </button>

            <div className="auth-links" style={{ justifyContent: "center" }}>
              <Link to="/login">Zpět na přihlášení</Link>
            </div>
          </form>
        )}
      </AuthCard>
    </div>
  );
};
