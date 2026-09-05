import fs from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = fs.readFileSync("features/public/ui/landing-apex.css", "utf8");
const publicTokens = stylesheet.match(/:is\(\.landing-apex,[^{]+\)\s*\{([^}]+)\}/)?.[1] ?? "";
const token = (name: string) => {
  const value = publicTokens.match(new RegExp(`--${name}:\\s*(#[a-fA-F0-9]{6})\\s*;`))?.[1];
  if (!value) throw new Error(`Missing public color token: ${name}`);
  return value;
};
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
};

describe("shared public and auth ivory palette readability", () => {
  it("keeps normal and secondary text readable on every public surface", () => {
    for (const background of ["bg", "bg-elevated", "bg-card", "bg-card-hover"]) {
      expect(luminance(token(background))).toBeGreaterThan(0.8);
      for (const foreground of ["white", "gray-1", "gray-2", "orange", "green"]) {
        expect(contrast(token(foreground), token(background)), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps buttons and selected process steps readable, including hover", () => {
    for (const background of ["cta", "cta-hover"]) {
      expect(contrast(token("on-cta"), token(background))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps small risk tags and testimonial initials readable", () => {
    for (const name of ["tag-blue", "avatar"]) {
      expect(contrast(token(`${name}-fg`), token(`${name}-bg`))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
