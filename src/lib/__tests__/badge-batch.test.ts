import { describe, it, expect } from "vitest";
import { badgeFileName, parseBadgeIds, MAX_BADGES_PER_BATCH } from "../badge-batch";

const base = {
  id: "1261001471042",
  snapshotFirstName: "Awa",
  snapshotLastName: "Diallo",
  category: { anonymous: false },
};

describe("badgeFileName", () => {
  it("compose identifiant, prenom et nom", () => {
    expect(badgeFileName(base)).toBe("1261001471042-awa-diallo.pdf");
  });

  it("translittere les accents et remplace les caracteres speciaux par des tirets", () => {
    expect(
      badgeFileName({ ...base, snapshotFirstName: "Éloïse  Marie", snapshotLastName: "N'Guessan" }),
    ).toBe("1261001471042-eloise-marie-n-guessan.pdf");
  });

  it("omet un prenom ou un nom sans caractere latin", () => {
    expect(badgeFileName({ ...base, snapshotFirstName: "李", snapshotLastName: "Diallo" })).toBe(
      "1261001471042-diallo.pdf",
    );
    expect(badgeFileName({ ...base, snapshotFirstName: "李", snapshotLastName: "🙂" })).toBe(
      "1261001471042.pdf",
    );
  });

  it("categorie anonyme : identifiant seul", () => {
    expect(badgeFileName({ ...base, category: { anonymous: true } })).toBe("1261001471042.pdf");
  });

  it("neutralise les caracteres de l'identifiant hors [A-Za-z0-9-]", () => {
    expect(badgeFileName({ ...base, id: "a b/c" })).toBe("a-b-c-awa-diallo.pdf");
  });
});

describe("parseBadgeIds", () => {
  it("renvoie une liste vide pour un parametre absent ou vide", () => {
    expect(parseBadgeIds(null)).toEqual([]);
    expect(parseBadgeIds(" , ,")).toEqual([]);
  });

  it("nettoie, dedoublonne et conserve l'ordre d'apparition", () => {
    expect(parseBadgeIds(" b, a,,b ,c")).toEqual(["b", "a", "c"]);
  });

  it("limite de lot a 200", () => {
    expect(MAX_BADGES_PER_BATCH).toBe(200);
  });
});
