import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Brain,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ClipboardList,
  Cloud,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GanttChart,
  GitBranch,
  Globe,
  HelpCircle,
  Layout,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  Play,
  ScanText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
  Zap,
} from "lucide-react";
import { PublicLayout } from "./public/PublicLayout";
import { PublicHeader } from "./public/PublicHeader";
import { Link, useLocation, navigate } from "./routing/router";
import { useAuth } from "../context/AuthContext";
import { APP_VERSION } from "../config/version";
import { ScrollReveal } from "./ui/ScrollReveal";
import { GradientText } from "./ui/GradientText";
import { FloatingElements } from "./ui/FloatingElements";
import { PulseBadge } from "./ui/PulseBadge";
import { Timeline, HorizontalTimeline, BentoGrid } from "./ui/Timeline";
import { TimeSavingsVisualizer } from "./ui/TimeSavingsVisualizer";
import { PRICING_CONFIG } from "../services/billingService";

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
  <div className="feature-card h-full rounded-2xl border border-white/10 bg-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:border-orange-500/30 hover:bg-gray-950/60 hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-500/10 group">
    <div className="feature-icon-wrapper w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-orange-500/30">
      {icon}
    </div>
    <h3 className="mt-4 text-white font-semibold transition-colors duration-300 group-hover:text-orange-200">
      {title}
    </h3>
    <p className="mt-2 text-sm text-white/60 leading-relaxed transition-colors duration-300 group-hover:text-white/80">
      {text}
    </p>
  </div>
);

interface PricingFeatureListProps {
  features: string[];
  colors: {
    icon: string;
    [key: string]: string;
  };
}

