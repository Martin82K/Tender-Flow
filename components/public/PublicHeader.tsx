import React, { useState } from "react";
import logo from "../../assets/logo.png";
import { Link, useLocation, navigate } from "../routing/router";

const navItems = [
  { id: "features", label: "Funkce" },
  { id: "solution", label: "Řešení" },
  { id: "demo", label: "Demo" },
  { id: "pricing", label: "Ceník" },
];

export const PublicHeader: React.FC<{ variant?: "marketing" | "auth" }> = ({
  variant = "marketing",
}) => {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onAnchorClick = (id: string) => {
    if (pathname !== "/") {
      navigate(`/#${id}`);
      setMobileOpen(false);
      return;
    }
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-gray-950/40 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src={logo}
            alt="Tender Flow"
            className="w-12 h-12 object-contain drop-shadow group-hover:scale-[1.03] transition-transform"
          />
          <div className="leading-tight">
            <div className="text-white font-semibold tracking-wide">
              Tender Flow
            </div>
            <div className="text-xs text-white/60">
              Tender Management System
            </div>
          </div>
        </Link>

        {variant === "marketing" ? (
          <nav className="hidden md:flex items-center justify-center gap-6 text-sm text-white/70">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onAnchorClick(item.id)}
                className="hover:text-white transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : (
          <div className="hidden md:block text-sm text-white/60 text-center">
            Jednoduše. Rychle. Přehledně.
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {variant === "marketing" ? (
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 transition-colors"
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              <span className="material-symbols-outlined text-[20px]">
                {mobileOpen ? "close" : "menu"}
              </span>
            </button>
          ) : null}
          <Link
            to="/login"
            className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 text-sm transition-colors"
          >
            Přihlásit se
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors shadow-lg shadow-orange-500/20"
          >
            Začít
          </Link>
        </div>
      </div>

      {variant === "marketing" && mobileOpen ? (
        <div className="md:hidden border-t border-white/10 bg-gray-950/40 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onAnchorClick(item.id)}
                className="text-left px-3 py-2 rounded-xl hover:bg-white/5 text-white/80 text-sm transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
};
