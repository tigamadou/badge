import { generateQRCodeDataURL } from "../src/lib/qrcode";
import { SAMPLE_CONTEXT } from "../src/lib/badge-templates/declarative/sample-context";
import type { TemplateContext } from "../src/lib/badge-templates/types";

export type PreviewVariant = { id: string; label: string };

// Portrait de demonstration (PNG 60x80, silhouette claire sur fond ardoise).
// Constante en dur : aucun binaire n'entre au depot, et deux rendus successifs
// sont identiques. Le ratio 3:4 permet de juger le cadrage d'un bloc photo.
const DEMO_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABQCAIAAADKqIEEAAABl0lEQVR42tXORVYDURSE4btF3Im7J510xz04wW0xbIA562HQE0bkvvsk1Dn/uOqjYPEBF0Gi/fk7XJjo1uwNLkx0c/oKFybam7xY6vvr09IymVX+nTF0Y/ys30ru7/TvyLHYiJvqoyedBOIwnVNai1jTTbXhoyxNcZjsmtYoFrupOnhQzaA4TBWAia7075UyLg5TMmCiy707fpbEYXwGJrrUXfKziuYz6J+IldxU7Nwyc4BmSjDRhfYNMwdopgQTnQ+umTlAMyWY6Jx/xcwBminBRGdbl8wcoJkSTHSmecHMAZopwUSnvXN+VsV8BiY61TjjZxXNZ6ih7bmVDJSsL5SyhFYyKKNtuFUBlKjNBRkUC94x0fHqTJYRsexajtZ3i38pVpnqJBbrnOqiZW7NR4qWJ0Zico18GUOvpBt8oUhpDBcm+rQ4ggsTfVIYwoWJPs4P4MJEH+X6cGGiD7M9uDDRB5kuXJjo/XQHLkz0XqoNFyZ6NxnAhYneSfhwYaK34y24MNFbsSZcmOjNqAcXJnoj0oALEv0DFRulEl1IB6YAAAAASUVORK5CYII=";

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
