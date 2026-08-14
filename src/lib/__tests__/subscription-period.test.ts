import { describe, it, expect } from "vitest";
import { PERIOD_DAYS, computeSubscriptionDates } from "@/lib/subscription";

describe("computeSubscriptionDates", () => {
  const from = new Date("2026-01-01T00:00:00.000Z");

  it("mensuel = +30 jours", () => {
    const { startDate, endDate } = computeSubscriptionDates("MONTHLY", from);
    expect(startDate).toEqual(from);
    expect(endDate).toEqual(new Date("2026-01-31T00:00:00.000Z"));
  });

  it("annuel = +365 jours", () => {
    const { endDate } = computeSubscriptionDates("ANNUAL", from);
    // 2026 n'est pas bissextile : 2026-01-01 + 365 j tombe au 2027-01-01.
    expect(endDate).toEqual(new Date("2027-01-01T00:00:00.000Z"));
  });

  it("PERIOD_DAYS expose 30 et 365", () => {
    expect(PERIOD_DAYS).toEqual({ MONTHLY: 30, ANNUAL: 365 });
  });

  it("startDate par defaut = maintenant (endDate > startDate)", () => {
    const { startDate, endDate } = computeSubscriptionDates("MONTHLY");
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
  });
});
