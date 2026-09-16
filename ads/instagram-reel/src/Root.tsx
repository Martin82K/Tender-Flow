import React from "react";
import { Composition } from "remotion";
import { TenderFlowReel15 } from "./TenderFlowReel15";
import {
  COMPOSITION_ID,
  REEL_DURATION_FRAMES,
  REEL_FPS,
  REEL_HEIGHT,
  REEL_WIDTH,
} from "./storyboard";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMPOSITION_ID}
        component={TenderFlowReel15}
        durationInFrames={REEL_DURATION_FRAMES}
        fps={REEL_FPS}
        width={REEL_WIDTH}
        height={REEL_HEIGHT}
      />
    </>
  );
};
