import { describe, expect, it } from "vitest";
import { filterPermissionBlocks } from "../blocks";

const BODY = "Avant\n\n:::permission org.update\n## Réservé\n\nTexte réservé.\n:::\n\nAprès\n";

describe("filterPermissionBlocks", () => {
  it("true : garde le contenu sans les marqueurs", () => {
    expect(filterPermissionBlocks(BODY, () => true)).toBe("Avant\n\n## Réservé\n\nTexte réservé.\n\nAprès\n");
  });

  it("false : retire le bloc entier, titre compris", () => {
    const out = filterPermissionBlocks(BODY, () => false);
    expect(out).toBe("Avant\n\n\nAprès\n");
    expect(out).not.toContain("Réservé");
  });

  it("undefined : garde le contenu avec la mention du libellé du catalogue", () => {
    const out = filterPermissionBlocks(BODY, () => undefined);
    expect(out).toContain("*Réservé aux utilisateurs disposant de la permission « Modifier l'organisation ».*");
    expect(out).toContain("Texte réservé.");
    expect(out).not.toContain(":::");
  });

  it("undefined avec une clé hors catalogue : la mention reprend la clé", () => {
    const out = filterPermissionBlocks(":::permission nope.cle\nX\n:::", () => undefined);
    expect(out).toContain("« nope.cle »");
  });

  it("passe la clé à decide et traite plusieurs blocs indépendamment", () => {
    const body = ":::permission a.b\nUN\n:::\n:::permission c.d\nDEUX\n:::";
    const out = filterPermissionBlocks(body, (k) => k === "c.d");
    expect(out).toBe("DEUX");
  });

  it("marqueur isolé, inconnu ou sans clé : retiré seul, texte conservé", () => {
    expect(filterPermissionBlocks("a\n:::\nb", () => false)).toBe("a\nb");
    expect(filterPermissionBlocks("a\n:::permission\nb\n:::\nc", () => false)).toBe("a\nb\nc");
    expect(filterPermissionBlocks("a\n:::note\nb", () => false)).toBe("a\nb");
  });

  it("bloc non fermé : échoue fermé, tout jusqu'à la fin est masqué", () => {
    for (const decision of [false, true, undefined]) {
      const out = filterPermissionBlocks("a\n:::permission org.update\nSECRET\nsuite", () => decision);
      expect(out).toBe("a");
      expect(out).not.toContain("SECRET");
    }
  });

  it("bloc imbriqué : échoue fermé, rien du bloc externe ni de l'interne ne fuit", () => {
    for (const decision of [false, true, undefined]) {
      const out = filterPermissionBlocks(":::permission x.y\nSECRET1\n:::permission org.update\nSECRET2\n:::\nSECRET3\n:::\nfin", () => decision);
      expect(out).not.toContain("SECRET");
    }
  });

  it("un bloc valide avant un bloc mal formé reste filtré normalement", () => {
    expect(filterPermissionBlocks(":::permission a.b\nUN\n:::\nmilieu\n:::permission c.d\nSECRET", () => true)).toBe("UN\nmilieu");
  });

  it("laisse un texte sans bloc intact", () => {
    expect(filterPermissionBlocks("Rien à filtrer\n", () => false)).toBe("Rien à filtrer\n");
  });
});
