import { describe, it, expect } from "vitest";
import {
  buildSelection,
  filterCandidates,
  initialSelectionState,
  selectedCandidates,
  type Candidate,
  type SelectionState,
} from "../selection";

const cand = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  id,
  firstName: "Aïcha",
  lastName: id,
  categoryId: "c1",
  categoryName: "VIP",
  categoryNumber: 1,
  printed: false,
  reservedBy: null,
  selected: false,
  ...over,
});
const base: SelectionState = { mode: "ALL_AVAILABLE", categoryIds: [], registrationIds: [] };

describe("sélection de badges", () => {
  const list = [cand("a"), cand("b", { categoryId: "c2" }), cand("r", { reservedBy: "IMP-2026-0001" })];

  it("exclut les badges réservés ailleurs", () => {
    expect(selectedCandidates(list, base).map((c) => c.id)).toEqual(["a", "b"]);
    expect(buildSelection(list, base)).toEqual({ mode: "ALL_AVAILABLE" });
  });

  it("filtre par catégorie", () => {
    const s = { ...base, mode: "CATEGORIES" as const, categoryIds: ["c2"] };
    expect(selectedCandidates(list, s).map((c) => c.id)).toEqual(["b"]);
    expect(buildSelection(list, s)).toEqual({ mode: "CATEGORIES", categoryIds: ["c2"] });
  });

  it("ignore un identifiant réservé en sélection manuelle", () => {
    const s = { ...base, mode: "IDS" as const, registrationIds: ["a", "r"] };
    expect(buildSelection(list, s)).toEqual({ mode: "IDS", registrationIds: ["a"] });
  });

  it("renvoie null quand rien n'est sélectionné", () => {
    expect(buildSelection(list, { ...base, mode: "IDS" })).toBeNull();
    expect(buildSelection([], base)).toBeNull();
  });

  it("ALL_AVAILABLE et CATEGORIES excluent les badges déjà imprimés, comme le serveur ; IDS les garde", () => {
    const withPrinted = [
      cand("a"),
      cand("p", { printed: true }),
      cand("q", { printed: true, categoryId: "c2" }),
      cand("b", { categoryId: "c2" }),
    ];
    expect(selectedCandidates(withPrinted, base).map((c) => c.id)).toEqual(["a", "b"]);
    const cats = { ...base, mode: "CATEGORIES" as const, categoryIds: ["c2"] };
    expect(selectedCandidates(withPrinted, cats).map((c) => c.id)).toEqual(["b"]);
    const ids = { ...base, mode: "IDS" as const, registrationIds: ["p", "a"] };
    expect(selectedCandidates(withPrinted, ids).map((c) => c.id)).toEqual(["a", "p"]);
    // Rien d'imprimable : aucune sélection à envoyer (le serveur répondrait EMPTY_SELECTION).
    expect(buildSelection([cand("p", { printed: true })], base)).toBeNull();
  });

  it("le décompte du client égale la sélection du serveur sur le même jeu de candidats", async () => {
    const { listCandidates, setBadges } = await import("@/lib/print-requests/content");
    const { seedPrintFixture, makeRequest } = await import("@/lib/__tests__/helpers/print-requests");
    const { prisma } = await import("@/lib/prisma");
    const fx = await seedPrintFixture();
    await prisma.registration.update({ where: { id: fx.approved[0].id }, data: { badgePrinted: true } });
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    const rows = await listCandidates(fx.event.id, r.id);
    const mine = selectedCandidates(rows, base).length;
    const { count } = await setBadges({ requestId: r.id, eventId: fx.event.id, userId: fx.owner.id, selection: { mode: "ALL_AVAILABLE" } });
    expect(mine).toBe(count);
    expect(count).toBe(fx.approved.length - 1);
    const category = fx.categories[0].id;
    const catState = { ...base, mode: "CATEGORIES" as const, categoryIds: [category] };
    const r2 = await makeRequest(fx, { status: "SUBMITTED" });
    await prisma.printRequestItem.deleteMany({ where: { requestId: r.id } });
    const rows2 = await listCandidates(fx.event.id, r2.id);
    const res2 = await setBadges({ requestId: r2.id, eventId: fx.event.id, userId: fx.owner.id, selection: { mode: "CATEGORIES", categoryIds: [category] } });
    expect(selectedCandidates(rows2, catState)).toHaveLength(res2.count);
  });

  it("recherche sans accents ni casse", () => {
    expect(filterCandidates(list, "aicha b").map((c) => c.id)).toEqual(["b"]);
    expect(filterCandidates(list, " ")).toHaveLength(3);
  });

  it("repart de la sélection existante, sinon de tous les disponibles", () => {
    expect(initialSelectionState(list).mode).toBe("ALL_AVAILABLE");
    const withSel = [cand("a", { selected: true }), cand("b")];
    expect(initialSelectionState(withSel)).toEqual({ mode: "IDS", categoryIds: [], registrationIds: ["a"] });
  });
});
