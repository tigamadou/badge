import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkDocs } from "../../page-docs/check";
import { formatProblems, run } from "../../page-docs/cli";
import { writeManifests } from "../../page-docs/manifest";
import { DOC, docText, PAGE, repoWithStampedDoc, TODAY } from "./fixture";
import { makeRepo, removeRepo, writeFile } from "./helpers";

let root = "";
afterEach(() => removeRepo(root));

const kinds = (r: string) => checkDocs(r).map((p) => `${p.kind}:${p.target}`);
const editDoc = (fn: (text: string) => string) => {
  const file = path.join(root, DOC);
  writeFile(root, DOC, fn(fs.readFileSync(file, "utf8")));
  writeManifests(root);
};

describe("checkDocs", () => {
  it("doc à jour : aucun problème", () => {
    root = repoWithStampedDoc();
    expect(checkDocs(root)).toEqual([]);
  });

  it("source modifiée : obsolète", () => {
    root = repoWithStampedDoc();
    writeFile(root, "src/components/EventForm.tsx", "export default function EventForm() { return 1; }");
    expect(kinds(root)).toEqual(["obsolete:org/events/new"]);
  });

  it("source supprimée : obsolète, sans exception", () => {
    root = repoWithStampedDoc();
    fs.rmSync(path.join(root, "src/components/EventForm.tsx"));
    expect(kinds(root)).toEqual(["obsolete:org/events/new"]);
  });

  it("page sans doc : manquante", () => {
    root = repoWithStampedDoc();
    writeFile(root, "src/app/org/[orgId]/members/page.tsx", "");
    expect(kinds(root)).toEqual(["missing:org/members"]);
  });

  it("doc sans page : orpheline", () => {
    root = repoWithStampedDoc();
    writeFile(root, "src/content/page-docs/org/disparue.md", docText());
    expect(kinds(root)).toContain("orphan:org/disparue");
  });

  it("frontmatter incomplet, audience, date, route et access invalides : format", () => {
    root = repoWithStampedDoc();
    writeFile(root, DOC, "---\ntitle: T\naudience: inconnu\nupdatedAt: demain\nroute: /org/[orgId]/autre\naccess: platform.access\n---\nX");
    const messages = checkDocs(root).filter((p) => p.kind === "format").map((p) => p.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "champ « sourceHash » manquant",
        "champ « sources » manquant",
        "audience invalide « inconnu »",
        "updatedAt invalide « demain » (AAAA-MM-JJ attendu)",
        "route « /org/[orgId]/autre » différente de celle du fichier (/org/[orgId]/events/new)",
        "access : la clé « platform.access » est de portée PLATFORM, la page est de portée ORG",
      ]),
    );
  });

  it("access hors catalogue, bloc de portée différente ou de clé inconnue : format avec la ligne", () => {
    root = repoWithStampedDoc();
    editDoc((t) =>
      t
        .replace("audience: organisateur\n", "audience: organisateur\naccess: nope.nope\n")
        .replace(":::permission org.events.create", ":::permission event.read.detailed")
        .concat("\n:::permission inconnue.cle\nx\n:::\n:::permission org.update\nnon fermé\n"),
    );
    const messages = checkDocs(root).map((p) => p.message);
    expect(messages).toContain("access : clé de permission inconnue « nope.nope »");
    expect(messages.some((m) => m.startsWith("ligne ") && m.includes("« event.read.detailed » est de portée EVENT"))).toBe(true);
    expect(messages.some((m) => m.includes("clé de permission inconnue « inconnue.cle »"))).toBe(true);
    expect(messages.some((m) => m.includes("bloc non fermé"))).toBe(true);
    const ligne = messages.find((m) => m.includes("bloc non fermé"))!;
    const text = fs.readFileSync(path.join(root, DOC), "utf8").split("\n");
    const n = Number(/ligne (\d+)/.exec(ligne)![1]);
    expect(text[n - 1]).toBe(":::permission org.update");
  });

  it("une cible plateforme n'accepte que des clés PLATFORM, même sous /platform/organizations/[orgId]", () => {
    root = makeRepo({ "src/app/platform/organizations/[orgId]/page.tsx": "" });
    writeFile(
      root,
      "src/content/page-docs/platform/organizations/detail.md",
      "---\nroute: /platform/organizations/[orgId]\ntitle: T\naudience: staff\naccess: organizations.read\nsources: []\nsourceHash: x\nupdatedAt: 2026-01-01\n---\n:::permission org.update\nx\n:::\n",
    );
    const messages = checkDocs(root).map((p) => p.message);
    expect(messages.some((m) => m.includes("« org.update » est de portée ORG, la page est de portée PLATFORM"))).toBe(true);
    expect(messages.some((m) => m.startsWith("access"))).toBe(false);
  });

  it("manifeste absent ou différent : manifest", () => {
    root = repoWithStampedDoc();
    fs.rmSync(path.join(root, "src/content/page-docs/index.generated.ts"));
    writeFile(root, "src/content/page-docs/manifest.generated.ts", "// à la main");
    expect(kinds(root)).toEqual(["manifest:index.generated.ts", "manifest:manifest.generated.ts"]);
  });

  it("corps modifié sans tampon : manifeste différent", () => {
    root = repoWithStampedDoc();
    writeFile(root, DOC, fs.readFileSync(path.join(root, DOC), "utf8") + "\nUne ligne de plus.\n");
    expect(kinds(root)).toEqual(["manifest:manifest.generated.ts"]);
  });

  it("collision d'identifiant résiduelle : format", () => {
    root = makeRepo({
      "src/app/org/[orgId]/x/y/page.tsx": "",
      "src/app/org/[orgId]/x/[a]/y/page.tsx": "",
      "src/app/org/[orgId]/x/a/y/page.tsx": "",
    });
    const messages = checkDocs(root).filter((p) => p.kind === "format").map((p) => p.message);
    expect(messages.some((m) => m.startsWith("collision d'identifiant"))).toBe(true);
  });
});

describe("cli", () => {
  it("check : code 0 si tout est bon, 1 avec un rapport groupé sinon", () => {
    root = repoWithStampedDoc();
    const lines: string[] = [];
    expect(run(["check"], root, TODAY, (l) => lines.push(l))).toBe(0);
    writeFile(root, "src/app/org/[orgId]/members/page.tsx", "");
    writeFile(root, PAGE, "export default 1;");
    const out: string[] = [];
    expect(run(["check"], root, TODAY, (l) => out.push(l))).toBe(1);
    const text = out.join("\n");
    expect(text).toContain("Docs manquantes (page sans doc) : 1");
    expect(text).toContain("org/members");
    expect(text).toContain("make docs-stamp");
    expect(formatProblems([])).toBe("");
  });

  it("stamp : usage sans sélecteur, erreur explicite sur un sélecteur inconnu, succès sinon", () => {
    root = repoWithStampedDoc();
    const out: string[] = [];
    expect(run(["stamp"], root, TODAY, (l) => out.push(l))).toBe(1);
    expect(out[0]).toContain("Usage");
    expect(run(["stamp", "inconnu"], root, TODAY, (l) => out.push(l))).toBe(1);
    expect(out[1]).toContain("Sélecteur inconnu « inconnu »");
    expect(run(["stamp", "org"], root, TODAY, (l) => out.push(l))).toBe(0);
    expect(out[2]).toContain("2 doc(s) tamponnée(s)");
    expect(run(["autre"], root, TODAY, (l) => out.push(l))).toBe(1);
  });
});
