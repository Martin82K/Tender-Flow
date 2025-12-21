import React, { useState } from "react";
import { PublicLayout } from "../public/PublicLayout";
import { PublicHeader } from "../public/PublicHeader";
import { AuthCard } from "./AuthCard";
import { Link } from "../routing/router";

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");

  return (
    <PublicLayout>
      <PublicHeader variant="auth" />
      <AuthCard title="Obnova hesla" subtitle="Zatím řešíme přes administrátora">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-white/70">
            Obnova hesla přes email zatím není v aplikaci zapnutá. Napište prosím
            administrátorovi a heslo vám nastavíme.
          </p>
          <input
            type="email"
            placeholder="Email (pro upřesnění)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
          />
          <a
            href={`mailto:?subject=${encodeURIComponent(
              "Obnova hesla - Tender Flow"
            )}&body=${encodeURIComponent(
              `Prosím o obnovu hesla pro účet: ${email || "(doplňte email)"}`
            )}`}
            className="w-full text-center py-3.5 px-6 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-orange-500/20"
          >
            Napsat administrátorovi
          </a>
          <div className="flex items-center justify-between text-sm text-white/50">
            <Link to="/login" className="hover:text-white transition-colors">
              Zpět na přihlášení
            </Link>
            <Link to="/" className="hover:text-white transition-colors">
              Landing
            </Link>
          </div>
        </div>
      </AuthCard>
    </PublicLayout>
  );
};
