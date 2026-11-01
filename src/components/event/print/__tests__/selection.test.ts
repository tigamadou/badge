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
