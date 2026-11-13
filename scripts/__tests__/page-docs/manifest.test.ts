import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildManifests, writeManifests } from "../../page-docs/manifest";
import { DOC, repoWithStampedDoc, TODAY } from "./fixture";
import { makeRepo, removeRepo, writeFile } from "./helpers";

let root = "";
afterEach(() => removeRepo(root));

describe("buildManifests", () => {
  it("génère un manifeste complet et un index sans corps, triés par id", () => {
    root = repoWithStampedDoc();
    const { manifest, index } = buildManifests(root);
    const header = "// Généré par scripts/page-docs — ne pas modifier à la main (make docs-stamp).\n";
    expect(manifest.startsWith(header)).toBe(true);
    expect(index.startsWith(header)).toBe(true);
    expect(manifest).toContain('export const PAGE_DOCS: PageDocEntry[] = [');
    expect(index).toContain('export const PAGE_DOC_INDEX: PageDocIndexEntry[] = [');
    expect(manifest.indexOf('"id": "org/events/new"')).toBeLessThan(manifest.indexOf('"id": "org/index"'));
    expect(manifest).toContain('"body": "## À quoi sert cet écran');
    expect(index).not.toContain('"body"');
    expect(index).toContain('"updatedAt": "' + TODAY + '"');
    expect(manifest).not.toContain("\r");
    expect(manifest.endsWith(";\n")).toBe(true);
  });

  it("manifestes vides sans doc ; ignore orphelines, en-têtes inutilisables et pages absentes", () => {
    root = makeRepo({
      "src/app/org/[orgId]/page.tsx": "",
      "src/content/page-docs/org/orpheline.md": "---\ntitle: T\naudience: staff\nupdatedAt: 2026-01-01\n---\nX",
      "src/content/page-docs/org/index.md": "pas d'en-tête",
    });
    const { manifest, index } = buildManifests(root);
    expect(manifest).toContain("PAGE_DOCS: PageDocEntry[] = [];");
    expect(index).toContain("PAGE_DOC_INDEX: PageDocIndexEntry[] = [];");
  });

  it("inclut la clé access et écrit les fichiers de façon déterministe", () => {
    root = repoWithStampedDoc();
    writeFile(root, DOC, fs.readFileSync(path.join(root, DOC), "utf8").replace("audience: organisateur\n", "audience: organisateur\naccess: org.events.create\n"));
    writeManifests(root);
    const file = path.join(root, "src/content/page-docs/manifest.generated.ts");
    const first = fs.readFileSync(file, "utf8");
    expect(first).toContain('"access": "org.events.create"');
    writeManifests(root);
    expect(fs.readFileSync(file, "utf8")).toBe(first);
  });
});
