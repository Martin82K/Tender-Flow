import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  FileText,
  Users,
  LayoutDashboard,
  Sparkles,
  Check,
} from "lucide-react";
import { PublicLayout } from "./public/PublicLayout";
import { PublicHeader } from "./public/PublicHeader";
import { Link, useLocation, navigate } from "./routing/router";
import { useAuth } from "../context/AuthContext";

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
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
  const { loginAsDemo } = useAuth();
  const [activePricingPlan, setActivePricingPlan] =
    useState<string>("Professional");

  const handleDemo = () => {
    loginAsDemo();
    navigate("/app", { replace: true });
  };

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
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gray-950/30 backdrop-blur">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 15% 25%, rgba(255, 138, 51, 0.18) 0%, transparent 55%), radial-gradient(circle at 70% 10%, rgba(255, 138, 51, 0.10) 0%, transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.0) 45%, rgba(0,0,0,0.25) 100%)",
            }}
          />
          <div className="relative p-10 md:p-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              v0.9.3-260101 • Cloud-based řešení
            </div>

            <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-white leading-[1.05]">
              Staví se lépe,
              <br />
              když máte přehled
            </h1>

            <p className="mt-5 text-white/65 leading-relaxed text-base md:text-lg max-w-2xl">
              Cloud řešení pro řízení výběrových řízení ve stavebnictví. 
              Jedno místo pro podklady, nabídky, rozhodnutí a sdílení v týmu.

            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/register"
                className="px-6 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20 text-center"
              >
                Začít zdarma →
              </Link>
              <button
                type="button"
                onClick={handleDemo}
                className="px-6 py-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 transition-colors text-center"
              >
                Vyzkoušet demo
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-sm text-white/70">
              {[
                "Projekty a pipeline poptávek",
                "Hromadné rozesílky + šablony",
                "Vyhodnocení a reporty",
                "Kontakty subdodavatelů",
              ].map((t) => (
                <div
                  key={t}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
                >
                  <Check size={14} className="text-orange-300" />
                  <span>{t}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
              <Stat
                label="Jedno místo pro nabídky a podklady"
                value="Přehled"
              />
              <Stat label="Sdílení informací v rámci projektu" value="Tým" />
              <Stat label="Méně ruční práce a dohledávání" value="Tempo" />
            </div>
          </div>
        </section>

	        <section id="solution" className="mt-16 md:mt-24 scroll-mt-24">
	          <div className="mb-8 rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8">
	            <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
	              Ušetřete čas na každém tendru
		            </h2>
		            <p className="mt-2 text-white/60 max-w-3xl">
		              Tender Flow sjednocuje podklady, nabídky a rozhodnutí do jednoho procesu. Bez dohledávání v e-mailech a tabulkách.
		            </p>
	          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8">
              <div className="text-white font-semibold">Bez Tender Flow</div>
              <ul className="mt-6 space-y-2 text-sm text-white/70">
                {[
                  "Excel/Sheets pro každý projekt zvlášť",
                  "Nabídky rozházené po e-mailech",
                  "Ruční porovnávání cen a variant",
                  "Nejasný stav poptávek a termínů",
                  "Zdlouhavé reportování a exporty",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="mt-0.5 text-white/30">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/10 via-gray-950/40 to-transparent backdrop-blur p-8">
              <div className="text-white font-semibold">S Tender Flow</div>
              <ul className="mt-6 space-y-2 text-sm text-white/70">
                {[
                  "Vše na jednom místě v cloudu",
                  "Šablony a jednotný výstup poptávek",
                  "Přehledný tok od plánu VŘ po vyhodnocení",
                  "Rychlé sdílení kontextu v týmu",
                  "Export/report jedním klikem",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="mt-0.5 text-orange-300">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="features" className="mt-16 md:mt-24 scroll-mt-24">
          <div className="mb-8 rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
                Funkce, které vám ušetří čas.
              </h2>
              <p className="mt-2 text-white/60">
                Vše důležité na jednom místě, bez zbytečné administrativy.
              </p>
            </div>
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

        <section id="demo" className="mt-16 md:mt-24 scroll-mt-24">
          <div className="mb-8 rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
                Vidět znamená věřit.
              </h2>
              <p className="mt-2 text-white/60 max-w-3xl">
                Spusťte demo projekt a proklikejte si workflow bez rizika
                zobrazení reálných dat.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDemo}
              className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20"
            >
              Spustit demo
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-gray-950/40 p-6">
                <div className="text-white font-semibold">
                  Demo projekt: Bytový dům Slunečná - DEMO
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "ROZPOČET INVESTOR", value: "18,5 mil. Kč" },
                    { label: "PLÁNOVANÝ NÁKLAD", value: "15,0 mil. Kč" },
                    { label: "ZASMLUVNĚNO", value: "12,4 mil. Kč" },
                    { label: "POSTUP", value: "3 / 5 kategorií" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5"
                    >
                      <div className="text-xs text-white/50">{m.label}</div>
                      <div className="mt-2 text-white text-2xl font-light">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-5 text-sm text-white/60">
                Demo běží lokálně v prohlížeči a nepoužívá data vaší organizace.
              </p>
            </div>
          </div>
        </section>

        <section id="workflow" className="mt-16 md:mt-24 scroll-mt-24">
          <div className="rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8">
            <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
              Od poptávky po rozhodnutí.
            </h2>
            <p className="mt-2 text-white/60 max-w-3xl">
              Typický tok: Projekt → Plán VŘ → Poptávka → Nabídky → Vyhodnocení
              a výstup.
            </p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                {
                  step: "1",
                  title: "Založte projekt",
                  text: "Popis, kategorie a kontext pro celý tým.",
                },
                {
                  step: "2",
                  title: "Nastavte poptávku",
                  text: "Plán VŘ, milníky, požadavky a podklady.",
                },
                {
                  step: "3",
                  title: "Oslovte subdodavatele",
                  text: "Kontakty, rozesílky, historie spolupráce.",
                },
                {
                  step: "4",
                  title: "Vyhodnoťte nabídky",
                  text: "Poznámky, rozhodnutí a export/report.",
                },
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
                Aplikace je postavená pro práci s citlivými podklady a firemními
                procesy. Přístupy jsou řízené rolemi a data jsou oddělena podle
                organizace.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-white/70">
                {[
                  "Autentizace a přihlášení uživatelů",
                  "Oddělení dat mezi organizacemi",
                  "Role a admin režim",
                  "Přístupy podle potřeb týmu (příprava / stavba / technik)",
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
                <div className="text-white font-semibold">
                  Chcete nastavení pro firmu?
                </div>
                <p className="mt-2 text-white/60">
                  Pomůžeme s úvodním nastavením organizace, rolí a importem
                  kontaktů. Společně nastavíme šablony poptávek a doporučíme
                  workflow, aby se proces ve firmě zjednodušil hned od prvního
                  dne.
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
	          <div className="mb-8 rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8">
	            <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
	              Ceník
            </h2>
            <p className="mt-2 text-white/60 max-w-3xl">
              Jednoduché tarify pro různé velikosti týmů. Ceny jsou orientační a
              bez DPH.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "Starter",
                price: "1 990 Kč",
                label: "měsíčně",
                items: [
                  "5 aktivních projekt",
                  "5 uživatelů",
                  "Základní přehledy",
                  "Databáze subdodavatelů",
                  "Export do Excel",
                ],
                cta: { label: "Vyzkoušet", kind: "link" as const, to: "/register" },
              },
              {
                title: "Professional",
                price: "5 000 Kč",
                label: "měsíčně",
                badge: "Nejvýhodnější",
                featured: true,
                items: [
                  "Neomezené projekty",
                  "15 uživatelů",
                  "Plný dashboard + KPI",
				  "Plán výběrových řízení",
                  "AI analýza",
                  "Integrace a onboarding",
				  "Document Hub",
            	  "Nové funkce od prvního dne",
                ],
                cta: { label: "Začít nyní", kind: "link" as const, to: "/register" },
              },
              {
                title: "Enterprise",
                price: "Na míru",
                label: "individuálně",
                items: [
                  "Neomezené projekty",
                  "Neomezení uživatelé",
                  "Vlastní integrace",
                  "Možnost návrhu funkcí",
                  "Vylepšení databáze",
				  "Přístup ke connectorům",
				  "Přístup k API",
				  "Přístup k dokumentaci",
				  "Document Hub",
                ],
                cta: {
                  label: "Kontaktovat",
                  kind: "mailto" as const,
                  to: "mailto:?subject=Enterprise%20Tender%20Flow",
                },
              },
            ].map((p) => {
              const isActive = activePricingPlan === p.title || !!p.featured;

              return (
                <div
                  key={p.title}
                  className={[
                    "group relative rounded-3xl border backdrop-blur p-8 flex flex-col h-full transition-all duration-300 transform-gpu",
                    "hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.99]",
                    p.featured
                      ? "bg-gradient-to-br from-orange-500/15 via-gray-950/40 to-transparent"
                      : "bg-gray-950/40",
                    isActive
                      ? "border-orange-500/25 bg-white/[0.06] shadow-2xl shadow-orange-500/10"
                      : "border-white/10 hover:border-orange-500/20 hover:bg-white/[0.05] hover:shadow-2xl hover:shadow-black/40",
                  ].join(" ")}
                  onMouseEnter={() => setActivePricingPlan(p.title)}
                  onFocus={() => setActivePricingPlan(p.title)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-white font-semibold">{p.title}</div>
                    {p.badge ? (
                      <div className="shrink-0 text-[11px] rounded-full px-3 py-1 border border-orange-500/20 bg-orange-500/10 text-orange-100/90">
                        {p.badge}
                      </div>
                    ) : null}
                  </div>
                <div className="mt-3 flex items-end gap-2">
                  <div className="text-4xl text-white font-light leading-none">
                    {p.price}
                  </div>
                  <div className="text-sm text-white/50 pb-1">{p.label}</div>
                </div>

                <ul className="mt-6 space-y-2 text-sm text-white/70">
                  {p.items.map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-0.5 text-orange-300">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  {p.cta.kind === "mailto" ? (
                    <a
                      href={p.cta.to}
                      className="inline-flex w-full h-12 items-center justify-center px-5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 transition-colors"
                    >
                      {p.cta.label}
                    </a>
                  ) : (
                    <Link
                      to={p.cta.to}
                      className="inline-flex w-full h-12 items-center justify-center px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-all shadow-lg shadow-orange-500/15 group-hover:shadow-orange-500/25"
                    >
                      {p.cta.label}
                    </Link>
                  )}
                </div>
              </div>
              );
            })}
	          </div>
	        </section>

	        <section className="mt-16 md:mt-24">
	          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-gray-950 via-gray-950/60 to-gray-950 p-10 md:p-16 text-center relative overflow-hidden">
	            <div
	              className="absolute inset-0"
	              style={{
	                background:
	                  "radial-gradient(circle at 30% 20%, rgba(255, 138, 51, 0.18) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(255, 138, 51, 0.10) 0%, transparent 55%)",
	              }}
	            />
	            <div className="relative">
	              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
	                Připraveni změnit způsob,
	                <br className="hidden md:block" />
	                jakým řídíte výběrová řízení?
	              </h2>
	              <p className="mt-4 text-white/60">
	                Začněte zdarma s demo projektem. Žádná kreditní karta není
	                potřeba.
	              </p>
	              <div className="mt-8 flex justify-center">
	                <Link
	                  to="/register"
	                  className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20"
	                >
	                  Začít hned teď →
	                </Link>
	              </div>
	            </div>
	          </div>
	        </section>

	        <footer className="mt-10 pb-10 border-t border-white/10 pt-8 text-sm text-white/50 text-center">
	          <div>© {new Date().getFullYear()} Tender Flow • v0.9.3-260101</div>
	          <div className="mt-2 text-white/40">
	            Cloud řešení pro správu výběrových řízení ve stavebnictví
	          </div>
	        </footer>
	      </main>
	    </PublicLayout>
	  );
};
