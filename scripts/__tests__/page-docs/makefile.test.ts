import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const makefile = fs.readFileSync(path.resolve(__dirname, "../../../Makefile"), "utf8");
const recipe = (target: string) => new RegExp(`^${target}:.*\\n((?:\\t.*\\n)+)`, "m").exec(makefile)?.[1] ?? "";

describe("Makefile : docs des pages", () => {
  it("déclare docs-check et docs-stamp dans .PHONY", () => {
    const phony = makefile.slice(0, makefile.indexOf("\n\n"));
    expect(phony).toMatch(/\bdocs-check\b/);
    expect(phony).toMatch(/\bdocs-stamp\b/);
  });

  it("lint appelle docs-check après eslint", () => {
    const lines = recipe("lint").split("\n").filter(Boolean);
    expect(lines[0]).toContain("yarn lint");
    expect(lines[1]).toContain("docs-check");
  });

  it("docs-check et docs-stamp lancent l'outil", () => {
    expect(recipe("docs-check")).toContain("scripts/page-docs/cli.ts check");
    expect(recipe("docs-stamp")).toContain("scripts/page-docs/cli.ts stamp $(PAGES)");
  });

  it("docs-stamp échoue avec un message d'usage si PAGES est vide", () => {
    const first = recipe("docs-stamp").split("\n")[0];
    expect(first).toContain('test -n "$(PAGES)"');
    expect(first).toContain("Usage : make docs-stamp PAGES=");
    expect(first).toContain("exit 1");
  });
});
