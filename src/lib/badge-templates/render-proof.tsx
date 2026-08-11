import { renderToBuffer } from "@react-pdf/renderer";
import { buildDeclarativeTemplate, type AssetResolver } from "./declarative";
import type { TemplateManifest } from "./declarative/manifest-types";
import { SAMPLE_CONTEXT } from "./declarative/sample-context";
import type { PackageAsset } from "./package-reader";

// Les ressources d'un paquet sont servies en data URL : @react-pdf accepte ce format
// pour les images comme pour les polices, ce qui evite tout fichier temporaire.
export function assetsToResolver(assets: PackageAsset[]): AssetResolver {
  const map = new Map(
    assets.map((a) => [a.path, `data:${a.contentType};base64,${a.body.toString("base64")}`]),
  );
  return (name: string) => {
    const url = map.get(name);
    if (!url) throw new Error(`assetsToResolver : ressource inconnue "${name}"`);
    return url;
  };
}

// Rend le paquet avec le contexte de demonstration. Leve si le rendu echoue, auquel
// cas l'appelant refuse l'installation : un paquet accepte au catalogue est un paquet
// dont on a la preuve qu'il s'imprime.
export async function renderProof(
  manifest: TemplateManifest,
  assets: PackageAsset[],
  templateId: string,
): Promise<Buffer> {
  const template = buildDeclarativeTemplate(manifest, assetsToResolver(assets), templateId);
  const { Component } = template;
  return renderToBuffer(<Component ctx={SAMPLE_CONTEXT} />);
}
