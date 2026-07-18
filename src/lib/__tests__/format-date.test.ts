import { describe, it, expect } from "vitest";
import { formatEventDate } from "@/lib/format-date";

describe("formatEventDate", () => {
  it("formats a Date object as `<day> <Month> . <year>`", () => {
    // 15 janvier 2026 (mois 0 => Janvier)
    expect(formatEventDate(new Date(2026, 0, 15))).toBe("15 Janvier . 2026");
  });

  it("accepts an ISO date string", () => {
    // Construit via composants locaux pour eviter les ecarts de fuseau.
    const d = new Date(2026, 11, 31);
    expect(formatEventDate(d.toISOString())).toBe(
      `${d.getDate()} Décembre . 2026`,
    );
  });

  it("maps each month index to its french label", () => {
    const labels = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
    ];
    labels.forEach((label, month) => {
      expect(formatEventDate(new Date(2026, month, 1))).toBe(`1 ${label} . 2026`);
    });
  });
});
