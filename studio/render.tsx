import { renderToBuffer } from "@react-pdf/renderer";
import { buildDeclarativeTemplate, parseManifest } from "../src/lib/badge-templates/declarative";
import { assetsToResolver } from "../src/lib/badge-templates/render-proof";
import type { PackageAsset } from "../src/lib/badge-templates/package-reader";
import type { TemplateContext } from "../src/lib/badge-templates/types";

export type RenderResult = { ok: true; pdf: Buffer } | { ok: false; errors: string[] };

// Identifiant de template arbitraire : il ne sert qu'a prefixer les familles de
// polices enregistrees aupres de @react-pdf, et n'a pas a etre stable ici.
const STUDIO_TEMPLATE_ID = "studio-preview";

export async function renderManifest(args: {
  manifest: string;
  assets: PackageAsset[];
  context: TemplateContext;
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

  const { Component } = buildDeclarativeTemplate(
    parsed.manifest,
    assetsToResolver(args.assets),
    STUDIO_TEMPLATE_ID,
  );
  const pdf = await renderToBuffer(<Component ctx={args.context} />);
  return { ok: true, pdf };
}
