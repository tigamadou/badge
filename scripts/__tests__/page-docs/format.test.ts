import { describe, expect, it } from "vitest";
import { blockKeys, parseDoc, serializeDoc, validateBlocks, type DocFrontmatter } from "../../page-docs/format";

const EXEMPLE = `---
route: /org/[orgId]/events/new
title: Créer un évènement
audience: organisateur
sources:
  - src/app/org/[orgId]/events/new/page.tsx
  - src/components/admin/EventForm.tsx
sourceHash: sha256:abc123
updatedAt: 2026-11-20
---

## À quoi sert cet écran

Texte.
`;

const FM: DocFrontmatter = {
  route: "/org/[orgId]/events/new",
  title: "Créer un évènement",
  audience: "organisateur",
  sources: ["src/app/org/[orgId]/events/new/page.tsx", "src/components/admin/EventForm.tsx"],
  sourceHash: "sha256:abc123",
  updatedAt: "2026-11-20",
};

describe("parseDoc / serializeDoc", () => {
  it("aller-retour exact sur l'exemple de la spec", () => {
    const parsed = parseDoc(EXEMPLE);
    expect(parsed.frontmatter).toEqual(FM);
    expect(parsed.body).toBe("## À quoi sert cet écran\n\nTexte.\n");
    expect(parsed.bodyStartLine).toBe(12);
    expect(serializeDoc(FM, parsed.body)).toBe(EXEMPLE);
  });

  it("gère access, les valeurs entre guillemets, les commentaires et les fins de ligne CRLF", () => {
    const raw = [
      "---",
      "route: /platform",
      'title: "Plateforme : accueil"',
      "audience: staff        # staff uniquement",
      "access: platform.access",
      "sources: []",
      "sourceHash: sha256:x",
      "updatedAt: 2026-01-02",
      "---",
      "Corps",
    ].join("\r\n");
    const parsed = parseDoc(raw);
    expect(parsed.frontmatter).toEqual({
      route: "/platform",
      title: "Plateforme : accueil",
      audience: "staff",
      access: "platform.access",
      sources: [],
      sourceHash: "sha256:x",
      updatedAt: "2026-01-02",
    });
    expect(parsed.body).toBe("Corps");
    expect(parsed.bodyStartLine).toBe(10);
    const out = serializeDoc(parsed.frontmatter as DocFrontmatter, "Corps");
    expect(out).toContain('title: "Plateforme : accueil"');
    expect(out).toContain("access: platform.access\nsources: []\n");
    expect(parseDoc(out).frontmatter).toEqual(parsed.frontmatter);
  });

  it("lit les guillemets simples et une source unique en scalaire", () => {
    const parsed = parseDoc("---\ntitle: 'L''aide'\nsources: a.ts\n---\n\nX\n");
    expect(parsed.frontmatter).toEqual({ title: "L'aide", sources: ["a.ts"] });
  });

  it("frontmatter absent ou invalide : frontmatter vide, sans exception", () => {
    expect(parseDoc("Pas d'en-tête\n")).toEqual({ frontmatter: {}, body: "Pas d'en-tête\n", bodyStartLine: 1 });
    expect(parseDoc("---\nroute /sans/deux/points\n---\nX").frontmatter).toEqual({});
    expect(parseDoc("---\n  - orphelin\n---\nX").frontmatter).toEqual({});
    expect(parseDoc('---\ntitle: "non fermé\n---\nX').frontmatter).toEqual({});
    expect(parseDoc("---\ntitle: 'non fermé\n---\nX").frontmatter).toEqual({});
    expect(parseDoc('---\nsources:\n  - "non fermé\n---\nX').frontmatter).toEqual({});
    expect(parseDoc("---\ntitle: 12\n---\nX").frontmatter).toEqual({ title: "12" });
    expect(parseDoc('---\ntitle: "[1]"\n---\nX').frontmatter).toEqual({ title: "[1]" });
    expect(parseDoc('---\ntitle: "x"\n---').body).toBe("");
    expect(parseDoc("---\n---\nX").frontmatter).toEqual({});
    expect(parseDoc("---\ntitle: ouvert\nPas fermé").frontmatter).toEqual({});
  });

  it("une valeur vide pour un champ scalaire est lue comme chaîne vide, les clés inconnues sont ignorées", () => {
    const parsed = parseDoc("---\n# commentaire\n\naccess:\nautre: x\ntitle: T\n---\n");
    expect(parsed.frontmatter).toEqual({ access: "", title: "T" });
  });
});

describe("validateBlocks", () => {
  const known = new Set(["org.update", "org.members.manage"]);

  it("accepte un bloc valide", () => {
    expect(validateBlocks("a\n:::permission org.update\nTexte\n:::\nb", known)).toEqual([]);
    expect(blockKeys("a\n:::permission org.update\nx\n:::\n:::permission \n:::")).toEqual([{ key: "org.update", line: 2 }]);
  });

  it("signale un bloc non fermé à la ligne d'ouverture", () => {
    const issues = validateBlocks("x\n:::permission org.update\ny", known);
    expect(issues).toEqual([{ line: 2, message: "bloc non fermé (« ::: » manquant)" }]);
  });

  it("signale un « ::: » orphelin", () => {
    expect(validateBlocks("x\n:::", known)).toEqual([{ line: 2, message: "« ::: » sans bloc ouvert" }]);
  });

  it("signale un bloc imbriqué", () => {
    const issues = validateBlocks(":::permission org.update\n:::permission org.members.manage\n:::\n:::", known);
    expect(issues.map((i) => i.message)).toEqual([
      "bloc imbriqué : fermez le bloc précédent avec « ::: »",
      "« ::: » sans bloc ouvert",
    ]);
    expect(issues[0].line).toBe(2);
  });

  it("signale une clé inconnue, une clé vide et un bloc inconnu", () => {
    const issues = validateBlocks(":::permission nope.x\n:::\n:::permission\n:::\n:::note\n", known);
    expect(issues.map((i) => i.message)).toEqual([
      "clé de permission inconnue « nope.x »",
      "clé de permission vide",
      "bloc inconnu « :::note » (seul « :::permission <clé> » existe)",
    ]);
  });
});
