import React, { useEffect } from "react";
import { ShieldCheck, FileText, Users, LayoutDashboard, Sparkles } from "lucide-react";
import { PublicLayout } from "./public/PublicLayout";
import { PublicHeader } from "./public/PublicHeader";
import { Link, useLocation } from "./routing/router";
import ConstructionAnimation from "../crm_landing_animation";

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-gray-950/40 backdrop-blur px-5 py-4">
    <div className="text-white text-xl font-semibold">{value}</div>
    <div className="text-white/60 text-sm">{label}</div>
  </div>
);

const Feature: React.FC<{
  icon: React.ReactNode;
  title: string;
  text: string;
}> = ({ icon, title, text }) => (
  <div className="rounded-2xl border border-white/10 bg-gray-950/40 backdrop-blur p-6">
    <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
      {icon}
    </div>
    <h3 className="mt-4 text-white font-semibold">{title}</h3>
    <p className="mt-2 text-sm text-white/60 leading-relaxed">{text}</p>
  </div>
);

export const LandingPage: React.FC = () => {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;
    requestAnimationFrame(() =>
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, [hash]);

  return (
    <PublicLayout>
      <PublicHeader variant="marketing" />

      <main className="relative mx-auto max-w-6xl px-4 py-10 md:py-16">
        <ConstructionAnimation />
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-gray-950/40 px-3 py-1.5 text-xs text-white/70">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              Moderní systém pro tendry a poptávky
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl font-light text-white tracking-wide leading-tight">
              Tender Flow: Systém{" "}
              <span className="text-orange-400">výběrových řízení</span> pro stavby.

            </h1>
            <p className="mt-5 text-white/70 leading-relaxed">
              Řiďte výběrová řízení a své poptávky od plánu VŘ až do zasmluvnění. Generujte reporty, sdílejte ekonomická data,
              kontakty subdodavatele, sdílete projekty s účastníky stavby a konečně šetřete drahocený čas.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/login"
                className="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 transition-colors text-center"
              >
                Přihlásit se
              </Link>
              <Link
                to="/register"
                className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20 text-center"
              >
                Začít zdarma
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Stat label="Jeden přehled pro celý tým" value="Méně chaosu" />
              <Stat label="Sdílení svému týmu pro daný projekt" value="Informace" />
              <Stat label="Snadný přehled soutěže i ekonomiky." value="Od soutěže k realizaci" />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold">Ukázka workflow</div>
                <div className="text-xs text-white/50">Dashboard • Projekty • Výběrová řízení</div>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3">
                {[
                  { label: "Poptávka výběrového řízení", status: "Probíhá" },
                  { label: "Poptávka subdodavatele", status: "Generovat poptávku" },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="text-sm text-white/80">{row.label}</div>
                    <div className="text-xs rounded-full px-3 py-1 border border-orange-500/30 bg-orange-500/10 text-orange-300">
                      {row.status}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-xs text-white/50">
                Systém je navržen pro maximalizaci úspory času.
              </p>
            </div>
          </div>
        </section>

        <section id="features" className="mt-16 md:mt-24 scroll-mt-24">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
                Funkce, které Vám pomůžou začít šetřit čas.
              </h2>
              <p className="mt-2 text-white/60">
                Vše důležité na jednom místě, bez složitého nastavování.
              </p>
            </div>
            <Link
              to="/login"
              className="text-sm text-orange-300 hover:text-orange-200 transition-colors"
            >
              Přihlásit se →
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Feature
              icon={<LayoutDashboard size={20} />}
              title="Dashboard a přehledy"
              text="Aktuální stav zakázek, pipeline a rychlé akce bez zbytečného hledání."
            />
            <Feature
              icon={<FileText size={20} />}
              title="Dokumenty a šablony"
              text="Udržujte nabídky, podklady a exporty na jednom místě s jasnou strukturou."
            />
            <Feature
              icon={<Users size={20} />}
              title="Kontakty a subdodavatelé"
              text="Historie spolupráce, statusy a rychlý výběr v projektech i pipeline."
            />
            <Feature
              icon={<ShieldCheck size={20} />}
              title="Role a bezpečnost"
              text="Přístupová práva a nastavení podle firmy. Připraveno na růst týmu."
            />
            <Feature
              icon={<Sparkles size={20} />}
              title="AI podpora (volitelně)"
              text="Pomoc s texty, shrnutím podkladů a rychlou orientací v informacích."
            />
            <Feature
              icon={<span className="text-lg">⚙️</span>}
              title="Přizpůsobení"
              text="Tmavý režim, barvy a preference uživatele bez rozbití jednotného vzhledu."
            />
          </div>
        </section>

        <section id="workflow" className="mt-16 md:mt-24 scroll-mt-24">
          <div className="rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8">
            <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
              Od poptávky po smlouvu.
            </h2>
            <p className="mt-2 text-white/60 max-w-3xl">
              Typický tok: Vytvořit projekt → Plán VŘ → Poptávka → Subdodavatelské nabídky → Vyhodnocení.
            </p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { step: "1", title: "Založte projekt", text: "Kontakt, popis a kategorie." },
                { step: "2", title: "Poptávky", text: "Plány VŘ, průběh a milníky." },
                { step: "3", title: "Subdodavatelé", text: "Výběr, poznámky a hodnocení." },
                { step: "4", title: "Dokumenty", text: "Dynamické šablony poptávek, reporty, zápisy." },
              ].map((s) => (
                <div
                  key={s.step}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="text-xs text-orange-300">Krok {s.step}</div>
                  <div className="mt-2 text-white font-semibold">{s.title}</div>
                  <div className="mt-1 text-sm text-white/60">{s.text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="mt-16 md:mt-24 scroll-mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8">
              <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
                Bezpečnost a přístupy
              </h2>
              <p className="mt-3 text-white/60 leading-relaxed">
                Aplikace je postavená pro práci s citlivými podklady. Připraveno na
                firemní procesy a řízení přístupů.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-white/70">
                {[
                  "Autentizace přes databázi",
                  "Oddělení dat podle organizace",
                  "Role (uživatel / admin)",
                  "Řízený přístup přes uživatelské role (Přípravář, Stavbyvedoucí, Technik apod.)",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="mt-0.5 text-orange-300">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/10 via-gray-950/40 to-transparent backdrop-blur p-8 flex flex-col justify-between">
              <div>
                <div className="text-white font-semibold">Chcete demo pro firmu?</div>
                <p className="mt-2 text-white/60">
                  Nastavíme vám prostředí, role.
                  Vytvoříme základní role admina a zaktivujeme nastavení.
                  Spustíme databázi a provedeme implementaci.
                  Pomůžeme s importem seznamu kontaktů a subdodavatelů.
                  Inicializujeme modul dynamických poptávek se základní šablonou.
                </p>
              </div>
              <div className="mt-6 flex gap-3">
                <Link
                  to="/register"
                  className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20"
                >
                  Začít
                </Link>
                <a
                  href="mailto:?subject=Demo%20Tender%20Flow"
                  className="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 transition-colors"
                >
                  Kontakt
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="mt-16 md:mt-24 scroll-mt-24">
          <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
            Ceník
          </h2>
          <p className="mt-2 text-white/60 max-w-3xl">
            Licence = uživatel v organizaci. AI+ je příplatek za uživatele. Zatím
            nasazujeme individuálně podle firmy a rozsahu — transparentně a bez
            „překvapení“.
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: "Demo",
                price: "Zdarma",
                items: [
                  "Ukázková stavba (bez dalších staveb)",
                  "Bez importů",
                  "Náhled workflow a UI",
                ],
                cta: { label: "Vyzkoušet", to: "/register" },
              },
              {
                title: "Starter",
                price: "Na míru",
                items: [
                  "3 licence (uživatelé v organizaci)",
                  "Import kontaktů",
                  "Generování poptávek",
                ],
                cta: { label: "Začít", to: "/register" },
              },
              {
                title: "Pro",
                price: "Na míru",
                badge: "Nejčastější volba",
                items: [
                  "Neomezený počet staveb a subdodavatelů",
                  "Vyhodnocení a exporty",
                  "Sdílení staveb a přístupy",
                  "Vyšší limity a prioritní výkon",
                ],
                cta: { label: "Domluvit", to: "mailto:?subject=Pro%20Tender%20Flow" },
              },
              {
                title: "AI+",
                price: "Doplněk",
                badge: "Příplatek / uživatel",
                variant: "addon",
                items: [
                  "AI funkce napříč aplikací",
                  "Shrnutí podkladů a návrhy textů",
                  "Rychlá orientace v informacích",
                ],
                cta: { label: "Zjistit více", to: "mailto:?subject=AI%2B%20Tender%20Flow" },
              },
            ].map((p) => (
              <div
                key={p.title}
                className={[
                  "rounded-3xl border border-white/10 backdrop-blur p-8 flex flex-col h-full",
                  p.variant === "addon"
                    ? "bg-gradient-to-br from-orange-500/10 via-gray-950/40 to-transparent"
                    : "bg-gray-950/40",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="text-white font-semibold">{p.title}</div>
                  {"badge" in p && p.badge ? (
                    <div className="shrink-0 text-[11px] rounded-full px-3 py-1 border border-orange-500/30 bg-orange-500/10 text-orange-200">
                      {p.badge}
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-3xl text-white font-light">{p.price}</div>
                <ul className="mt-6 space-y-2 text-sm text-white/70">
                  {p.items.map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-0.5 text-orange-300">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  {p.cta.to.startsWith("mailto:") ? (
                    <a
                      href={p.cta.to}
                      className="inline-flex w-full justify-center px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20"
                    >
                      {p.cta.label}
                    </a>
                  ) : (
                    <Link
                      to={p.cta.to}
                      className="inline-flex w-full justify-center px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20"
                    >
                      {p.cta.label}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="mt-16 md:mt-24 scroll-mt-24">
          <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
            FAQ
          </h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                q: "Co je licence?",
                a: "Licence = uživatel v organizaci (přístup do aplikace).",
              },
              {
                q: "Jak se účtuje AI+?",
                a: "AI+ je doplněk účtovaný jako příplatek za uživatele.",
              },
              {
                q: "Je to pro malou firmu i větší tým?",
                a: "Ano. Začnete jednoduše a postupně zapnete role, procesy a integrace podle potřeby.",
              },
              {
                q: "Můžu upravit barvy a režim?",
                a: "Ano. Aplikace má preference uživatele (tmavý režim, primární barva, pozadí).",
              },
              {
                q: "Co uvidím po přihlášení?",
                a: "Dashboard, projekty, pipeline, dokumenty, kontakty a nastavení — v jednotném UI.",
              },
              {
                q: "Je možné data importovat?",
                a: "Ano, v aplikaci existují importy a práce s tabulkami (CSV/XLSX) podle potřeby.",
              },
            ].map((item) => (
              <div
                key={item.q}
                className="rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-7"
              >
                <div className="text-white font-semibold">{item.q}</div>
                <div className="mt-2 text-sm text-white/60 leading-relaxed">
                  {item.a}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 md:mt-24 pb-10 border-t border-white/10 pt-8 text-sm text-white/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} Tender Flow - Martin Kalkuš</div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-white transition-colors">
              Přihlášení
            </Link>
            <a
              href="mailto:"
              className="hover:text-white transition-colors"
            >
              Kontakt
            </a>
          </div>
        </footer>
      </main>
    </PublicLayout>
  );
};
