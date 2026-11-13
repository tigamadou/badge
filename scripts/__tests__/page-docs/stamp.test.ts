import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkDocs } from "../../page-docs/check";
import { parseDoc } from "../../page-docs/format";
import { resolveSelectors, stampDocs } from "../../page-docs/stamp";
import { BODY, DOC, docText, PAGE, repoWithStampedDoc, TODAY } from "./fixture";
import { makeRepo, removeRepo, writeFile } from "./helpers";

let root = "";
afterEach(() => removeRepo(root));

const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const snapshot = () => ["src/content/page-docs/manifest.generated.ts", "src/content/page-docs/index.generated.ts", DOC].map(read).join("\n=====\n");

describe("stampDocs", () => {
  it("recalcule sources, sourceHash et updatedAt sans toucher au corps", () => {
    root = repoWithStampedDoc();
    const fm = parseDoc(read(DOC));
    expect(fm.frontmatter.sources).toEqual(["src/app/org/[orgId]/events/new/page.tsx", "src/components/EventForm.tsx"]);
    expect(fm.frontmatter.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(fm.frontmatter.updatedAt).toBe(TODAY);
    expect(fm.body).toBe(BODY);
    expect(checkDocs(root)).toEqual([]);
  });

  it("deux exécutions consécutives ne produisent aucun diff, même un autre jour", () => {
    root = repoWithStampedDoc();
    const before = snapshot();
    stampDocs(root, ["org/events/new", "org/index"], TODAY);
    expect(snapshot()).toBe(before);
    stampDocs(root, ["org/events/new", "org/index"], "2027-01-01");
    expect(snapshot()).toBe(before);
  });

  it("met updatedAt à jour quand les sources ou le corps changent", () => {
    root = repoWithStampedDoc();
    writeFile(root, "src/components/EventForm.tsx", "export default 2;");
    stampDocs(root, ["org/events/new"], "2027-02-02");
    expect(parseDoc(read(DOC)).frontmatter.updatedAt).toBe("2027-02-02");
    writeFile(root, DOC, read(DOC) + "\nPrécision ajoutée.\n");
    stampDocs(root, ["org/events/new"], "2027-03-03");
    expect(parseDoc(read(DOC)).frontmatter.updatedAt).toBe("2027-03-03");
    expect(checkDocs(root)).toEqual([]);
  });

  it("tamponne une doc neuve (sans sources) et conserve access", () => {
    root = makeRepo({ [PAGE]: "", [DOC]: docText("access: org.events.create\n").replace("access: org.events.create\n---", "---") });
    writeFile(root, DOC, docText().replace("audience: organisateur\n", "audience: organisateur\naccess: org.events.create\n"));
    expect(stampDocs(root, ["org/events/new"], TODAY)).toEqual(["org/events/new"]);
    const fm = parseDoc(read(DOC)).frontmatter;
    expect(fm.access).toBe("org.events.create");
    expect(fm.updatedAt).toBe(TODAY);
    expect(checkDocs(root)).toEqual([]);
  });

  it("erreur explicite pour une doc sans page", () => {
    root = repoWithStampedDoc();
    expect(() => stampDocs(root, ["org/absente"], TODAY)).toThrow("Aucune page ne correspond à la doc « org/absente »");
  });
});

describe("resolveSelectors", () => {
  it("accepte id, route, espace et all ; refuse l'inconnu", () => {
    root = repoWithStampedDoc();
    expect(resolveSelectors(root, ["org/events/new"])).toEqual(["org/events/new"]);
    expect(resolveSelectors(root, ["/org/[orgId]"])).toEqual(["org/index"]);
    expect(resolveSelectors(root, ["org"])).toEqual(["org/events/new", "org/index"]);
    expect(resolveSelectors(root, ["all", "org"])).toEqual(["org/events/new", "org/index"]);
    expect(resolveSelectors(root, ["platform"])).toEqual([]);
    expect(() => resolveSelectors(root, ["/org/[orgId]/nope"])).toThrow("aucune page pour la route");
    expect(() => resolveSelectors(root, ["org/nope"])).toThrow("Sélecteur inconnu");
  });
});
