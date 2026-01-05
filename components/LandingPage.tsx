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
import { APP_VERSION } from "../config/version";

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
    <div className="text-orange-500 text-xl font-semibold">{value}</div>
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
  const [activeDemoTab, setActiveDemoTab] = useState<string>("prehled");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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
              <span className="w-2 h-2 rounded-full bg-orange-500" />v
              {APP_VERSION} • Cloud-based řešení
            </div>

            <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-white leading-[1.05]">
              Staví se lépe,
              <br />
              když máte <span className="text-orange-500">přehled</span>
            </h1>

            <p className="mt-5 text-white/65 leading-relaxed text-base md:text-lg max-w-2xl">
              Cloud řešení pro řízení výběrových řízení ve stavebnictví.
              <br />
              Jedno místo pro podklady, nabídky, rozhodnutí a sdílení v týmu.
              <br />
            </p>

            <div className="mt-8 flex flex-wrap gap-2 text-sm text-white/70">
              {[
                "Kanban poptávek",
                "Hromadné rozesílky + šablony",
                "Vyhodnocení a reporty",
                "Adresář kontaktů",
                "Harmonogram",
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

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-1 gap-3 max-w-3xl">
              <Stat
                label="Mnoholeté zkušenosti nás přivádějí až sem, ke snížení repetitivních úkonů. Tohle je náš způsob, jak to změnit."
                value="Čas je mnohdy to nejdražší."
              />
            </div>
          </div>
        </section>

        <section id="solution" className="mt-16 md:mt-24 scroll-mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8">
              <div className="text-white font-semibold">Bez Tender Flow</div>
              <ul className="mt-6 space-y-2 text-sm text-white/70">
                {[
                  "Excel/Sheets pro každý projekt zvlášť",
                  "Nabídky rozházené po e-mailech",
                  "Ruční porovnávání cen a variant",
                  "Nejasný stav poptávek a termínů",
                  "Ruční sumarizace přehledy všech dat a reporty",
                  "Zdlouhavé hledání ve složkách, která má pokaždé jinou strukturu",
                  "Ruční tvoření aúpravy harmonogramu",
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
                  "Plánování poptávek / Výběrových řízení",
                  "Automatická tvorba poptávek",
                  "Automatická tvorba harmonogramu v závislosti na poptávkách",
                  "Přehledný tok od plánu VŘ po vyhodnocení",
                  "Rychlé sdílení kontextu v týmu",
                  "Export/report jedním klikem",
                  "Hodnocení dodavatelů",
                  "Dynamické šablony a jejich vlastní editor",
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
              title="Harmonogram"
              text="Generuje se sám na základě dat v plánu výběrů subdodavatelů. Základ snadno upravujete."
            />
            <Feature
              icon={<span className="text-lg">⚙️</span>}
              title="Nástroje"
              text="Už jen naše nástroje pro práci s excel nástroji vám ušetří hodiny času."
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
                Podívejte se na ukázky přímo z aplikace. Přehledný design a
                intuitivní ovládání.
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
              {/* Browser window header */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>

                {/* Tab navigation */}
                <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/10 flex-wrap">
                  {[
                    {
                      id: "prehled",
                      label: "Přehled Poptávek",
                      icon: "table_chart",
                    },
                    {
                      id: "karty",
                      label: "Výběrová Řízení",
                      icon: "dashboard",
                    },
                    {
                      id: "kanban",
                      label: "Kanban Pipeline",
                      icon: "view_kanban",
                    },
                    {
                      id: "harmonogram",
                      label: "Harmonogram",
                      icon: "calendar_month",
                    },
                    {
                      id: "slozkomat",
                      label: "Složkomat",
                      icon: "folder_open",
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveDemoTab(tab.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        activeDemoTab === tab.id
                          ? "bg-orange-500 text-white shadow-lg"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {tab.icon}
                      </span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Screenshot display */}
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 overflow-hidden">
                <div
                  className="relative w-full overflow-auto max-h-[400px] cursor-zoom-in"
                  onClick={() => {
                    const srcMap: Record<string, string> = {
                      prehled: "/screenshots/prehled-poptavek.png",
                      karty: "/screenshots/vyberove-rizeni.png",
                      kanban: "/screenshots/kanban.png",
                      harmonogram: "/screenshots/harmonogram.png",
                      slozkomat: "/screenshots/slozkomat.png",
                    };
                    setLightboxImage(srcMap[activeDemoTab] || srcMap.prehled);
                  }}
                >
                  {activeDemoTab === "prehled" && (
                    <img
                      src="/screenshots/prehled-poptavek.png"
                      alt="Přehled poptávek - tabulkové zobrazení všech poptávek s cenami a stavy"
                      className="w-full h-auto"
                    />
                  )}
                  {activeDemoTab === "karty" && (
                    <img
                      src="/screenshots/vyberove-rizeni.png"
                      alt="Výběrová řízení - kartové zobrazení s detaily jednotlivých poptávek"
                      className="w-full h-auto"
                    />
                  )}
                  {activeDemoTab === "kanban" && (
                    <img
                      src="/screenshots/kanban.png"
                      alt="Kanban pipeline - přehled fází výběrového řízení od oslovení po smlouvu"
                      className="w-full h-auto"
                    />
                  )}
                  {activeDemoTab === "harmonogram" && (
                    <img
                      src="/screenshots/harmonogram.png"
                      alt="Harmonogram - Ganttův diagram s přehledem termínů výběrových řízení"
                      className="w-full h-auto"
                    />
                  )}
                  {activeDemoTab === "slozkomat" && (
                    <img
                      src="/screenshots/slozkomat.png"
                      alt="Složkomat - propojení s Google Drive a OneDrive pro správu dokumentů"
                      className="w-full h-auto"
                    />
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white/80 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      zoom_in
                    </span>
                    Kliknutím zvětšíte
                  </div>
                </div>
              </div>

              {/* Caption */}
              <div className="mt-4 flex items-center justify-between text-sm text-white/60">
                <span>
                  {activeDemoTab === "prehled" &&
                    "Přehledná tabulka všech poptávek s cenami, stavy a smlouvami"}
                  {activeDemoTab === "karty" &&
                    "Kartové zobrazení výběrových řízení s rychlým přehledem stavu"}
                  {activeDemoTab === "kanban" &&
                    "Kanban pipeline pro vizuální sledování průběhu výběrového řízení"}
                  {activeDemoTab === "harmonogram" &&
                    "Ganttův diagram s přehledem termínů a exportem do XLSX/PDF"}
                  {activeDemoTab === "slozkomat" &&
                    "Napojení na Google Drive a OneDrive pro automatickou správu dokumentů"}
                </span>
                <span className="text-xs text-white/40">
                  Tender Flow v{APP_VERSION}
                </span>
              </div>
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
                  "Šifrovaný přenos dat",
                  "Šifrované uložení dat",
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
                  <h2 className="text-2xl md:text-3xl font-light text-white tracking-wide">
                    Chcete samostatné vydání?
                  </h2>
                </div>
                <div className="mt-2 text-white/60">
                  Pokud potřebujete vlastní řešení pro svou firmu, jste tu
                  správně. I toto je možné.
                  <br />
                  <br />
                  <ul className="mt-6 space-y-2 text-sm text-white/70">
                    {[
                      "Je možné sestavení docker image pro nasazení na vlastní servery.",
                      "Aplikace tak poběží nezávisle na externích službách.",
                      "V tomto případě je nutné vlastní dodatečnou konfiguraci API klíčů a domén služeb.",
                      "Tender Flow neručí za data a jejich bezpečnost.",
                      "Nákup je jednorázový a nezahrnuje další aktualizace a nové funkcionality.",
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-2">
                        <span className="mt-0.5 text-orange-300">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="mt-16 md:mt-24 scroll-mt-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "Starter",
                price: "1 990 Kč",
                label: "měsíčně",
                items: [
                  "5 aktivních projektů",
                  "5 uživatelů",
                  "Základní přehledy",
                  "Databáze subdodavatelů",
                  "Export do Excel",
                ],
                cta: {
                  label: "Vyzkoušet",
                  kind: "link" as const,
                  to: "/register",
                },
              },
              {
                title: "Professional",
                price: "5 000 Kč",
                label: "měsíčně",
                badge: "Nejvýhodnější",
                featured: true,
                items: [
                  "Neomezené projekty",
                  "10 uživatelů",
                  "Dashboard + KPI",
                  "Plán výběrových řízení",
                  "AI rerporty a doplnění informací kontaktů",
                  "Excel Merger PRO",
                  "Excel Unlocker PRO",
                  "Document Hub - složkomat",
                  "Harmonogram s grafem",
                  "Exporty harmonogramu",
                ],
                cta: {
                  label: "Začít nyní",
                  kind: "link" as const,
                  to: "/register",
                },
              },
              {
                title: "Enterprise",
                price: "Na míru",
                label: "individuálně",
                items: [
                  "Stejné co v Professional",
                  "plus k tomu navíc:",
                  "Možnost in house řešení",
                  "Sestavení Docker image",
                  "Vlastní integrace",
                  "Možnost návrhu funkcí",
                  "Onboarding asistence",
                  "Vývoj vlastního modulu API",
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
          <div>
            © {new Date().getFullYear()} Tender Flow • v{APP_VERSION}
          </div>
          <div className="mt-2 text-white/40">
            Cloud řešení pro správu výběrových řízení ve stavebnictví
          </div>
        </footer>
      </main>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <img
            src={lightboxImage}
            alt="Zvětšený screenshot aplikace"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </PublicLayout>
  );
};
