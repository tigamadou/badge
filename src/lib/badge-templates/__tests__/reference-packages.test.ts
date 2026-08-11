import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseManifest } from "../declarative/schema";
import { REFERENCE_DIR } from "../install";

// Les manifestes livres avec l'application sont installes par le seed. S'ils etaient
// invalides, l'application demarrerait sans aucun badge imprimable : ce test est le
// garde-fou qui l'empeche d'arriver en production.
const families = readdirSync(resolve(REFERENCE_DIR), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

describe("paquets de reference", () => {
  it("le depot en contient au moins un", () => {
    expect(families.length).toBeGreaterThan(0);
  });

  it("la famille `default` existe : c'est le repli de resolveTemplate", () => {
    expect(families).toContain("default");
  });

  for (const family of families) {
    it(`${family} : le manifeste est valide`, () => {
      const dir = resolve(REFERENCE_DIR, family);
      const raw = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
      const res = parseManifest(raw, []);
      expect(res.ok, res.ok === false ? res.errors.join(" | ") : "").toBe(true);
    });

    it(`${family} : le manifeste declare la famille du dossier`, () => {
      const dir = resolve(REFERENCE_DIR, family);
      const raw = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
      // ensureReferenceTemplates indexe par nom de dossier : une divergence
      // reinstallerait le paquet a chaque seed.
      expect(raw.family).toBe(family);
    });
  }
});
