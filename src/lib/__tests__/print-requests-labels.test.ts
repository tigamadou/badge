import { describe, expect, it } from "vitest";
import {
  PRINT_REQUEST_STATUS_LABELS,
  PRINT_REQUEST_TYPE_LABELS,
  RESERVING_STATUSES,
  chunk,
  formatFcfa,
} from "@/lib/print-requests/labels";

describe("print-requests labels", () => {
  it("libelle les 10 statuts", () => {
    expect(Object.keys(PRINT_REQUEST_STATUS_LABELS)).toHaveLength(10);
    expect(PRINT_REQUEST_STATUS_LABELS.QUOTED).toBe("Devis envoyé");
    expect(PRINT_REQUEST_STATUS_LABELS.CANCELLED).toBe("Annulée");
  });
  it("libelle les types", () => {
    expect(PRINT_REQUEST_TYPE_LABELS).toEqual({
      ADVANCE: "En amont",
      ONSITE: "Pendant l'évènement",
    });
  });
  it("RESERVING_STATUSES exclut brouillon, refusée et annulée", () => {
    expect(RESERVING_STATUSES).toHaveLength(7);
    for (const s of ["DRAFT", "REJECTED", "CANCELLED"] as const) {
      expect(RESERVING_STATUSES).not.toContain(s);
    }
  });
  it("formatFcfa(6000) === '6 000 FCFA' (espace fine insécable)", () => {
    expect(formatFcfa(6000)).toBe("6 000 FCFA");
  });
  it("chunk([1,2,3,4,5], 2) === [[1,2],[3,4],[5]]", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
