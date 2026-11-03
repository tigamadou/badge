import { describe, it, expect } from "vitest";
import {
  badgeFileName,
  parseBadgeIds,
  mapWithConcurrency,
  BATCH_RENDER_CONCURRENCY,
  chunk,
  MARK_PRINTED_CHUNK,
} from "../badge-batch";

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

  it("marquage par paquets de 500", () => {
    expect(MARK_PRINTED_CHUNK).toBe(500);
  });
});

describe("chunk", () => {
  it("decoupe en paquets consecutifs, ordre conserve", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([1, 2], 2)).toEqual([[1, 2]]);
    expect(chunk([], 2)).toEqual([]);
  });

  it("1200 elements en 3 paquets de 500, 500, 200", () => {
    const sizes = chunk(Array.from({ length: 1200 }, (_, i) => i), MARK_PRINTED_CHUNK).map((c) => c.length);
    expect(sizes).toEqual([500, 500, 200]);
  });
});

describe("mapWithConcurrency", () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("conserve l'ordre d'entree meme avec des delais inverses", async () => {
    const out = await mapWithConcurrency([30, 20, 10, 0], 2, async (ms) => {
      await wait(ms);
      return ms;
    });
    expect(out).toEqual([30, 20, 10, 0]);
  });

  it("ne depasse jamais la limite d'appels simultanes", async () => {
    let active = 0;
    let max = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1;
      max = Math.max(max, active);
      await wait(5);
      active -= 1;
    });
    expect(max).toBe(2);
  });

  it("rejette avec la premiere erreur, sans lancer de nouvel appel apres elle", async () => {
    const started: number[] = [];
    await expect(
      mapWithConcurrency([1, 2, 3, 4, 5], 1, async (n) => {
        started.push(n);
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
    expect(started).toEqual([1, 2]);
  });

  it("accepte une liste vide", async () => {
    expect(await mapWithConcurrency([], BATCH_RENDER_CONCURRENCY, async (n) => n)).toEqual([]);
  });
});
