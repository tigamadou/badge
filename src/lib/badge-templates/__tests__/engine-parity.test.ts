import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprint } from "../../../../scripts/sync-engine";

const ENGINE = resolve("src/lib/badge-templates/engine");

describe("parite du moteur", () => {
  it("aucun fichier du moteur n'a ete modifie hors sync-engine", () => {
    const recorded = readFileSync(resolve(ENGINE, "ENGINE.sha256"), "utf8").trim();
    // Un echec ici ne se corrige JAMAIS en regenerant l'empreinte : il veut dire
    // qu'on a edite la copie. Le correctif va dans pdfStudio, puis `make sync-engine`.
    expect(fingerprint(ENGINE)).toBe(recorded);
  });
});
