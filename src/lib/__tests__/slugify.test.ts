import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("minuscule + tirets", () => {
    expect(slugify("Acme Corp")).toBe("acme-corp");
  });
  it("retire les accents", () => {
    expect(slugify("Evenement Ete a Cote")).toBe("evenement-ete-a-cote");
  });
  it("compresse les separateurs et trim les tirets", () => {
    expect(slugify("  --Hello__World!!  ")).toBe("hello-world");
  });
  it("tronque a maxLength sans tiret final", () => {
    expect(slugify("a".repeat(80), { maxLength: 5 })).toBe("aaaaa");
    expect(slugify("aaaa bbbb", { maxLength: 5 })).toBe("aaaa");
  });
  it("fallback si vide", () => {
    expect(slugify("!!!")).toBe("org");
    expect(slugify("", { fallback: "x" })).toBe("x");
  });
});
