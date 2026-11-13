import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG, PERMISSION_KEYS } from "../catalog";

const SRC = join(process.cwd(), "src");
// Fichiers qui DÉCLARENT les clés (catalogue, matrice des rôles système, libellés) : ils ne comptent pas comme vérification.
const DECLARATIONS = new Set(["lib/permissions/catalog.ts", "lib/permissions/system-roles.ts", "lib/permissions/labels.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "test" ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const sources = sourceFiles(SRC)
  .map((path) => ({ file: relative(SRC, path), text: readFileSync(path, "utf8") }))
  .filter(({ file }) => !DECLARATIONS.has(file));

// Formes de vérification : option `permission:` (chaîne ou liste), garde ou appel de résolution.
const CITATION =
  /(?:permission:\s*(\[[^\]]*\]|"[^"]+")|(?:requirePermission|requireParticipantPermission|hasPermission|withOrgAuth|withStaffAuth)\(\s*(?:[^,()"]+,\s*)?(\[[^\]]*\]|"[^"]+")|(?:permissions|perms|access|granted)\.has\(\s*("[^"]+"))/g;

function citedKeys(): Map<string, string> {
  const cited = new Map<string, string>();
  for (const { file, text } of sources) {
    for (const match of text.matchAll(CITATION)) {
      const operand = match[1] ?? match[2] ?? match[3] ?? "";
      for (const literal of operand.matchAll(/"([^"]+)"/g)) cited.set(literal[1], file);
    }
  }
  return cited;
}

// Clés non réservées volontairement absentes de toute vérification littérale (évaluées dynamiquement). Vide : à justifier si besoin.
const DYNAMIC_KEYS: readonly string[] = [];

describe("catalogue de permissions", () => {
  it("toute clé citée dans le code existe au catalogue", () => {
    const orphans = [...citedKeys()].filter(([key]) => /^[a-z_]+(\.[a-z_]+)+$/.test(key) && !PERMISSION_KEYS.has(key));
    expect(orphans).toEqual([]);
  });

  it("toute clé non reserved du catalogue est vérifiée quelque part", () => {
    const literal = (key: string) => sources.some(({ text }) => text.includes(`"${key}"`));
    const unused = PERMISSION_CATALOG.filter((p) => !("reserved" in p) && !DYNAMIC_KEYS.includes(p.key) && !literal(p.key)).map((p) => p.key);
    expect(unused).toEqual([]);
  });

  it("le test détecte bien des citations (garde-fou contre une regex devenue aveugle)", () => {
    expect(citedKeys().size).toBeGreaterThan(40);
  });
});
