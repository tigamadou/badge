import type { BadgeTemplate } from "../types";
import type { TemplateManifest } from "./manifest-types";
import type { AssetResolver } from "./fonts";
import { DeclarativeDocument } from "./renderer";

export type { AssetResolver } from "./fonts";
export type { TemplateManifest } from "./manifest-types";
export { parseManifest, type ParseResult } from "./schema";

// Porte d'entree du moteur. Rend un BadgeTemplate de meme forme que ceux du registre
// compile, de sorte qu'un consommateur ne distingue pas les deux origines.
// `previewSrc` est laisse vide : le catalogue le renseigne depuis le stockage, le
// moteur n'ayant aucune connaissance des apercus.
export function buildDeclarativeTemplate(
  manifest: TemplateManifest,
  assets: AssetResolver,
  templateId: string,
): BadgeTemplate {
  return {
    meta: {
      id: templateId,
      label: manifest.label,
      description: manifest.description,
      pages: manifest.page.count,
      pageSize: { width: `${manifest.page.widthPx}px`, height: `${manifest.page.heightPx}px` },
      previewSrc: "",
      version: manifest.formatVersion,
    },
    Component: ({ ctx }) => DeclarativeDocument({ manifest, assets, templateId, ctx }),
  };
}
