import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Garde-fou de la palette « Deep Navy & Soft Gold » : aucune couleur de l'ancienne palette
// (vert, émeraude, ambre, bleu, indigo, turquoise Tailwind) ni ancienne variable dans src/.

const SRC = path.join(process.cwd(), "src");

const PATTERNS: RegExp[] = [
  /\b(?:[a-z-]+:)*(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow|accent|decoration|placeholder)-(?:green|emerald|amber|blue|sky|indigo|teal)-\d{2,3}\b/,
  /#004d74/i,
  /#4f46e5/i,
  /#16a34a/i,
  /--brand-navy/,
  /--brand-green/,
  /--accent/,
  /--color-brand-navy/,
  /brand-navy/,
];

// Préfixes exemptés, une raison par chemin.
const ALLOWED_PATHS: string[] = [
  // Gabarits de badge : couleurs de données propres aux templates
  "src/lib/badge-templates/",
  // Aperçu de planche d'impression : couleurs de données, hors périmètre de la palette
  "src/components/staff/print/SheetPreview.tsx",
  // Légende de l'éditeur de mise en page : miroir exact de SheetPreview (mêmes couleurs de données)
  "src/components/staff/print/LayoutEditor.tsx",
  // Styleguide : couleur de catégorie d'exemple (donnée saisie par l'utilisateur, non migrée)
  "src/app/styleguide/page.tsx",
];

export function findViolations(text: string): string[] {
  const hits: string[] = [];
  text.split("\n").forEach((line, i) => {
    for (const p of PATTERNS) {
      if (p.test(line)) hits.push(`${i + 1}: ${p.source}`);
    }
  });
  return hits;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

describe("palette-guard", () => {
  it("détecte une classe de l'ancienne palette", () => {
    expect(findViolations("bg-green-600")).toHaveLength(1);
    expect(findViolations("hover:text-amber-700")).toHaveLength(1);
  });

  it("ignore les classes de la nouvelle palette et les faux positifs", () => {
    expect(findViolations("bg-navy text-turquoise-strong")).toEqual([]);
    expect(findViolations("bg-greenhouse")).toEqual([]);
  });

  it("aucune couleur de l'ancienne palette dans src/", () => {
    const violations: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(process.cwd(), file);
      if (rel.includes("__tests__/")) continue;
      if (ALLOWED_PATHS.some((p) => rel.startsWith(p))) continue;
      for (const v of findViolations(readFileSync(file, "utf8"))) {
        violations.push(`${rel}:${v}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
