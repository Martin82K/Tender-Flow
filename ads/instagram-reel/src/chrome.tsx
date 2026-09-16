import type { CSSProperties, ReactNode } from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { brand, fontFamily } from "./brand";
import { DEMO_PROJECT, PERSONA_KICKER, PRODUCT_NAME, PRODUCT_SUBLINE } from "./copy";
import { SCENE_FRAMES } from "./storyboard";

export const TF_APP_ICON = staticFile("tf-app-icon.png");

export const enter = (frame: number, fps: number, delay = 0): number => {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, mass: 0.7, stiffness: 140 },
  });
};

export const fadeUp = (
  frame: number,
  fps: number,
  delay = 0,
): { opacity: number; transform: string } => {
  const progress = enter(frame, fps, delay);
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [18, 0])}px)`,
  };
};

export const LogoMark: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: Math.round(size * 0.22),
      overflow: "hidden",
      background: "#020617",
      boxShadow: `0 0 ${Math.round(size * 0.28)}px rgba(242, 107, 26, 0.42)`,
    }}
  >
    <Img
      src={TF_APP_ICON}
      alt="Tender Flow"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: "scale(1.08)",
        display: "block",
      }}
    />
  </div>
);

export const ReelChrome: React.FC<{ children: ReactNode; sceneIndex: number }> = ({
  children,
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 80, 240, 449], [0.1, 0.16, 0.12, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: brand.bg,
        color: brand.text,
        fontFamily,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 34% at 50% -12%, rgba(255, 142, 51, ${glow}), transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "44px 28px 128px",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <LogoMark size={58} />
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
              {PRODUCT_NAME}
            </div>
            <div
              style={{
                fontSize: 13,
                color: brand.muted,
                marginTop: 3,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {PERSONA_KICKER}
            </div>
          </div>
        </header>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>{children}</div>
        <ProgressRail activeIndex={sceneIndex} />
      </div>
    </div>
  );
};

const ProgressRail: React.FC<{ activeIndex: number }> = ({ activeIndex }) => {
  return (
    <div style={{ display: "flex", gap: 8, paddingTop: 16 }}>
      {SCENE_FRAMES.map((scene, index) => (
        <div
          key={scene.id}
          style={{
            flex: 1,
            height: 6,
            borderRadius: 99,
            background: index <= activeIndex ? brand.accent : brand.line2,
          }}
        />
      ))}
    </div>
  );
};

export const SceneHeading: React.FC<{
  kicker: string;
  title: string;
  subtitle: string;
  delay?: number;
}> = ({ kicker, title, subtitle, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ paddingTop: 14, paddingBottom: 10, flexShrink: 0 }}>
      <div
        style={{
          ...fadeUp(frame, fps, delay),
          color: brand.accentHi,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        {kicker}
      </div>
      <h1
        style={{
          ...fadeUp(frame, fps, delay + 3),
          margin: "5px 0 0",
          fontSize: 40,
          lineHeight: 1.05,
          letterSpacing: "-0.045em",
          fontWeight: 800,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          ...fadeUp(frame, fps, delay + 6),
          margin: "6px 0 0",
          fontSize: 20,
          color: brand.text2,
          fontWeight: 450,
          lineHeight: 1.25,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
};

const PROJECT_TABS = ["Přehled", "Plán VŘ", "Výběrová řízení", "Harmonogram", "Dokumenty"] as const;

export const AppFrame: React.FC<{
  children: ReactNode;
  activeTab: "overview" | "pipeline" | "documents";
  sidebar?: boolean;
  toolbar?: ReactNode;
  categoryTitle?: string;
  style?: CSSProperties;
}> = ({ children, activeTab, sidebar = false, toolbar, categoryTitle, style }) => {
  const tabLabel =
    activeTab === "overview" ? "Přehled" : activeTab === "documents" ? "Dokumenty" : "Výběrová řízení";

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: brand.bg,
        border: `1px solid ${brand.line2}`,
        borderRadius: 18,
        overflow: "hidden",
        display: "flex",
        ...style,
      }}
    >
      {sidebar ? <AppSidebar active={activeTab} /> : null}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: brand.bg }}>
        <div style={{ padding: "12px 14px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em" }}>{DEMO_PROJECT.name}</div>
              <div style={{ color: brand.muted, fontSize: 13, marginTop: 2 }}>{DEMO_PROJECT.status}</div>
            </div>
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 4,
              padding: 4,
              borderRadius: 12,
              background: "rgba(15, 23, 42, 0.7)",
              border: `1px solid ${brand.line2}`,
              overflow: "hidden",
            }}
          >
            {PROJECT_TABS.map((tab) => {
              const on = tab === tabLabel;
              return (
                <div
                  key={tab}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    background: on ? brand.primary : "transparent",
                    color: on ? brand.inkOnPrimary : brand.muted,
                  }}
                >
                  {tab}
                </div>
              );
            })}
          </div>
          {categoryTitle ? (
            <div style={{ padding: "12px 0 4px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>{categoryTitle}</div>
              <div style={{ fontSize: 12, color: brand.muted, marginTop: 3 }}>
                {DEMO_PROJECT.name} · {DEMO_PROJECT.crumb}
              </div>
            </div>
          ) : null}
        </div>
        {toolbar}
        <div style={{ flex: 1, minHeight: 0, padding: 12, display: "flex", flexDirection: "column" }}>{children}</div>
      </div>
    </div>
  );
};

const AppSidebar: React.FC<{ active: "overview" | "pipeline" | "documents" }> = ({ active }) => {
  const items = [
    { id: "overview", label: "Přehled" },
    { id: "pipeline", label: "Výběrová řízení" },
    { id: "schedule", label: "Harmonogram" },
    { id: "documents", label: "Dokumenty" },
    { id: "subs", label: "Subdodavatelé" },
  ] as const;

  return (
    <aside
      style={{
        width: 196,
        flexShrink: 0,
        background: brand.deep,
        borderRight: `1px solid ${brand.line2}`,
        padding: "14px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 8px" }}>
        <LogoMark size={32} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.03em" }}>{PRODUCT_NAME}</div>
          <div style={{ fontSize: 9, color: brand.muted2, letterSpacing: "0.02em" }}>{PRODUCT_SUBLINE}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: brand.muted, padding: "6px 8px" }}>Dashboard</div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "7px 8px",
          borderRadius: 8,
          background: brand.primarySoft,
          color: brand.primary,
        }}
      >
        Stavby
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, padding: "4px 8px 2px", color: brand.text2 }}>{DEMO_PROJECT.name}</div>
      {items.map((item) => {
        const on = item.id === active;
        return (
          <div
            key={item.id}
            style={{
              fontSize: 12,
              fontWeight: on ? 700 : 500,
              padding: "6px 10px",
              borderRadius: 8,
              marginLeft: 8,
              background: on ? brand.primarySoft : "transparent",
              color: on ? brand.primary : brand.muted,
              border: on ? `1px solid ${brand.primary}` : "1px solid transparent",
            }}
          >
            {item.label}
          </div>
        );
      })}
    </aside>
  );
};
