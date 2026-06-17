import type { TemplateMeta } from "../types";

export const meta: TemplateMeta = {
  id: "default-v1",
  label: "Badge standard",
  description:
    "Badge mono-face au format carte bancaire (CR80 paysage). Photo a gauche, identite et QR code a droite, bande categorie pleine couleur en bas.",
  pages: 1,
  pageSize: { width: "85.6mm", height: "54mm" },
  previewSrc: "/badge-previews/default-v1.png",
  version: 1,
};
