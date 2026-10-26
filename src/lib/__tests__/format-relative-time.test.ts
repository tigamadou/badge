import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "../format-relative-time";

const now = new Date("2026-10-24T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it("affiche « il y a 5 min »", () => {
    expect(formatRelativeTime(ago(5 * MIN), now)).toBe("il y a 5 min");
  });

  it("affiche « maintenant » sous une minute, et pour une date future", () => {
    expect(formatRelativeTime(ago(20_000), now)).toBe("maintenant");
    expect(formatRelativeTime(new Date(now.getTime() + 5 * MIN), now)).toBe("maintenant");
  });

  it("heures, hier, jours, mois, années", () => {
    expect(formatRelativeTime(ago(3 * HOUR), now)).toBe("il y a 3 h");
    expect(formatRelativeTime(ago(DAY), now)).toBe("hier");
    expect(formatRelativeTime(ago(3 * DAY), now)).toBe("il y a 3 j");
    expect(formatRelativeTime(ago(60 * DAY), now)).toBe("il y a 2 m.");
    expect(formatRelativeTime(ago(400 * DAY), now)).toBe("l’an dernier");
  });

  it("accepte une chaîne ISO et la date courante par défaut", () => {
    expect(formatRelativeTime(ago(5 * MIN).toISOString(), now)).toBe("il y a 5 min");
    expect(formatRelativeTime(new Date())).toBe("maintenant");
  });
});
