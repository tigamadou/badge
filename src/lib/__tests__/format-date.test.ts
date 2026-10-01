import { describe, it, expect } from "vitest";
import { formatEventDate, formatEventPeriod, isoDay } from "@/lib/format-date";

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

describe("formatEventPeriod", () => {
  it("renvoie la date seule quand il n'y a pas de date de fin", () => {
    expect(formatEventPeriod(new Date(2026, 11, 15), null)).toBe("15 Décembre . 2026");
  });

  it("renvoie la date seule quand la date de fin est le meme jour", () => {
    expect(formatEventPeriod(new Date(2026, 11, 15), new Date(2026, 11, 15))).toBe(
      "15 Décembre . 2026",
    );
  });

  it("renvoie une plage quand la date de fin est posterieure", () => {
    expect(formatEventPeriod(new Date(2026, 11, 15), new Date(2026, 11, 17))).toBe(
      "Du 15 Décembre . 2026 au 17 Décembre . 2026",
    );
  });
});

describe("isoDay", () => {
  it("renvoie une chaine vide pour null", () => {
    expect(isoDay(null)).toBe("");
  });

  it("formate un Date en YYYY-MM-DD (UTC)", () => {
    expect(isoDay(new Date("2026-03-14T10:30:00Z"))).toBe("2026-03-14");
  });

  it("accepte une chaine ISO", () => {
    expect(isoDay("2026-12-31T23:00:00Z")).toBe("2026-12-31");
  });
});
