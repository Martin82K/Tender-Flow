import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "index.css"), "utf8");
const commandCenterCss = readFileSync(
  join(process.cwd(), "features/command-center/command-center.css"),
  "utf8",
);
const lightAssetPath = join(process.cwd(), "assets/themes/nature/forest-light.jpg");
const darkAssetPath = join(process.cwd(), "assets/themes/nature/forest-dark.jpg");

const luminance = (hex: string): number => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  if (!channels || channels.length !== 3) return 0;
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (foreground: string, background: string): number => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const readJpegDimensions = (path: string): { width: number; height: number } => {
  const image = readFileSync(path);
  let offset = 2;

  while (offset < image.length) {
    if (image[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = image[offset + 1];
    const segmentLength = image.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        width: image.readUInt16BE(offset + 7),
        height: image.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength + 2;
  }

  throw new Error(`JPEG dimensions not found: ${path}`);
};

describe("Nature skin", () => {
  it("definuje přístupnou světlou a tmavou lesní paletu", () => {
    expect(css).toContain('html[data-skin="nature"]');
    expect(css).toContain('html.dark[data-skin="nature"]');
    expect(contrastRatio("#13251b", "#edf3ef")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#13251b", "#fbfdfb")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#ffffff", "#166534")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#f2f7f3", "#06110c")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#f2f7f3", "#0e1c14")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#ffffff", "#1f7a46")).toBeGreaterThanOrEqual(4.5);
  });

  it("nepoužívá oranžovou značky jako Nature akcent", () => {
    const lightStart = css.indexOf('html[data-skin="nature"]');
    const darkStart = css.indexOf('html.dark[data-skin="nature"]', lightStart);
    const sharedStart = css.indexOf('html:is([data-skin="botanica"], [data-skin="nature"])', darkStart);
    const natureTokens = css.slice(lightStart, sharedStart);

    expect(natureTokens).not.toMatch(/#ff8a33|#f59e0b|#ff9f1a/i);
    expect(natureTokens).toContain("--tf-skin-accent: #166534");
    expect(natureTokens).toContain("--tf-skin-accent: #1f7a46");
    expect(natureTokens).toContain("--tf-skin-rose: #b4233e");
    expect(natureTokens).toContain("--tf-skin-rose: #ef6b7b");
  });

  it("obsahuje bezpečné lokální rastry bez vloženého textu či vzdálené URL", () => {
    const light = readFileSync(lightAssetPath);
    const dark = readFileSync(darkAssetPath);

    expect(light.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(dark.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(statSync(lightAssetPath).size).toBeGreaterThan(250_000);
    expect(statSync(darkAssetPath).size).toBeGreaterThan(200_000);
    expect(readJpegDimensions(lightAssetPath)).toEqual({ width: 1627, height: 967 });
    expect(readJpegDimensions(darkAssetPath)).toEqual({ width: 1627, height: 967 });
    expect(light.toString("latin1")).not.toMatch(/https?:\/\/|<script|<svg/i);
    expect(dark.toString("latin1")).not.toMatch(/https?:\/\/|<script|<svg/i);
  });

  it("sdílí data-safe shell a Command Center bez zásahu do ostatních skinů", () => {
    const sharedSkinSelector = 'html:is([data-skin="botanica"], [data-skin="nature"])';

    expect(css).toContain(`${sharedSkinSelector} .tf-app-main::before`);
    expect(css).toContain(`${sharedSkinSelector} .tf-sidebar::after`);
    expect(css).toContain(`${sharedSkinSelector} table`);
    expect(css).toContain("var(--tf-skin-data-opacity, 94%)");
    expect(css).toContain("(forced-colors: active), (prefers-contrast: more)");
    expect(commandCenterCss).toContain(`${sharedSkinSelector} .cc-root`);
    expect(commandCenterCss).toContain(`${sharedSkinSelector} .cc-panel`);
    expect(css).toContain('html[data-skin="botanica"]');
    expect(css).toContain('html[data-skin="industrial"]');
  });

});
