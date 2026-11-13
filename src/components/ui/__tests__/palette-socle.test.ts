import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Garde-fou local du socle « nouvelle palette » : les fichiers du socle ne portent plus
// aucune ancienne couleur de marque. Le garde-fou global arrive en vague 3.
const ROOT = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = join(dir, name);
    if (name === "__tests__") return [];
    if (statSync(join(ROOT, rel)).isDirectory()) return walk(rel);
    return /\.(ts|tsx|css)$/.test(name) ? [rel] : [];
  });
}

const FILES = [
  ...walk("src/components/ui"),
  ...walk("src/components/layout"),
  "src/components/staff/StaffShell.tsx",
  "src/components/platform/PlatformOrgShell.tsx",
  "src/components/admin/SidebarNav.tsx",
  "src/components/admin/OrgShell.tsx",
  "src/components/event/EventShell.tsx",
  "src/components/public/AccountNav.tsx",
  "src/app/styleguide/page.tsx",
];

const BANNED = [
  "green-",
  "emerald-",
  "amber-",
  "blue-",
  "sky-",
  "indigo-",
  "teal-",
  "brand-navy",
  "brand-green",
  "#004d74",
  "#4f46e5",
  "var(--accent",
  "var(--brand",
];

// Données colorées du styleguide (catégories, pastilles) : hors liste interdite, mais on les
// écarte explicitement pour que la règle reste lisible.
const DATA_COLOR_LINE = /color="#|color: "#|categoryColor="#/;

describe("palette-socle", () => {
  it("couvre bien des fichiers", () => {
    expect(FILES.length).toBeGreaterThan(40);
  });

  it.each(FILES)("%s ne contient aucune ancienne couleur", (file) => {
    const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
    const offenders = lines
      .filter((line) => !DATA_COLOR_LINE.test(line))
      .flatMap((line) => BANNED.filter((b) => line.includes(b)));
    expect(offenders).toEqual([]);
  });
});
