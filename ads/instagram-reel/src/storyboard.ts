import { SCENES } from "./copy";

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_FPS = 30;
export const REEL_DURATION_SECONDS = 15;
export const REEL_DURATION_FRAMES = REEL_FPS * REEL_DURATION_SECONDS;
export const COMPOSITION_ID = "TenderFlowReel15";

export const toFrame = (seconds: number): number => Math.round(seconds * REEL_FPS);

export const SCENE_FRAMES = SCENES.map((scene, index) => {
  const from = toFrame(scene.startSeconds);
  const end = toFrame(scene.endSeconds);
  const nextStart = SCENES[index + 1] ? toFrame(SCENES[index + 1].startSeconds) : REEL_DURATION_FRAMES;
  return {
    id: scene.id,
    from,
    durationInFrames: Math.max(1, nextStart - from),
    endFrame: end,
  };
});
