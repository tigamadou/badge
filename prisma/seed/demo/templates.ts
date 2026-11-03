import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseManifest } from "@tigamadou/pdf-engine";
import type { PackageAsset } from "@tigamadou/pdf-engine/package";
import { prisma } from "../../../src/lib/prisma";
import { installTemplate, REFERENCE_DIR } from "../../../src/lib/badge-templates/install";
import type { Bindings } from "../../../src/lib/badge-templates/bindings";
import { DEMO_SLUG_PREFIX } from "../constants";
import type { DemoContext } from "./context";

/**
 * Installe un paquet de reference (`prisma/badge-templates/<source>/`) sous une famille `demo-*`
 * et retourne l'identifiant installe. Meme chemin que le seed de reference : validation des
 * liaisons, epreuve rendue, apercu.
 */
export async function installDemoTemplate(
  _ctx: DemoContext,
  args: { family: string; label: string; source: "default" | "recto-verso" },
): Promise<string> {
  if (!args.family.startsWith(DEMO_SLUG_PREFIX)) {
    throw new Error(`Famille de template de demo invalide (prefixe "${DEMO_SLUG_PREFIX}" requis) : ${args.family}`);
  }
  const dir = resolve(REFERENCE_DIR, args.source);
  const raw = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Record<string, unknown>;
  const bindings = JSON.parse(readFileSync(join(dir, "bindings.json"), "utf8")) as Bindings;
  const assetsDir = join(dir, "assets");
  const assets: PackageAsset[] = existsSync(assetsDir)
    ? readdirSync(assetsDir).map((name) => ({
        path: `assets/${name}`,
        body: readFileSync(join(assetsDir, name)),
        contentType: name.endsWith(".png") ? "image/png" : "image/jpeg",
      }))
    : [];

  const parsed = parseManifest({ ...raw, family: args.family, label: args.label }, assets.map((a) => a.path));
  if (!parsed.ok) throw new Error(`Paquet de demo "${args.source}" invalide : ${parsed.errors.join(" | ")}`);

  const admin = await prisma.user.findFirstOrThrow({
    where: { staffRole: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const installed = await installTemplate({
    manifest: parsed.manifest,
    assets,
    bindings,
    installedById: admin.id,
  });
  return installed.id;
}
