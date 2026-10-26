import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "@/lib/badge-templates/engine-upgrade";

// Le tag de l'image du service de rendu est toujours egal a la version du moteur :
// un ecart ferait rendre les badges par un autre moteur que celui qui les valide.
const read = (file: string) => readFileSync(resolve(file), "utf8");
const IMAGE = `ghcr.io/tigamadou/pdf-engine-renderer:${ENGINE_VERSION}`;
const COMPOSES = ["docker-compose.dev.yml", "docker-compose.yml", "docker-compose.preprod.yml"];

// Bloc du service `renderer` : de sa ligne d'en-tete au service suivant (ou a la fin).
function rendererBlock(compose: string): string {
  const lines = read(compose).split("\n");
  const start = lines.findIndex((l) => l === "  renderer:");
  expect(start).toBeGreaterThan(-1);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^ {0,2}\S/.test(l) && !l.startsWith("   ") && !l.startsWith("  #"));
  return lines.slice(start, end === -1 ? undefined : start + 1 + end).join("\n");
}

describe("version du service de rendu", () => {
  it.each(COMPOSES)("%s : image egale a la version du moteur, une seule fois", (compose) => {
    const text = read(compose);
    expect(text.split(IMAGE).length - 1).toBe(1);
    expect(text.match(/pdf-engine-renderer:/g)).toHaveLength(1);
  });

  it.each(COMPOSES)("%s : renderer sans port publie, avec init et delai de grace", (compose) => {
    const block = rendererBlock(compose);
    expect(block).not.toMatch(/^\s+ports:/m);
    expect(block).toMatch(/^\s+init: true$/m);
    expect(block).toMatch(/^\s+stop_grace_period: 30s$/m);
    expect(block).toMatch(/^\s+networks: \[rendu\]$/m);
  });

  it.each(COMPOSES)("%s : le reseau rendu est interne", (compose) => {
    expect(read(compose)).toMatch(/^networks:[\s\S]*^ {2}rendu:\n {4}internal: true$/m);
  });

  it("le renderer de dev est publie en linux/amd64 (aucune variante arm64)", () => {
    expect(rendererBlock("docker-compose.dev.yml")).toMatch(/^\s+platform: linux\/amd64$/m);
  });

  it("package.json declare le moteur a la version exacte", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["@tigamadou/pdf-engine"]).toBe(ENGINE_VERSION);
  });

  it("le job e2e de la CI reference la meme image", () => {
    expect(read(".github/workflows/ci.yml")).toContain(`image: ${IMAGE}`);
  });
});
