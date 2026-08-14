import { renderToBuffer } from "@react-pdf/renderer";
import { buildDeclarativeTemplate, parseManifest } from "../src/lib/badge-templates/declarative";
import { assetsToResolver } from "../src/lib/badge-templates/render-proof";
import type { PackageAsset } from "../src/lib/badge-templates/package-reader";
import { buildVariantContext } from "./contexts";

export type RenderResult = { ok: true; pdf: Buffer } | { ok: false; errors: string[] };

// Identifiant de template arbitraire : il ne sert qu'a prefixer les familles de
// polices enregistrees aupres de @react-pdf, et n'a pas a etre stable ici.
const STUDIO_TEMPLATE_ID = "studio-preview";

export async function renderManifest(args: {
  manifest: string;
  assets: PackageAsset[];
  variantId: string;
}): Promise<RenderResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(args.manifest);
  } catch {
    return { ok: false, errors: ["Manifeste invalide : JSON illisible."] };
  }

  const parsed = parseManifest(
    raw,
    args.assets.map((a) => a.path),
  );
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const ctx = await buildVariantContext(args.variantId);
  if (!ctx) return { ok: false, errors: [`Variante inconnue : "${args.variantId}".`] };

  const { Component } = buildDeclarativeTemplate(
    parsed.manifest,
    assetsToResolver(args.assets),
    STUDIO_TEMPLATE_ID,
  );
  const pdf = await renderToBuffer(<Component ctx={ctx} />);
  return { ok: true, pdf };
}
