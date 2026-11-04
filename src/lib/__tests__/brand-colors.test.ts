import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND } from "@/lib/brand-colors";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#FFFFFF";

describe("BRAND", () => {
  it("expose des hexa en majuscules", () => {
    for (const value of Object.values(BRAND)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("reste identique aux couleurs @theme de globals.css", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    for (const [key, value] of Object.entries(BRAND)) {
      const name = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
      expect(match, `--color-${name} absent de globals.css`).not.toBeNull();
      expect(match![1].toUpperCase()).toBe(value.toUpperCase());
    }
  });

  describe("lisibilite (WCAG AA)", () => {
    const readable: Array<[string, string, string]> = [
      ["blanc/marine", WHITE, BRAND.navy],
      ["marine/turquoise", BRAND.navy, BRAND.turquoise],
      ["marine/or", BRAND.navy, BRAND.gold],
      ["turquoiseStrong/blanc", BRAND.turquoiseStrong, WHITE],
      ["goldStrong/blanc", BRAND.goldStrong, WHITE],
      ["goldStrong/goldSoft", BRAND.goldStrong, BRAND.goldSoft],
      ["warn/warnSoft", BRAND.warn, BRAND.warnSoft],
      ["navMuted/blanc", BRAND.navMuted, WHITE],
      ["turquoiseStrong/turquoiseSoft", BRAND.turquoiseStrong, BRAND.turquoiseSoft],
    ];
    it.each(readable)("%s >= 4,5", (_label, a, b) => {
      expect(contrast(a, b)).toBeGreaterThanOrEqual(4.5);
    });

    const forbidden: Array<[string, string, string]> = [
      ["blanc/turquoise", WHITE, BRAND.turquoise],
      ["or/blanc", BRAND.gold, WHITE],
    ];
    it.each(forbidden)("%s < 3 (couple interdit pour du texte)", (_label, a, b) => {
      expect(contrast(a, b)).toBeLessThan(3);
    });
  });
});
