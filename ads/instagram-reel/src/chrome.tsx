import type { CSSProperties, ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand, fontFamily } from "./brand";
import { CTA, PERSONA_KICKER, PRODUCT_NAME } from "./copy";
import { SCENE_FRAMES } from "./storyboard";

export const enter = (frame: number, fps: number, delay = 0, distance = 28): number => {
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
    transform: `translateY(${interpolate(progress, [0, 1], [22, 0])}px)`,
  };
};

export const ReelChrome: React.FC<{ children: ReactNode; sceneIndex: number }> = ({
  children,
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 80, 240, 449], [0.16, 0.22, 0.18, 0.28], {
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
          background: `radial-gradient(ellipse 90% 55% at 50% -10%, rgba(234, 160, 121, ${glow}), transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
          opacity: 0.45,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px 64px 168px",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${brand.accentSoft}, ${brand.accent})`,
                color: brand.inkOnAccent,
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: "-0.04em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              TF
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em" }}>
                {PRODUCT_NAME}
              </div>
              <div style={{ fontSize: 22, color: brand.muted, marginTop: 4 }}>{PERSONA_KICKER}</div>
            </div>
          </div>
        </header>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
        <ProgressRail activeIndex={sceneIndex} />
      </div>
    </div>
  );
};

const ProgressRail: React.FC<{ activeIndex: number }> = ({ activeIndex }) => {
  return (
    <div style={{ display: "flex", gap: 10, paddingTop: 28 }}>
      {SCENE_FRAMES.map((scene, index) => (
        <div
          key={scene.id}
          style={{
            flex: 1,
            height: 8,
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
    <div style={{ paddingTop: 54, paddingBottom: 36 }}>
      <div style={{ ...fadeUp(frame, fps, delay), color: brand.accent, fontSize: 24, fontWeight: 650, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {kicker}
      </div>
      <h1 style={{ ...fadeUp(frame, fps, delay + 3), margin: "14px 0 0", fontSize: 72, lineHeight: 1.05, letterSpacing: "-0.045em", fontWeight: 760 }}>
        {title}
      </h1>
      <p style={{ ...fadeUp(frame, fps, delay + 6), margin: "18px 0 0", fontSize: 32, color: brand.text2, fontWeight: 450, lineHeight: 1.3 }}>
        {subtitle}
      </p>
    </div>
  );
};

export const Panel: React.FC<{ children: ReactNode; style?: CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: brand.card,
      border: `1px solid ${brand.line}`,
      borderRadius: 32,
      padding: 36,
      ...style,
    }}
  >
    {children}
  </div>
);
