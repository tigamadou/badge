import { describe, it, expect } from "vitest";
import {
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  LIST_PAGE_MAX,
  parseListPage,
  withListParams,
} from "@/lib/list-query";

describe("constantes", () => {
  it("options officielles et defaut", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100, 500]);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });
});

describe("parseListPage", () => {
  it("valeurs par defaut", () => {
    expect(parseListPage(new URLSearchParams())).toEqual({ page: 1, pageSize: 10, skip: 0, take: 10 });
  });

  it("lit page et pageSize", () => {
    expect(parseListPage(new URLSearchParams("page=3&pageSize=50"))).toEqual({
      page: 3,
      pageSize: 50,
      skip: 100,
      take: 50,
    });
  });

  it("accepte l'objet des searchParams de Next", () => {
    expect(parseListPage({ page: "2", pageSize: "10" }).skip).toBe(10);
    expect(parseListPage({ page: ["2", "3"] }).page).toBe(2);
    expect(parseListPage({ page: undefined }).page).toBe(1);
  });

  it.each(["0", "-1", "abc", "1.5", ""])("page=%j retombe a 1", (v) => {
    expect(parseListPage(new URLSearchParams({ page: v })).page).toBe(1);
  });

  it.each(["1e9", "999999999"])("page=%s est plafonnee", (v) => {
    const r = parseListPage(new URLSearchParams({ page: v }));
    expect(r.page).toBe(LIST_PAGE_MAX);
    expect(r.skip).toBe((LIST_PAGE_MAX - 1) * 10);
  });

  it.each(["7", "0", "-10", "abc", "", "1000"])("pageSize=%j retombe au defaut", (v) => {
    expect(parseListPage(new URLSearchParams({ pageSize: v })).pageSize).toBe(10);
  });

  it("defaultSize personnalise", () => {
    expect(parseListPage(new URLSearchParams(), { defaultSize: 100 }).pageSize).toBe(100);
    expect(parseListPage(new URLSearchParams("pageSize=7"), { defaultSize: 100 }).pageSize).toBe(100);
    expect(parseListPage(new URLSearchParams("pageSize=50"), { defaultSize: 100 }).pageSize).toBe(50);
  });
});

describe("withListParams", () => {
  it("remplace page et pageSize en gardant le reste", () => {
    const p = new URLSearchParams(withListParams("q=a&page=4&pageSize=20", { pageSize: 50, page: 1 }));
    expect(p.get("q")).toBe("a");
    expect(p.get("page")).toBe("1");
    expect(p.get("pageSize")).toBe("50");
  });
  it("ajoute a une chaine vide", () => {
    expect(withListParams("", { page: 2 })).toBe("page=2");
  });
  it("tolere un ? initial et un patch vide", () => {
    expect(withListParams("?x=1", {})).toBe("x=1");
  });
});
