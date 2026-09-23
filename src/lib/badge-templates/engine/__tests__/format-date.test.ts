import { afterAll, describe, expect, it } from "vitest";
import { formatDate, formatFrenchDate } from "../format-date";

// Node applique process.env.TZ a chaud : ce bloc prouve que le formatage ne
// depend plus du fuseau du serveur. Sans le correctif, tout y decale d'un jour.
describe("independance au fuseau", () => {
  const original = process.env.TZ;
  afterAll(() => {
    process.env.TZ = original;
  });

  it("rend le meme jour calendaire a l'ouest de l'UTC", () => {
    process.env.TZ = "America/Los_Angeles";
    const d = new Date("2027-12-15T00:00:00.000Z");
    expect(formatDate(d, "long")).toBe("15 décembre 2027");
    expect(formatDate(d, "court")).toBe("15/12/2027");
    expect(formatDate(d, "moisAnnee")).toBe("décembre 2027");
    expect(formatDate(d, "annee")).toBe("2027");
    expect(formatDate(d, "iso")).toBe("2027-12-15");
  });

  it("rend le meme jour calendaire a l'est de l'UTC", () => {
    process.env.TZ = "Pacific/Kiritimati";
    const d = new Date("2027-12-15T00:00:00.000Z");
    expect(formatDate(d, "long")).toBe("15 décembre 2027");
    expect(formatDate(d, "iso")).toBe("2027-12-15");
  });
});

// Construite en litteral UTC (et non en heure locale) : formatDate lit desormais
// les composantes calendaires UTC, un `new Date(annee, mois, jour)` construit un
// instant local qui derive d'un jour hors du fuseau de la machine de reference.
const D = new Date("2027-12-15T00:00:00.000Z");

describe("formatDate", () => {
  it("rend le format long par defaut", () => {
    expect(formatDate(D)).toBe("15 décembre 2027");
  });

  it("rend les cinq formats", () => {
    expect(formatDate(D, "long")).toBe("15 décembre 2027");
    expect(formatDate(D, "court")).toBe("15/12/2027");
    expect(formatDate(D, "moisAnnee")).toBe("décembre 2027");
    expect(formatDate(D, "annee")).toBe("2027");
    expect(formatDate(D, "iso")).toBe("2027-12-15");
  });

  it("garde formatFrenchDate identique au format long", () => {
    expect(formatFrenchDate(D)).toBe(formatDate(D, "long"));
  });

  it("iso convient avec les autres formats sur la date UTC", () => {
    // Dates construites en litteral UTC pour tester l'invariant dans tout
    // fuseau horaire : tous les formats lisent desormais les composantes UTC,
    // ils convergent donc quelle que soit l'heure UTC de l'instant.
    const minuitUtc = new Date("2027-12-15T00:00:00.000Z");
    const finDeJourUtc = new Date("2027-12-15T23:59:59.000Z");

    for (const d of [minuitUtc, finDeJourUtc]) {
      const courtStr = formatDate(d, "court");
      const isoStr = formatDate(d, "iso");
      const anneeStr = formatDate(d, "annee");

      // court: "DD/MM/YYYY" -> extraire DD et YYYY
      const [dayStr, , yearStr] = courtStr.split("/");
      const dayFromCourt = parseInt(dayStr, 10);
      const yearFromCourt = parseInt(yearStr, 10);

      // iso: "YYYY-MM-DD" -> extraire YYYY et DD
      const [yearFromIso, , dayFromIso] = isoStr.split("-");
      const yearFromIsoNum = parseInt(yearFromIso, 10);
      const dayFromIsoNum = parseInt(dayFromIso, 10);

      // annee: "YYYY" -> extraire YYYY
      const yearFromAnnee = parseInt(anneeStr, 10);

      // Verifier la coherence pour cette date
      expect(dayFromCourt).toBe(dayFromIsoNum);
      expect(yearFromCourt).toBe(yearFromIsoNum);
      expect(yearFromCourt).toBe(yearFromAnnee);
    }
  });
});
