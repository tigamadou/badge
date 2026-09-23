import { renderToBuffer } from "@react-pdf/renderer";
import { buildDeclarativeTemplate, type AssetResolver } from "./declarative";
import type { TemplateManifest } from "./declarative/manifest-types";
import { samplesOf } from "./declarative/variables";
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

// Rend le paquet avec ses valeurs d'epreuve. Leve si le rendu echoue, auquel cas
// l'appelant refuse l'installation : un paquet accepte au catalogue est un paquet
// dont on a la preuve qu'il s'imprime.
export async function renderProof(
  manifest: TemplateManifest,
  assets: PackageAsset[],
  templateId: string,
): Promise<Buffer> {
  const resolver = assetsToResolver(assets);
  const { Component } = buildDeclarativeTemplate(manifest, resolver, templateId);
  // Les valeurs d'epreuve viennent des `sample` du manifeste : deux installations
  // du meme paquet produisent exactement le meme apercu.
  return renderToBuffer(<Component values={samplesOf(manifest.variables, resolver)} />);
}
