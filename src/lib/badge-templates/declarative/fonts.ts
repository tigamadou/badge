import { Font } from "@react-pdf/renderer";
import type { FontDeclaration } from "./manifest-types";

// Une ressource du paquet, rendue sous forme de data URL. @react-pdf accepte une
// data URL aussi bien pour une image que pour une police (@react-pdf/font l.249),
// ce qui evite tout fichier temporaire.
export type AssetResolver = (name: string) => string;

export const DEFAULT_FONT_FAMILY = "Montserrat";

// Font.register est global au process et indexe par nom de famille : deux paquets
// declarant l'alias "titre" s'ecraseraient. Le prefixe par templateId les isole.
export function registerTemplateFonts(
  templateId: string,
  fonts: FontDeclaration[] | undefined,
  assets: AssetResolver,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const font of fonts ?? []) {
    const family = `tpl-${templateId}-${font.alias}`;
    Font.register({
      family,
      fonts: [
        { src: assets(font.file), fontWeight: font.weight ?? 400, fontStyle: font.style ?? "normal" },
      ],
    });
    map[font.alias] = family;
  }
  return map;
}
