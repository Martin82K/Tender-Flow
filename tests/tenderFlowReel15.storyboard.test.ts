import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CTA, DEMO_BIDS, DEMO_CATEGORIES, DEMO_CONTRACTS, DEMO_OVERVIEW, DEMO_TABLE, FORBIDDEN_COPY_FRAGMENTS, SCENES, TAGLINE } from "../ads/instagram-reel/src/copy";
import {
  COMPOSITION_ID,
  REEL_DURATION_FRAMES,
  REEL_DURATION_SECONDS,
  REEL_FPS,
  REEL_HEIGHT,
  REEL_WIDTH,
  SCENE_FRAMES,
} from "../ads/instagram-reel/src/storyboard";

const reelRoot = join(process.cwd(), "ads/instagram-reel");

const collectCopy = (): string => {
  return JSON.stringify({ CTA, TAGLINE, SCENES, DEMO_BIDS, DEMO_CATEGORIES, DEMO_CONTRACTS, DEMO_OVERVIEW, DEMO_TABLE }).toLocaleLowerCase("cs-CZ");
};

describe("TenderFlowReel15 storyboard", () => {
  it("locks a 15s 9:16 Instagram Reel composition", () => {
    expect(COMPOSITION_ID).toBe("TenderFlowReel15");
    expect(REEL_WIDTH).toBe(1080);
    expect(REEL_HEIGHT).toBe(1920);
    expect(REEL_FPS).toBe(30);
    expect(REEL_DURATION_SECONDS).toBe(15);
    expect(REEL_DURATION_FRAMES).toBe(450);
    expect(SCENE_FRAMES).toHaveLength(5);
    expect(SCENE_FRAMES[0]?.from).toBe(0);
    expect(SCENE_FRAMES.at(-1)?.from).toBe(345);
    expect(SCENE_FRAMES.reduce((sum, scene) => sum + scene.durationInFrames, 0)).toBe(450);
  });

  it("keeps the brief story spine and marketing Czech CTA", () => {
    expect(SCENES.map((scene) => [scene.startSeconds, scene.endSeconds, scene.title])).toEqual([
      [0, 2.5, "Příprava a VŘ"],
      [2.5, 5, "Oslovení uchazečů"],
      [5, 8.5, "Kola nabídek"],
      [8.5, 11.5, "Výběr nabídky"],
      [11.5, 15, "Smlouva"],
    ]);
    expect(SCENES[0]?.subtitle).toContain("Tendry");
    expect(SCENES[0]?.subtitle).toContain("Nabídky");
    expect(SCENES[0]?.subtitle).toContain("Smlouva");
    expect(TAGLINE).toBe("Jedna cesta v jednom nástroji.");
    expect(CTA.primary).toBe("Domluvit ukázku");
    expect(CTA.url).toBe("tenderflow.cz");
    expect(CTA.href).toBe("https://www.tenderflow.cz");
    expect(CTA.href).not.toContain("tenderflow.de");
    expect(CTA.href).not.toContain("app.");
  });

  it("does not promise soupisy, kalkulaci or competitor replacement", () => {
    const copy = collectCopy();
    for (const fragment of FORBIDDEN_COPY_FRAGMENTS) {
      expect(copy).not.toContain(fragment);
    }
  });

  it("registers the composition and documents render commands", () => {
    const rootSource = readFileSync(join(reelRoot, "src/Root.tsx"), "utf8");
    const chrome = readFileSync(join(reelRoot, "src/chrome.tsx"), "utf8");
    const readme = readFileSync(join(reelRoot, "README.md"), "utf8");
    expect(rootSource).toContain("id={COMPOSITION_ID}");
    expect(rootSource).toContain("component={TenderFlowReel15}");
    expect(chrome).toContain('staticFile("tf-app-icon.png")');
    expect(chrome).not.toMatch(/>\s*TF\s*</);
    expect(readme).toContain("npx remotion studio src/index.ts");
    expect(readme).toContain("npx remotion render src/index.ts TenderFlowReel15");
    expect(readme).toContain("1080x1920");
  });
});
