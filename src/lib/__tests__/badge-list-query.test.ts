import { describe, it, expect } from "vitest";
import {
  BADGE_PAGE_SIZE_DEFAULT,
  BADGE_PAGE_SIZE_MAX,
  BADGE_PAGE_MAX,
  parseBadgePage,
  buildBadgeWhere,
} from "@/lib/badge-list-query";

describe("parseBadgePage", () => {
  it("constantes", () => {
    expect(BADGE_PAGE_SIZE_DEFAULT).toBe(10);
    expect(BADGE_PAGE_SIZE_MAX).toBe(500);
  });
  it("defauts et valeurs valides", () => {
    expect(parseBadgePage(new URLSearchParams())).toEqual({ page: 1, pageSize: 10 });
    expect(parseBadgePage(new URLSearchParams("page=2&pageSize=50"))).toEqual({ page: 2, pageSize: 50 });
  });
  it("taille hors liste -> defaut, page absurde -> plafonnee", () => {
    expect(parseBadgePage(new URLSearchParams("pageSize=7")).pageSize).toBe(10);
    expect(parseBadgePage(new URLSearchParams("page=1e9")).page).toBe(BADGE_PAGE_MAX);
  });
});

describe("buildBadgeWhere", () => {
  it("sans filtre", () => {
    expect(buildBadgeWhere("evt", new URLSearchParams())).toEqual({ eventId: "evt", status: "APPROVED" });
  });
  it.each([
    ["printed", { badgePrinted: true }],
    ["unprinted", { badgePrinted: false }],
    ["allaccess", { allAccessGranted: true }],
  ])("filtre %s", (filter, extra) => {
    expect(buildBadgeWhere("evt", new URLSearchParams({ filter }))).toEqual({
      eventId: "evt",
      status: "APPROVED",
      ...extra,
    });
  });
  it("categorie", () => {
    expect(buildBadgeWhere("evt", new URLSearchParams({ categoryId: "c1" })).categoryId).toBe("c1");
  });
  it("recherche par jetons, q blanc ignore", () => {
    const w = buildBadgeWhere("evt", new URLSearchParams({ q: "jean dupont" }));
    expect(w.AND).toHaveLength(2);
    expect((w.AND as { OR: unknown[] }[])[0].OR).toHaveLength(3);
    expect(buildBadgeWhere("evt", new URLSearchParams({ q: "   " })).AND).toBeUndefined();
  });
});
