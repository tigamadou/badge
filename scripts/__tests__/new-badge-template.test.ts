import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSkeleton } from "../new-badge-template";
import { parseManifest } from "@/lib/badge-templates/declarative/schema";

let racine: string;

afterEach(() => {
  if (racine && existsSync(racine)) rmSync(racine, { recursive: true, force: true });
});

describe("createSkeleton", () => {
  it("cree le manifeste, le README et le dossier assets", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);

    expect(existsSync(join(dir, "manifest.json"))).toBe(true);
    expect(existsSync(join(dir, "README.md"))).toBe(true);
    expect(existsSync(join(dir, "assets"))).toBe(true);
  });

  it("produit un manifeste valide une fois l'image deposee", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

    // Le squelette declare `assets/apercu.png` : il est valide des que l'image existe.
    const res = parseManifest(manifest, ["assets/apercu.png"]);
    expect(res.ok, res.ok === false ? res.errors.join(" | ") : "").toBe(true);
  });

  it("declare un apercu, que l'auteur doit deposer", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

    expect(manifest.preview).toBe("assets/apercu.png");
    // Sans l'image, le paquet ne passe pas : c'est le rappel voulu.
    expect(parseManifest(manifest, []).ok).toBe(false);
  });

  it("nomme la famille d'apres le nom demande", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    expect(manifest.family).toBe("salon-2027");
  });

  it("documente le format dans le README", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    const readme = readFileSync(join(dir, "README.md"), "utf8");

    expect(readme).toMatch(/participant\.firstName/);
    expect(readme).toMatch(/overflow/);
    expect(readme).toMatch(/pack-badge-template NAME=salon-2027/);
  });

  it("refuse un nom qui n'est pas un slug", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    expect(() => createSkeleton("Salon 2027", racine)).toThrow(/slug/i);
  });

  it("refuse d'ecraser un dossier existant", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    createSkeleton("salon-2027", racine);
    expect(() => createSkeleton("salon-2027", racine)).toThrow(/existe/i);
  });
});
