import { generateQRCodeDataURL } from "../src/lib/qrcode";
import { SAMPLE_CONTEXT } from "../src/lib/badge-templates/declarative/sample-context";
import type { TemplateContext } from "../src/lib/badge-templates/types";

export type PreviewVariant = { id: string; label: string };

// Portrait uni de demonstration (PNG 2x3, gris ardoise). Constante en dur : aucun
// binaire n'entre au depot, et deux rendus successifs sont identiques.
const DEMO_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAAN71ZuAAAAFElEQVR4nGNkYGD4z0AEYCJG0WBWCAAaGAIBHUAIiwAAAABJRU5ErkJggg==";

const VARIANTS: Array<PreviewVariant & { apply: (ctx: TemplateContext) => TemplateContext }> = [
  {
    id: "complet",
    label: "Participant complet",
    apply: (ctx) => ({ ...ctx, participant: { ...ctx.participant, photoDataUrl: DEMO_PHOTO } }),
  },
  {
    id: "sans-photo",
    label: "Sans photo",
    apply: (ctx) => ({ ...ctx, participant: { ...ctx.participant, photoDataUrl: "" } }),
  },
  {
    id: "anonyme",
    label: "Catégorie anonyme",
    apply: (ctx) => ({
      ...ctx,
      participant: { ...ctx.participant, photoDataUrl: DEMO_PHOTO },
      category: { ...ctx.category, anonymous: true },
    }),
  },
  {
    id: "neutre",
    label: "Badge neutre",
    apply: (ctx) => ({
      ...ctx,
      participant: { ...ctx.participant, photoDataUrl: DEMO_PHOTO },
      category: { ...ctx.category, neutralBadge: true, anonymous: false },
    }),
  },
  {
    id: "textes-longs",
    label: "Textes très longs",
    apply: (ctx) => ({
      ...ctx,
      participant: {
        ...ctx.participant,
        firstName: "Marie-Christine Élisabeth",
        lastName: "Ouédraogo-Zoungrana Kaboré Sawadogo",
        structure:
          "Direction générale de la coopération internationale et des partenariats institutionnels",
        photoDataUrl: DEMO_PHOTO,
      },
      event: {
        ...ctx.event,
        title:
          "Forum international sur la transformation numérique des administrations publiques",
      },
      category: { ...ctx.category, name: "Délégation officielle accompagnante" },
    }),
  },
];

export function listVariants(): PreviewVariant[] {
  return VARIANTS.map(({ id, label }) => ({ id, label }));
}

export async function buildVariantContext(id: string): Promise<TemplateContext | null> {
  const variant = VARIANTS.find((v) => v.id === id);
  if (!variant) return null;
  // Le QR est produit pour de vrai : SAMPLE_CONTEXT le laisse vide, ce qui masque
  // le cadrage du bloc et sa lisibilite a la taille choisie.
  const qrCodeDataUrl = await generateQRCodeDataURL(SAMPLE_CONTEXT.badge.verifyUrl);
  return variant.apply({
    ...SAMPLE_CONTEXT,
    badge: { ...SAMPLE_CONTEXT.badge, qrCodeDataUrl },
  });
}
