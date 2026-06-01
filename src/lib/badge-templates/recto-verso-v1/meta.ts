import type { TemplateMeta } from "../types";

export const meta: TemplateMeta = {
  id: "recto-verso-v1",
  label: "Badge recto-verso",
  description:
    "Badge deux faces au format A7 portrait (74 x 105 mm). Recto : identite et QR code. Verso : titre evenement grand format et bande categorie pleine page.",
  pages: 2,
  pageSize: { width: "74mm", height: "105mm" },
  previewSrc: "/badge-previews/recto-verso-v1.png",
  version: 1,
};
