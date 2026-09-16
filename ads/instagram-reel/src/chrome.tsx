import type { CSSProperties, ReactNode } from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { brand, fontFamily } from "./brand";
import { DEMO_PROJECT, PERSONA_KICKER, PRODUCT_NAME } from "./copy";
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
      background: "#090807",
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

const NavGlyph: React.FC<{ kind: "building" | "handshake" | "contract" | "settings"; active?: boolean }> = ({
  kind,
  active,
}) => {
  const color = active ? brand.accentHi : brand.muted;
  const common = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "building") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <path {...common} d="M4 20V9l8-5 8 5v11" />
        <path {...common} d="M9 20v-6h6v6" />
      </svg>
    );
  }
  if (kind === "handshake") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <path {...common} d="M4 12l4-2 3 3 6-4 3 2" />
        <path {...common} d="M8 10V7M16 9v3" />
      </svg>
    );
  }
  if (kind === "contract") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <path {...common} d="M6 3h9l5 5v13H6z" />
        <path {...common} d="M15 3v5h5M9 13h6M9 17h4" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <circle {...common} cx="12" cy="12" r="3.2" />
      <path {...common} d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.4 6.4l1.6 1.6M16 16l1.6 1.6M17.6 6.4 16 8M8 16l-1.6 1.6" />
    </svg>
  );
};

export const ReelChrome: React.FC<{ children: ReactNode; sceneIndex: number }> = ({
  children,
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 80, 240, 449], [0.12, 0.2, 0.14, 0.24], {
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
          background: `radial-gradient(ellipse 80% 38% at 50% -10%, rgba(255, 142, 51, ${glow}), transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "48px 32px 132px",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <LogoMark size={64} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
              {PRODUCT_NAME}
            </div>
            <div
              style={{
                fontSize: 14,
                color: brand.muted,
                marginTop: 4,
                fontWeight: 700,
                letterSpacing: "0.14em",
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
    <div style={{ display: "flex", gap: 8, paddingTop: 18 }}>
      {SCENE_FRAMES.map((scene, index) => (
        <div
          key={scene.id}
          style={{
            flex: 1,
            height: 6,
            borderRadius: 99,
            background: index <= activeIndex ? brand.accent : brand.line,
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
    <div style={{ paddingTop: 18, paddingBottom: 12, flexShrink: 0 }}>
      <div
        style={{
          ...fadeUp(frame, fps, delay),
          color: brand.accentHi,
          fontSize: 16,
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
          margin: "6px 0 0",
          fontSize: 44,
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
          margin: "8px 0 0",
          fontSize: 22,
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

export const AppFrame: React.FC<{
  children: ReactNode;
  activeTab: "pipeline" | "rounds" | "award" | "contract";
  toolbar?: ReactNode;
  style?: CSSProperties;
}> = ({ children, activeTab, toolbar, style }) => {
  const tabs = [
    { id: "overview", label: "Přehled" },
    { id: "pipeline", label: "Výběrová řízení" },
    { id: "contract", label: "Subdodavatel" },
  ] as const;
  const activeId = activeTab === "contract" ? "contract" : "pipeline";
  const nav = [
    { kind: "building" as const, active: activeTab !== "contract" },
    { kind: "handshake" as const, active: false },
    { kind: "contract" as const, active: activeTab === "contract" },
    { kind: "settings" as const, active: false },
  ];

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: brand.surface,
        border: `1px solid ${brand.line}`,
        borderRadius: 18,
        overflow: "hidden",
        display: "flex",
        ...style,
      }}
    >
      <aside
        style={{
          width: 64,
          flexShrink: 0,
          background: brand.deep,
          borderRight: `1px solid ${brand.line}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "14px 0 12px",
          gap: 10,
        }}
      >
        <LogoMark size={36} />
        <div style={{ width: 28, height: 1, background: brand.line, margin: "4px 0 2px" }} />
        {nav.map((item) => (
          <div
            key={item.kind}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: item.active ? "rgba(255, 138, 51, 0.16)" : "transparent",
              border: item.active ? `1px solid rgba(255, 158, 61, 0.4)` : "1px solid transparent",
            }}
          >
            <NavGlyph kind={item.kind} active={item.active} />
          </div>
        ))}
      </aside>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px 8px" }}>
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.03em" }}>{DEMO_PROJECT.name}</div>
          <div style={{ color: brand.muted, fontSize: 13, marginTop: 3 }}>
            {DEMO_PROJECT.code} · {DEMO_PROJECT.status}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "0 12px 10px",
            borderBottom: `1px solid ${brand.line}`,
          }}
        >
          {tabs.map((tab) => {
            const on = tab.id === activeId;
            return (
              <div
                key={tab.id}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  background: on ? "rgba(255, 138, 51, 0.16)" : "transparent",
                  color: on ? brand.accentHi : brand.muted,
                  border: on ? `1px solid rgba(255, 158, 61, 0.45)` : "1px solid transparent",
                }}
              >
                {tab.label}
              </div>
            );
          })}
        </div>
        {toolbar}
        <div style={{ flex: 1, minHeight: 0, padding: 12, background: brand.deep, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
};
