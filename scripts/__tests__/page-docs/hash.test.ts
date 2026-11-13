import { afterEach, describe, expect, it } from "vitest";
import { hashSources } from "../../page-docs/hash";
import { makeRepo, removeRepo, writeFile } from "./helpers";

let root = "";
afterEach(() => removeRepo(root));

describe("hashSources", () => {
  it("est stable, indépendant de l'ordre et des fins de ligne", () => {
    root = makeRepo({ "a.ts": "un\ndeux\n", "b.ts": "trois" });
    const h = hashSources(root, ["a.ts", "b.ts"]);
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(hashSources(root, ["b.ts", "a.ts"])).toBe(h);
    writeFile(root, "a.ts", "un\r\ndeux\r\n");
    expect(hashSources(root, ["a.ts", "b.ts"])).toBe(h);
  });

  it("change à la modification d'un caractère", () => {
    root = makeRepo({ "a.ts": "abc" });
    const h = hashSources(root, ["a.ts"]);
    writeFile(root, "a.ts", "abd");
    expect(hashSources(root, ["a.ts"])).not.toBe(h);
  });

  it("compte un fichier absent comme absent, sans exception", () => {
    root = makeRepo({ "a.ts": "abc" });
    const avec = hashSources(root, ["a.ts"]);
    const sans = hashSources(root, ["a.ts", "absent.ts"]);
    expect(sans).not.toBe(avec);
    expect(hashSources(root, ["a.ts", "absent.ts"])).toBe(sans);
  });
});