const PricingFeatureList: React.FC<PricingFeatureListProps> = ({
  features,
  colors,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const LIMIT = 6;
  const validFeatures = features.filter((t) => t && t.trim().length > 0);
  const shouldTruncate = validFeatures.length > LIMIT;

  const visibleFeatures =
    shouldTruncate && !isExpanded
      ? validFeatures.slice(0, LIMIT)
      : validFeatures;

  return (
    <div className="mt-4">
      <ul className="space-y-3 text-sm text-slate-300">
        {visibleFeatures.map((t, idx) => (
          <li
            key={t}
            className="flex items-start gap-3 group-hover:text-slate-200 transition-colors duration-300"
            style={{ transitionDelay: `${idx * 50}ms` }}
          >
            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${colors.icon}`} />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`mt-4 text-xs font-semibold uppercase tracking-wider hover:underline transition-all duration-300 flex items-center gap-1 ${colors.icon}`}
        >
          {isExpanded ? (
            <>
              Zobrazit méně <ChevronDown className="w-3 h-3 rotate-180" />
            </>
          ) : (
            <>
              Zobrazit další <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const { hash } = useLocation();
  const { loginAsDemo } = useAuth();
  const [activePricingPlan, setActivePricingPlan] =
    useState<string>("Professional");
  const [activeDemoTab, setActiveDemoTab] = useState<string>("prehled");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly",
  );
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
      el.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [hash]);

  return (
    <PublicLayout>
      <PublicHeader variant="marketing" />

      <main className="relative mx-auto max-w-6xl px-4 py-10 md:py-16">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gray-950/30 backdrop-blur">
          {/* Animated Background Elements */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 15% 25%, rgba(255, 138, 51, 0.18) 0%, transparent 55%), radial-gradient(circle at 70% 10%, rgba(255, 138, 51, 0.10) 0%, transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.0) 45%, rgba(0,0,0,0.25) 100%)",
            }}
          />

          {/* Subtle background decoration - no icons overlapping text */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
          </div>

          <div className="relative p-8 md:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Levy obsah */}
              <div>
                <ScrollReveal direction="down" delay={100}>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:border-orange-500/30 hover:bg-white/10 transition-all duration-300 cursor-default">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    v{APP_VERSION} • Cloud-based řešení
                  </div>
                </ScrollReveal>

                <ScrollReveal delay={200}>
                  <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-white leading-[1.05]">
                    Staví se lépe,
                    <br />
                    když máte <GradientText>přehled</GradientText>
                  </h1>
                </ScrollReveal>

                <ScrollReveal delay={300}>
                  <p className="mt-4 text-white/65 leading-relaxed text-base md:text-lg max-w-2xl">
                    Cloud řešení pro řízení výběrových řízení ve stavebnictví.
                    <br />
                    Jedno místo pro podklady, nabídky, rozhodnutí a sdílení v týmu.
                    <br />
                  </p>
                </ScrollReveal>

                <ScrollReveal delay={500} direction="up">
                  <div className="mt-8 flex items-center gap-2 text-white/60">
                    <Brain className="w-4 h-4 text-orange-400" />
                    <span className="text-sm">
                      Čas je mnohdy to nejdražší — snižujeme repetitivní úkony
                    </span>
                  </div>
                </ScrollReveal>
              </div>

              {/* Pravy obsah - animovane hodiny */}
              <div className="hidden lg:flex justify-end pt-4">
                <ScrollReveal direction="left" delay={400}>
                  <TimeSavingsVisualizer hoursSaved={15} />
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        <section id="demo" className="mt-16 md:mt-24 scroll-mt-24">
          <ScrollReveal direction="up" delay={200} threshold={0.2}>
            <div className="rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-6 hover:border-orange-500/20 transition-all duration-500 group">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 group-hover:from-orange-500/5 group-hover:to-transparent transition-all duration-500">
                {/* Browser window header */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80 group-hover:bg-red-400 transition-colors duration-300" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80 group-hover:bg-yellow-400 transition-colors duration-300" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80 group-hover:bg-green-400 transition-colors duration-300" />
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
                        id: "plan-vr",
                        label: "Plán VŘ",
                        icon: "event_note",
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
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 flex items-center gap-1.5 magnetic-btn ${
                          activeDemoTab === tab.id
                            ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                            : "text-white/60 hover:text-white hover:bg-white/5 hover:scale-105"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] transition-transform duration-300">
                          {tab.icon}
                        </span>
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Screenshot display */}
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 overflow-hidden group-hover:border-orange-500/20 transition-all duration-500">
                  <div
                    className="relative w-full overflow-auto max-h-[400px] cursor-zoom-in"
                    onClick={() => {
                      const srcMap: Record<string, string> = {
                        prehled: "/screenshots/prehled-poptavek.png",
                        "plan-vr": "/screenshots/plán VŘ.png",
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
                        className="w-full h-auto transition-transform duration-700 hover:scale-[1.02]"
                      />
                    )}
                    {activeDemoTab === "plan-vr" && (
                      <img
                        src="/screenshots/plán VŘ.png"
                        alt="Plán výběrových řízení - plánování a přehled termínů výběrových řízení"
                        className="w-full h-auto transition-transform duration-700 hover:scale-[1.02]"
                      />
                    )}
                    {activeDemoTab === "karty" && (
                      <img
                        src="/screenshots/vyberove-rizeni.png"
                        alt="Výběrová řízení - kartové zobrazení s detaily jednotlivých poptávek"
                        className="w-full h-auto transition-transform duration-700 hover:scale-[1.02]"
                      />
                    )}
                    {activeDemoTab === "kanban" && (
                      <img
                        src="/screenshots/kanban.png"
                        alt="Kanban pipeline - přehled fází výběrového řízení od oslovení po smlouvu"
                        className="w-full h-auto transition-transform duration-700 hover:scale-[1.02]"
                      />
                    )}
                    {activeDemoTab === "harmonogram" && (
                      <img
                        src="/screenshots/harmonogram.png"
                        alt="Harmonogram - Ganttův diagram s přehledem termínů výběrových řízení"
                        className="w-full h-auto transition-transform duration-700 hover:scale-[1.02]"
                      />
                    )}
                    {activeDemoTab === "slozkomat" && (
                      <img
                        src="/screenshots/slozkomat.png"
                        alt="Složkomat - propojení s Google Drive a OneDrive pro správu dokumentů"
                        className="w-full h-auto transition-transform duration-700 hover:scale-[1.02]"
                      />
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white/80 text-xs px-2 py-1 rounded-lg flex items-center gap-1 group-hover:bg-orange-500/80 group-hover:text-white transition-all duration-300">
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
                    {activeDemoTab === "plan-vr" &&
                      "Plánování výběrových řízení s přehledem termínů a milníků"}
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
          </ScrollReveal>
        </section>

        {/* HIDDEN: Solution section - uncomment to restore
        <section id="solution" className="mt-16 md:mt-24 scroll-mt-24">
          <ScrollReveal direction="up" threshold={0.1}>
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
                Proč <GradientText>Tender Flow</GradientText>?
              </h2>
              <p className="mt-3 text-white/60 max-w-2xl mx-auto">
                Srovnání tradičního přístupu s moderním řešením
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScrollReveal direction="left" threshold={0.2}>
              <div className="relative rounded-3xl border border-white/10 bg-gray-950/40 backdrop-blur p-8 h-full hover:border-white/20 transition-all duration-500 group overflow-hidden">
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                      <X className="w-5 h-5 text-white/60" />
                    </div>
                    <div className="text-xl font-semibold text-white/80 group-hover:text-white transition-colors duration-300">
                      Bez Tender Flow
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {[
                      "Excel/Sheets pro každý projekt zvlášť",
                      "Nabídky rozházené po e-mailech",
                      "Ruční porovnávání cen a variant",
                      "Nejasný stav poptávek a termínů",
                      "Ruční sumarizace dat a reporty",
                      "Chaotické složky s různou strukturou",
                      "Ruční tvorba a úpravy harmonogramu",
                    ].map((text, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-white/50 group-hover:text-white/60 transition-all duration-300"
                      >
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
                        <span className="text-sm">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" threshold={0.2} delay={100}>
              <div className="relative rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-gray-950/40 to-gray-950/60 backdrop-blur p-8 h-full hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-500 group overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl group-hover:bg-orange-500/30 transition-all duration-500" />

                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                      <Check className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="text-xl font-semibold text-white group-hover:text-orange-100 transition-colors duration-300">
                      S Tender Flow
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {[
                      "Vše na jednom místě v cloudu",
                      "Šablony a jednotný výstup poptávek",
                      "Plánování výběrových řízení",
                      "Automatická tvorba poptávek",
                      "Auto-generovaný harmonogram",
                      "Přehledný tok od plánu po vyhodnocení",
                      "Rychlé sdílení kontextu v týmu",
                      "Export/report jedním klikem",
                      "Hodnocení dodavatelů",
                      "Dynamické šablony s vlastním editorem",
                    ].map((text, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-white/70 group-hover:text-white/80 transition-all duration-300"
                        style={{ transitionDelay: `${i * 50}ms` }}
                      >
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                        <span className="text-sm font-medium">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
        END HIDDEN */}

        <section id="features" className="mt-16 md:mt-24 scroll-mt-24">
          <ScrollReveal direction="up" threshold={0.1}>
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
                Vše, co potřebujete <GradientText>na jednom místě</GradientText>
              </h2>
              <p className="mt-3 text-white/60 max-w-2xl mx-auto">
                Kompletní řešení pro správu výběrových řízení od plánování po
                vyhodnocení
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={200} threshold={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[180px]">
              {/* Row 1 */}
              <div className="md:col-span-2 group relative rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-500/40">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-orange-500/30">
                  <LayoutDashboard size={24} />
                </div>
                <h3 className="mt-4 text-white font-semibold group-hover:text-orange-200 transition-colors duration-300">
                  Dashboard a přehledy
                </h3>
                <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                  Aktuální stav zakázek, pipeline a rychlé akce bez zbytečného
                  hledání.
                </p>
              </div>

              <div className="group relative rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-500/40">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-500/30">
                  <FileText size={24} />
                </div>
                <h3 className="mt-4 text-white font-semibold group-hover:text-blue-200 transition-colors duration-300">
                  Dokumenty
                </h3>
                <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                  Nabídky, podklady a exporty na jednom místě.
                </p>
              </div>

              <div className="group relative rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-500/40">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-purple-500/30">
                  <Users size={24} />
                </div>
                <h3 className="mt-4 text-white font-semibold group-hover:text-purple-200 transition-colors duration-300">
                  Kontakty
                </h3>
                <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                  Historie spolupráce a rychlý výběr.
                </p>
              </div>

              {/* Row 2 */}
              <div className="group relative rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-500/40">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-emerald-500/30">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="mt-4 text-white font-semibold group-hover:text-emerald-200 transition-colors duration-300">
                  Bezpečnost
                </h3>
                <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                  Přístupová práva podle firmy.
                </p>
              </div>

              <div className="md:col-span-2 group relative rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-500/40">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-orange-500/30">
                  <Sparkles size={24} />
                </div>
                <h3 className="mt-4 text-white font-semibold group-hover:text-orange-200 transition-colors duration-300">
                  Harmonogram
                </h3>
                <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                  Generuje se sám na základě dat v plánu výběrů subdodavatelů.
                  Základ snadno upravujete.
                </p>
              </div>

              <div className="group relative rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-500/40">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-500/30">
                  <Settings size={24} />
                </div>
                <h3 className="mt-4 text-white font-semibold group-hover:text-blue-200 transition-colors duration-300">
                  Nástroje
                </h3>
                <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                  Excel nástroje pro rychlejší práci.
                </p>
              </div>

              {/* Row 3 */}
              <div className="md:col-span-2 group relative rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-500/40">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-purple-500/30">
                  <ScanText size={24} />
                </div>
                <h3 className="mt-4 text-white font-semibold group-hover:text-purple-200 transition-colors duration-300">
                  OCR dokumenty
                </h3>
                <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                  Vytěžování dokumentů pomocí technologie OCR a AI pro další
                  zpracování.
                </p>
              </div>

              <div className="md:col-span-2 group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:border-white/20">
                <div className="h-full flex flex-col justify-center items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-3">
                    <Check size={24} />
                  </div>
                  <h3 className="text-white font-semibold">
                    A mnoho dalšího...
                  </h3>
                  <p className="mt-1 text-white/50 text-sm">
                    Objevte všechny funkce v demo verzi
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        <section id="pricing" className="mt-16 md:mt-24 scroll-mt-24">
          {/* Billing period toggle */}
          <ScrollReveal direction="down" threshold={0.3}>
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 hover:border-orange-500/20 transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setBillingPeriod("monthly")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 magnetic-btn ${
                    billingPeriod === "monthly"
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Měsíčně
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod("yearly")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 magnetic-btn flex items-center gap-2 ${
                    billingPeriod === "yearly"
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Ročně
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                    2 měsíce zdarma
                  </span>
                </button>
              </div>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.values(PRICING_CONFIG).map((p: any, i) => {
              const isActive = activePricingPlan === p.title || !!p.featured;

              // Helper for dynamic classes based on accent color
              const getAccentClasses = () => {
                switch (p.accent) {
                  case "sky":
                    return {
                      border: "border-sky-500/20 hover:border-sky-500/40",
                      bg: "from-sky-500/10",
                      text: "text-sky-400",
                      pill: "bg-sky-500/10 text-sky-400 border-sky-500/20",
                      icon: "text-sky-500",
                      btn: "bg-sky-500 hover:bg-sky-600 shadow-sky-500/20",
                      btnText: "text-white",
                    };
                  case "orange":
                    return {
                      border: "border-orange-500/20 hover:border-orange-500/40",
                      bg: "from-orange-500/10",
                      text: "text-orange-400",
                      pill: "bg-orange-500/10 text-orange-400 border-orange-500/20",
                      icon: "text-orange-500",
                      btn: "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20",
                      btnText: "text-white",
                    };
                  case "emerald":
                    return {
                      border:
                        "border-emerald-500/20 hover:border-emerald-500/40",
                      bg: "from-emerald-500/10",
                      text: "text-emerald-400",
                      pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      icon: "text-emerald-500",
                      btn: "border border-emerald-500/30 hover:bg-emerald-500/10",
                      btnText: "text-emerald-400",
                    };
                  default:
                    return {
                      border: "border-white/10 hover:border-white/20",
                      bg: "from-white/5",
                      text: "text-white",
                      pill: "bg-white/10 text-white",
                      icon: "text-white",
                      btn: "bg-white/10 hover:bg-white/20",
                      btnText: "text-white",
                    };
                }
              };

              const colors = getAccentClasses();

              // Determine price label
              let priceLabel = "/měsíc";
              if (p.monthlyPrice === null) priceLabel = "individuálně";

              return (
                <ScrollReveal
                  key={p.title}
                  direction="up"
                  delay={i * 150}
                  threshold={0.1}
                  className="h-full"
                >
                  <div
                    className={[
                      "group relative rounded-3xl border backdrop-blur p-8 flex flex-col h-full transition-all duration-300 transform-gpu bg-gray-950/40",
                      "hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.99] hover:shadow-2xl hover:shadow-black/40",
                      colors.border,
                      p.featured
                        ? "bg-gradient-to-br " +
                          colors.bg +
                          " via-gray-950/40 to-transparent"
                        : "",
                    ].join(" ")}
                    onMouseEnter={() => setActivePricingPlan(p.title)}
                    onFocus={() => setActivePricingPlan(p.title)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Title with Icon */}
                      <div className="flex items-center gap-3">
                        {p.accent === "sky" && (
                          <Zap
                            className={`w-5 h-5 ${colors.icon} fill-current opacity-80`}
                          />
                        )}
                        {p.accent === "orange" && (
                          <Zap
                            className={`w-5 h-5 ${colors.icon} fill-current opacity-80`}
                          />
                        )}
                        {p.accent === "emerald" && (
                          <Shield
                            className={`w-5 h-5 ${colors.icon} fill-current opacity-80`}
                          />
                        )}
                        <div className="text-white font-bold tracking-wide uppercase text-sm">
                          {p.title}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2">
                        {p.trialDurationDays && (
                          <div
                            className={`shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-1 border ${colors.pill}`}
                          >
                            {p.trialDurationDays} dní zdarma
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex items-end gap-2">
                      {p.monthlyPrice !== null ? (
                        <div className="flex flex-col items-start w-full">
                          {billingPeriod === "yearly" && (
                            <span className="text-lg font-medium text-slate-500 line-through decoration-slate-500/50 mb-0.5 ml-1">
                              {p.monthlyPrice / 100} Kč
                            </span>
                          )}
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-5xl font-black text-white tracking-tighter">
                              {billingPeriod === "monthly"
                                ? `${p.monthlyPrice / 100} Kč`
                                : `${Math.round(p.yearlyPrice / 100 / 12)} Kč`}
                            </span>
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                              /m
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start pt-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-5xl font-black text-white tracking-tight">
                              Na míru
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Placeholder for spacing stability if needed, or remove */}
                    <div className="h-4"></div>

                    <PricingFeatureList features={p.features} colors={colors} />

                    <div className="mt-auto pt-8">
                      {p.cta.isMailto ? (
                        <a
                          href={p.cta.href}
                          className={`inline-flex w-full h-12 items-center justify-center px-5 rounded-xl text-sm font-bold transition-all duration-300 ${colors.btn} ${colors.btnText}`}
                        >
                          {p.cta.label}
                        </a>
                      ) : (
                        <Link
                          to={p.cta.href}
                          className={`inline-flex w-full h-12 items-center justify-center px-5 rounded-xl text-sm font-bold transition-all duration-300 shadow-lg ${colors.btn} ${colors.btnText}`}
                        >
                          {p.cta.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        <section className="mt-16 md:mt-24">
          <ScrollReveal direction="scale" threshold={0.5}>
            <div className="group rounded-[32px] border border-white/10 bg-gradient-to-br from-gray-950 via-gray-950/60 to-gray-950 p-10 md:p-16 text-center relative overflow-hidden hover:border-orange-500/30 transition-all duration-700">
              {/* Animated background glow */}
              <div
                className="absolute inset-0 opacity-60 group-hover:opacity-100 transition-opacity duration-700"
                style={{
                  background:
                    "radial-gradient(circle at 30% 20%, rgba(255, 138, 51, 0.25) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(255, 138, 51, 0.15) 0%, transparent 55%)",
                }}
              />
              {/* Shimmer effect overlay */}
              <div className="absolute inset-0 shimmer-effect opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative">
                <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white leading-tight group-hover:scale-[1.02] transition-transform duration-500">
                  Připraveni změnit způsob,
                  <br className="hidden md:block" />
                  jakým řídíte <GradientText>výběrová řízení</GradientText>?
                </h2>
                <p className="mt-4 text-white/60 group-hover:text-white/70 transition-colors duration-300">
                  Začněte zdarma s demo projektem. Žádná kreditní karta není
                  potřeba.
                </p>
                <div className="mt-8 flex justify-center">
                  <Link
                    to="/register"
                    className="magnetic-btn inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-all duration-300 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-105"
                  >
                    Začít hned teď →
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        <footer className="mt-10 pb-10 border-t border-white/10 pt-8 text-sm text-white/50 text-center hover:border-orange-500/20 transition-colors duration-500">
          <div className="hover:text-white/70 transition-colors duration-300">
            © {new Date().getFullYear()} Tender Flow • v{APP_VERSION}
          </div>
          <div className="mt-2 text-white/40 hover:text-white/50 transition-colors duration-300">
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
