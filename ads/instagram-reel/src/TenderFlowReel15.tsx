import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  BidCardUi,
  CategoryCard,
  CreateSectionCard,
  DemandTable,
  DetailToolbar,
  FilterBar,
  KanbanColumn,
  OverviewKpis,
  RoundChips,
} from "./appUi";
import { brand } from "./brand";
import { AppFrame, LogoMark, ReelChrome, SceneHeading, enter, fadeUp } from "./chrome";
import {
  CTA,
  DEMO_BIDS,
  DEMO_CATEGORIES,
  DEMO_OVERVIEW,
  DEMO_PROJECT,
  DEMO_TABLE,
  SCENES,
  TAGLINE,
} from "./copy";
import { SCENE_FRAMES } from "./storyboard";
import { useInterFont } from "./useInterFont";

const NewDemandButton = () => (
  <div
    style={{
      background: brand.accentMid,
      color: brand.inkOnAccent,
      borderRadius: 8,
      padding: "6px 10px",
      fontSize: 11,
      fontWeight: 800,
      whiteSpace: "nowrap",
    }}
  >
    Nová Poptávka
  </div>
);

const CategoriesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[0];

  return (
    <ReelChrome sceneIndex={0}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <AppFrame activeTab="pipeline" sidebar>
        <FilterBar active="all" extra={<NewDemandButton />} />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr 1fr",
            gap: 8,
          }}
        >
          {DEMO_CATEGORIES.map((category, index) => (
            <CategoryCard
              key={category.title}
              {...category}
              style={{
                opacity: enter(frame, fps, 3 + index * 3),
                transform: `translateY(${interpolate(enter(frame, fps, 3 + index * 3), [0, 1], [12, 0])}px)`,
              }}
            />
          ))}
          <CreateSectionCard />
        </div>
      </AppFrame>
    </ReelChrome>
  );
};

const OutreachScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[1];
  const contacted = enter(frame, fps, 8) > 0.4;

  return (
    <ReelChrome sceneIndex={1}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <AppFrame activeTab="pipeline" toolbar={<DetailToolbar />} categoryTitle={DEMO_PROJECT.category}>
        <div style={{ display: "flex", gap: 8, height: "100%", overflow: "hidden" }}>
          <KanbanColumn title="Oslovení" count={contacted ? 2 : 3} tone="slate">
            <BidCardUi
              company={DEMO_BIDS[0].company}
              person={DEMO_BIDS[0].person}
              email={DEMO_BIDS[0].email}
              phone={DEMO_BIDS[0].phone}
              compact
              inquiry
              style={{ opacity: enter(frame, fps, 6) }}
            />
            <BidCardUi
              company={DEMO_BIDS[1].company}
              person={DEMO_BIDS[1].person}
              email={DEMO_BIDS[1].email}
              phone={DEMO_BIDS[1].phone}
              compact
              inquiry
              style={{ opacity: enter(frame, fps, 10) }}
            />
            {!contacted ? (
              <BidCardUi
                company={DEMO_BIDS[3].company}
                person={DEMO_BIDS[3].person}
                email={DEMO_BIDS[3].email}
                phone={DEMO_BIDS[3].phone}
                compact
                inquiry
              />
            ) : null}
          </KanbanColumn>
          <KanbanColumn title="Odesláno" count={contacted ? 1 : 0} tone="blue">
            {contacted ? (
              <BidCardUi
                company={DEMO_BIDS[3].company}
                person={DEMO_BIDS[3].person}
                email={DEMO_BIDS[3].email}
                phone={DEMO_BIDS[3].phone}
                compact
                style={{ opacity: enter(frame, fps, 16) }}
              />
            ) : (
              <div style={{ color: brand.muted, fontSize: 12, fontStyle: "italic", padding: 10 }}>
                Žádní dodavatelé v této fázi
              </div>
            )}
          </KanbanColumn>
          <KanbanColumn title="Cenová nabídka" count={1} tone="amber">
            <BidCardUi
              company={DEMO_BIDS[4].company}
              person={DEMO_BIDS[4].person}
              email={DEMO_BIDS[4].email}
              phone={DEMO_BIDS[4].phone}
              price={DEMO_BIDS[4].rounds[0].price}
              compact
              style={{ opacity: enter(frame, fps, 12) }}
            />
          </KanbanColumn>
        </div>
      </AppFrame>
    </ReelChrome>
  );
};

const RoundsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[2];
  const winner = DEMO_BIDS[1];
  const activeRound = enter(frame, fps, 10) > 0.55 ? 2 : 1;

  return (
    <ReelChrome sceneIndex={2}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <AppFrame activeTab="pipeline" toolbar={<DetailToolbar />} categoryTitle={DEMO_PROJECT.category}>
        <RoundChips active={activeRound} />
        <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0, overflow: "hidden" }}>
          <KanbanColumn title="Cenová nabídka" count={1} tone="amber">
            <BidCardUi
              company={DEMO_BIDS[4].company}
              person={DEMO_BIDS[4].person}
              email={DEMO_BIDS[4].email}
              phone={DEMO_BIDS[4].phone}
              price={DEMO_BIDS[4].rounds[0].price}
              compact
              style={{ opacity: enter(frame, fps, 6) }}
            />
          </KanbanColumn>
          <KanbanColumn title="Užší výběr" count={2} tone="blue">
            <BidCardUi
              company={winner.company}
              person={winner.person}
              email={winner.email}
              phone={winner.phone}
              rounds={winner.rounds}
              selectedRound={activeRound}
              style={{ ...fadeUp(frame, fps, 8) }}
            />
            <BidCardUi
              company={DEMO_BIDS[0].company}
              person={DEMO_BIDS[0].person}
              email={DEMO_BIDS[0].email}
              rounds={DEMO_BIDS[0].rounds}
              selectedRound={DEMO_BIDS[0].selectedRound}
              compact
              style={{ opacity: enter(frame, fps, 14) }}
            />
          </KanbanColumn>
        </div>
      </AppFrame>
    </ReelChrome>
  );
};

const AwardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[3];
  const winner = DEMO_BIDS[1];

  return (
    <ReelChrome sceneIndex={3}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <AppFrame activeTab="pipeline" toolbar={<DetailToolbar />} categoryTitle={DEMO_PROJECT.category}>
        <div style={{ display: "flex", gap: 8, height: "100%", overflow: "hidden" }}>
          <KanbanColumn title="Užší výběr" count={1} tone="blue">
            <BidCardUi
              company={DEMO_BIDS[2].company}
              person={DEMO_BIDS[2].person}
              email={DEMO_BIDS[2].email}
              phone={DEMO_BIDS[2].phone}
              price={DEMO_BIDS[2].rounds[1].price}
              compact
              style={{ opacity: enter(frame, fps, 6) }}
            />
          </KanbanColumn>
          <KanbanColumn title="Jednání o SOD" count={1} tone="green">
            <BidCardUi
              company={winner.company}
              person={winner.person}
              email={winner.email}
              phone={winner.phone}
              price={winner.rounds[2].price}
              winner
              compact
              style={{ opacity: enter(frame, fps, 12) }}
            />
          </KanbanColumn>
          <KanbanColumn title="Zamítnuto" count={1} tone="red">
            <BidCardUi
              company={DEMO_BIDS[4].company}
              person={DEMO_BIDS[4].person}
              email={DEMO_BIDS[4].email}
              phone={DEMO_BIDS[4].phone}
              price={DEMO_BIDS[4].rounds[0].price}
              compact
              style={{ opacity: enter(frame, fps, 10) }}
            />
          </KanbanColumn>
        </div>
      </AppFrame>
    </ReelChrome>
  );
};

const ContractCtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[4];
  const pulse = interpolate(Math.sin(frame / 8), [-1, 1], [0.97, 1]);

  return (
    <ReelChrome sceneIndex={4}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <AppFrame activeTab="overview">
        <OverviewKpis {...DEMO_OVERVIEW} />
        <DemandTable rows={DEMO_TABLE} />
      </AppFrame>
      <div style={{ paddingTop: 14, textAlign: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <LogoMark size={68} />
        </div>
        <div style={{ fontSize: 17, color: brand.text2, marginBottom: 10 }}>{TAGLINE}</div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 460,
            padding: "16px 34px",
            borderRadius: 14,
            background: `linear-gradient(135deg, ${brand.accentHi}, ${brand.accentMid})`,
            color: brand.inkOnAccent,
            fontSize: 28,
            fontWeight: 800,
            transform: `scale(${pulse})`,
          }}
        >
          {CTA.primary}
        </div>
        <div style={{ marginTop: 8, fontSize: 22, color: brand.apricotSoft }}>{CTA.url}</div>
      </div>
    </ReelChrome>
  );
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
