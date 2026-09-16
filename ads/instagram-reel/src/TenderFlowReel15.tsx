import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  BidCardUi,
  CategoryCard,
  ContractRow,
  DetailToolbar,
  FilterBar,
  KanbanColumn,
  RoundChips,
} from "./appUi";
import { brand } from "./brand";
import { AppFrame, LogoMark, ReelChrome, SceneHeading, enter, fadeUp } from "./chrome";
import { CTA, DEMO_BIDS, DEMO_CATEGORIES, DEMO_CONTRACTS, DEMO_PROJECT, SCENES, TAGLINE } from "./copy";
import { SCENE_FRAMES } from "./storyboard";
import { useInterFont } from "./useInterFont";

const CategoriesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[0];

  return (
    <ReelChrome sceneIndex={0}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <AppFrame activeTab="pipeline">
        <FilterBar active="all" />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 10,
          }}
        >
          {DEMO_CATEGORIES.map((category, index) => (
            <CategoryCard
              key={category.title}
              {...category}
              style={{
                opacity: enter(frame, fps, 4 + index * 4),
                transform: `translateY(${interpolate(enter(frame, fps, 4 + index * 4), [0, 1], [14, 0])}px)`,
              }}
            />
          ))}
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
      <AppFrame activeTab="pipeline" toolbar={<DetailToolbar category={DEMO_PROJECT.category} />}>
        <div style={{ display: "flex", gap: 10, height: "100%", overflow: "hidden" }}>
          <KanbanColumn title="Oslovení" count={contacted ? 2 : 3} tone="slate">
            <BidCardUi
              company={DEMO_BIDS[0].company}
              person={DEMO_BIDS[0].person}
              email={DEMO_BIDS[0].email}
              compact
              inquiry
              style={{ opacity: enter(frame, fps, 6) }}
            />
            <BidCardUi
              company={DEMO_BIDS[1].company}
              person={DEMO_BIDS[1].person}
              email={DEMO_BIDS[1].email}
              compact
              inquiry
              style={{ opacity: enter(frame, fps, 10) }}
            />
            {!contacted ? (
              <BidCardUi
                company={DEMO_BIDS[3].company}
                person={DEMO_BIDS[3].person}
                email={DEMO_BIDS[3].email}
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
                compact
                style={{ opacity: enter(frame, fps, 16) }}
              />
            ) : (
              <div style={{ color: brand.muted, fontSize: 13, fontStyle: "italic", padding: 10 }}>
                Žádní dodavatelé v této fázi
              </div>
            )}
          </KanbanColumn>
          <KanbanColumn title="Cenová nabídka" count={1} tone="amber" style={{ minWidth: 220 }}>
            <BidCardUi
              company={DEMO_BIDS[4].company}
              person={DEMO_BIDS[4].person}
              email={DEMO_BIDS[4].email}
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
      <AppFrame activeTab="rounds" toolbar={<DetailToolbar category={DEMO_PROJECT.category} />}>
        <RoundChips active={activeRound} />
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <BidCardUi
            company={winner.company}
            person={winner.person}
            email={winner.email}
            phone={winner.phone}
            rounds={winner.rounds}
            selectedRound={activeRound}
            style={{ ...fadeUp(frame, fps, 6) }}
          />
          <BidCardUi
            company={DEMO_BIDS[0].company}
            person={DEMO_BIDS[0].person}
            email={DEMO_BIDS[0].email}
            rounds={DEMO_BIDS[0].rounds}
            selectedRound={DEMO_BIDS[0].selectedRound}
            style={{ opacity: enter(frame, fps, 12) }}
          />
          <BidCardUi
            company={DEMO_BIDS[2].company}
            person={DEMO_BIDS[2].person}
            email={DEMO_BIDS[2].email}
            rounds={DEMO_BIDS[2].rounds}
            selectedRound={DEMO_BIDS[2].selectedRound}
            compact
            style={{ opacity: enter(frame, fps, 16) }}
          />
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
      <AppFrame activeTab="award" toolbar={<DetailToolbar category={DEMO_PROJECT.category} />}>
        <div style={{ display: "flex", gap: 10, height: "100%", overflow: "hidden" }}>
          <KanbanColumn title="Užší výběr" count={1} tone="blue">
            <BidCardUi
              company={DEMO_BIDS[2].company}
              person={DEMO_BIDS[2].person}
              email={DEMO_BIDS[2].email}
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
              price={winner.rounds[2].price}
              winner
              compact
              style={{ opacity: enter(frame, fps, 12) }}
            />
            <div
              style={{
                marginTop: 2,
                padding: "8px 10px",
                borderRadius: 10,
                background: "rgba(144, 204, 165, 0.12)",
                border: "1px solid rgba(144, 204, 165, 0.28)",
                opacity: enter(frame, fps, 18),
              }}
            >
              <div style={{ fontSize: 12, color: brand.muted, fontWeight: 600 }}>Vítězná částka</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: brand.green, marginTop: 2 }}>{winner.rounds[2].price}</div>
            </div>
          </KanbanColumn>
          <KanbanColumn title="Zamítnuto" count={1} tone="red" style={{ minWidth: 210 }}>
            <BidCardUi
              company={DEMO_BIDS[4].company}
              person={DEMO_BIDS[4].person}
              email={DEMO_BIDS[4].email}
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
  const billed = Math.round(interpolate(enter(frame, fps, 8), [0, 1], [8, DEMO_CONTRACTS[0].billed]));

  return (
    <ReelChrome sceneIndex={4}>
      <SceneHeading kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />
      <AppFrame activeTab="contract">
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {DEMO_CONTRACTS.map((contract, index) => (
            <ContractRow
              key={contract.number}
              title={contract.title}
              vendor={contract.vendor}
              number={contract.number}
              status={contract.status}
              amount={contract.amount}
              billed={contract.active ? billed : contract.billed}
              active={contract.active}
              style={{
                flex: index === 0 ? 1.15 : 1,
                ...fadeUp(frame, fps, 4 + index * 5),
              }}
            />
          ))}
        </div>
      </AppFrame>
      <div style={{ paddingTop: 16, textAlign: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <LogoMark size={72} />
        </div>
        <div style={{ fontSize: 18, color: brand.text2, marginBottom: 12 }}>{TAGLINE}</div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 480,
            padding: "18px 36px",
            borderRadius: 14,
            background: `linear-gradient(135deg, ${brand.accentHi}, ${brand.accentMid})`,
            color: brand.inkOnAccent,
            fontSize: 30,
            fontWeight: 800,
            transform: `scale(${pulse})`,
          }}
        >
          {CTA.primary}
        </div>
        <div style={{ marginTop: 10, fontSize: 24, color: brand.apricotSoft }}>{CTA.url}</div>
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
