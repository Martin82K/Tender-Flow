import type { CSSProperties } from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "./brand";
import { CTA, DEMO_PROJECT, SCENES, TAGLINE } from "./copy";
import { Panel, ReelChrome, SceneHeading, enter, fadeUp } from "./chrome";
import { SCENE_FRAMES } from "./storyboard";
import { useInterFont } from "./useInterFont";

const CategoriesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[0];

  return (
    <ReelChrome sceneIndex={0}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
        {scene.cards.map((card, index) => {
          const progress = enter(frame, fps, 8 + index * 5);
          return (
            <div
              key={card.label}
              style={{
                ...cardStyle,
                opacity: progress,
                transform: `translateY(${interpolate(progress, [0, 1], [24, 0])}px)`,
              }}
            >
              <div style={{ width: 14, height: 14, borderRadius: 99, background: brand.accent }} />
              <div>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em" }}>{card.label}</div>
                <div style={{ fontSize: 26, color: brand.muted, marginTop: 6 }}>{card.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </ReelChrome>
  );
};

const OutreachScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[1];

  return (
    <ReelChrome sceneIndex={1}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <Panel>
        <div style={{ color: brand.muted, fontSize: 22, marginBottom: 22 }}>
          {DEMO_PROJECT.name} · {DEMO_PROJECT.category}
        </div>
        {scene.rows.map((row, index) => {
          const progress = enter(frame, fps, 6 + index * 6);
          const checked = index < 2 ? progress > 0.55 : false;
          return (
            <div
              key={row.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "22px 0",
                borderTop: index === 0 ? "none" : `1px solid ${brand.line}`,
                opacity: progress,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: `2px solid ${checked ? brand.accent : brand.line}`,
                    background: checked ? brand.accent : "transparent",
                    color: brand.inkOnAccent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                  }}
                >
                  {checked ? "✓" : ""}
                </div>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 650 }}>{row.name}</div>
                  <div style={{ fontSize: 22, color: brand.muted }}>{row.role}</div>
                </div>
              </div>
              <div style={{ fontSize: 22, color: checked ? brand.accent : brand.muted }}>{row.state}</div>
            </div>
          );
        })}
      </Panel>
    </ReelChrome>
  );
};

const RoundsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[2];

  return (
    <ReelChrome sceneIndex={2}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {scene.rounds.map((round, index) => {
          const progress = enter(frame, fps, 8 + index * 8);
          const active = index === 1;
          return (
            <Panel
              key={round.name}
              style={{
                opacity: progress,
                transform: `translateY(${interpolate(progress, [0, 1], [26, 0])}px)`,
                borderColor: active ? brand.accent : brand.line,
                boxShadow: active ? `0 0 0 2px ${brand.accent}` : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 40, fontWeight: 730, letterSpacing: "-0.04em" }}>{round.name}</div>
                <div style={{ fontSize: 24, color: active ? brand.accent : brand.muted }}>{round.status}</div>
              </div>
              <div style={{ marginTop: 14, fontSize: 28, color: brand.text2 }}>{round.count}</div>
            </Panel>
          );
        })}
      </div>
    </ReelChrome>
  );
};

const AwardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[3];

  return (
    <ReelChrome sceneIndex={3}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {scene.offers.map((offer, index) => {
          const progress = enter(frame, fps, 6 + index * 5);
          return (
            <Panel
              key={offer.vendor}
              style={{
                opacity: progress,
                transform: `scale(${interpolate(progress, [0, 1], [0.96, 1])})`,
                borderColor: offer.selected ? brand.accent : brand.line,
                background: offer.selected ? "#2f2924" : brand.card,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 34, fontWeight: 700 }}>{offer.vendor}</div>
                  <div style={{ fontSize: 24, color: offer.selected ? brand.accent : brand.muted, marginTop: 6 }}>
                    {offer.note}
                  </div>
                </div>
                {offer.selected ? (
                  <div
                    style={{
                      padding: "10px 18px",
                      borderRadius: 999,
                      background: brand.accent,
                      color: brand.inkOnAccent,
                      fontWeight: 750,
                      fontSize: 22,
                    }}
                  >
                    Vybráno
                  </div>
                ) : null}
              </div>
            </Panel>
          );
        })}
      </div>
    </ReelChrome>
  );
};

const ContractCtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[4];
  const pulse = interpolate(Math.sin(frame / 8), [-1, 1], [0.96, 1]);

  return (
    <ReelChrome sceneIndex={4}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <Panel style={{ ...fadeUp(frame, fps, 8) }}>
        <div style={{ color: brand.muted, fontSize: 22 }}>Od výběru ke smlouvě</div>
        <div style={{ fontSize: 36, fontWeight: 700, marginTop: 12 }}>{DEMO_PROJECT.name}</div>
        <div style={{ fontSize: 26, color: brand.text2, marginTop: 10 }}>Instal Pro · {DEMO_PROJECT.category}</div>
        <div style={{ height: 18 }} />
        <div style={{ height: 12, borderRadius: 99, background: brand.line, overflow: "hidden" }}>
          <div
            style={{
              width: `${interpolate(enter(frame, fps, 12), [0, 1], [18, 100])}%`,
              height: "100%",
              background: brand.accent,
            }}
          />
        </div>
        <div style={{ marginTop: 14, color: brand.accent, fontSize: 22 }}>Připraveno k podpisu</div>
      </Panel>
      <div style={{ marginTop: 56, textAlign: "center" }}>
        <div style={{ fontSize: 28, color: brand.text2, marginBottom: 28 }}>{TAGLINE}</div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 520,
            padding: "28px 42px",
            borderRadius: 22,
            background: brand.accent,
            color: brand.inkOnAccent,
            fontSize: 36,
            fontWeight: 780,
            transform: `scale(${pulse})`,
          }}
        >
          {CTA.primary}
        </div>
        <div style={{ marginTop: 22, fontSize: 30, color: brand.accentSoft, letterSpacing: "0.02em" }}>{CTA.url}</div>
      </div>
    </ReelChrome>
  );
};

const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 22,
  background: brand.card,
  border: `1px solid ${brand.line}`,
  borderRadius: 28,
  padding: "28px 32px",
};

export const TenderFlowReel15: React.FC = () => {
  useInterFont();

  return (
    <AbsoluteFill style={{ background: brand.bg }}>
      <Sequence from={SCENE_FRAMES[0].from} durationInFrames={SCENE_FRAMES[0].durationInFrames}>
        <CategoriesScene />
      </Sequence>
      <Sequence from={SCENE_FRAMES[1].from} durationInFrames={SCENE_FRAMES[1].durationInFrames}>
        <OutreachScene />
      </Sequence>
      <Sequence from={SCENE_FRAMES[2].from} durationInFrames={SCENE_FRAMES[2].durationInFrames}>
        <RoundsScene />
      </Sequence>
      <Sequence from={SCENE_FRAMES[3].from} durationInFrames={SCENE_FRAMES[3].durationInFrames}>
        <AwardScene />
      </Sequence>
      <Sequence from={SCENE_FRAMES[4].from} durationInFrames={SCENE_FRAMES[4].durationInFrames}>
        <ContractCtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};
