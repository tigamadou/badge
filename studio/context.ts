import { generateQRCodeDataURL } from "../src/lib/qrcode";
import { SAMPLE_CONTEXT } from "../src/lib/badge-templates/declarative/sample-context";
import type { TemplateContext } from "../src/lib/badge-templates/types";

// Portrait de demonstration (PNG 60x80, silhouette claire sur fond ardoise).
// Constante en dur : aucun binaire n'entre au depot, et deux rendus successifs
// sont identiques. Le ratio 3:4 permet de juger le cadrage d'un bloc photo.
const DEMO_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABQCAIAAADKqIEEAAABl0lEQVR42tXORVYDURSE4btF3Im7J510xz04wW0xbIA562HQE0bkvvsk1Dn/uOqjYPEBF0Gi/fk7XJjo1uwNLkx0c/oKFybam7xY6vvr09IymVX+nTF0Y/ys30ru7/TvyLHYiJvqoyedBOIwnVNai1jTTbXhoyxNcZjsmtYoFrupOnhQzaA4TBWAia7075UyLg5TMmCiy707fpbEYXwGJrrUXfKziuYz6J+IldxU7Nwyc4BmSjDRhfYNMwdopgQTnQ+umTlAMyWY6Jx/xcwBminBRGdbl8wcoJkSTHSmecHMAZopwUSnvXN+VsV8BiY61TjjZxXNZ6ih7bmVDJSsL5SyhFYyKKNtuFUBlKjNBRkUC94x0fHqTJYRsexajtZ3i38pVpnqJBbrnOqiZW7NR4qWJ0Zico18GUOvpBt8oUhpDBcm+rQ4ggsTfVIYwoWJPs4P4MJEH+X6cGGiD7M9uDDRB5kuXJjo/XQHLkz0XqoNFyZ6NxnAhYneSfhwYaK34y24MNFbsSZcmOjNqAcXJnoj0oALEv0DFRulEl1IB6YAAAAASUVORK5CYII=";

// Entree du formulaire du studio : tout est partiel, les champs absents prennent
// la valeur par defaut. La date arrive en ISO (un formulaire ne transporte pas
// d'objet Date), le QR est produit par le serveur depuis `badge.verifyUrl`.
export type ContextInput = {
  participant?: Partial<{
    firstName: string;
    lastName: string;
    structure: string;
    photoDataUrl: string;
  }>;
  category?: Partial<{
    name: string;
    color: string;
    neutralBadge: boolean;
    anonymous: boolean;
  }>;
  event?: Partial<{
    title: string;
    location: string;
    date: string;
    logoDataUrl: string | null;
  }>;
  badge?: Partial<{ id: string; verifyUrl: string }>;
};

export type Preset = { id: string; label: string; input: ContextInput };

// Le contexte de reference du studio : SAMPLE_CONTEXT complete d'une photo, pour
// que le cadrage d'un bloc photo soit observable des l'ouverture.
export const DEFAULT_CONTEXT_INPUT: ContextInput = {
  participant: { photoDataUrl: DEMO_PHOTO },
  event: { date: SAMPLE_CONTEXT.event.date.toISOString() },
};

// Les cinq anciennes variantes, devenues des points de depart modifiables :
// un manifeste se casse sur les `visibleIf` et les debordements.
export const PRESETS: Preset[] = [
  { id: "complet", label: "Participant complet", input: DEFAULT_CONTEXT_INPUT },
  {
    id: "sans-photo",
    label: "Sans photo",
    input: { ...DEFAULT_CONTEXT_INPUT, participant: { photoDataUrl: "" } },
  },
  {
    id: "anonyme",
    label: "Catégorie anonyme",
    input: { ...DEFAULT_CONTEXT_INPUT, category: { anonymous: true } },
  },
  {
    id: "neutre",
    label: "Badge neutre",
    input: { ...DEFAULT_CONTEXT_INPUT, category: { neutralBadge: true, anonymous: false } },
  },
  {
    id: "textes-longs",
    label: "Textes très longs",
    input: {
      ...DEFAULT_CONTEXT_INPUT,
      participant: {
        ...DEFAULT_CONTEXT_INPUT.participant,
        firstName: "Marie-Christine Élisabeth",
        lastName: "Ouédraogo-Zoungrana Kaboré Sawadogo",
        structure:
          "Direction générale de la coopération internationale et des partenariats institutionnels",
      },
      event: {
        ...DEFAULT_CONTEXT_INPUT.event,
        title:
          "Forum international sur la transformation numérique des administrations publiques",
      },
      category: { name: "Délégation officielle accompagnante" },
    },
  },
];

// Fusionne l'entree du formulaire avec les defauts et produit un contexte complet.
// Le QR est genere pour de vrai : SAMPLE_CONTEXT le laisse vide, ce qui masquerait
// le cadrage du bloc et sa lisibilite a la taille choisie.
export async function buildContext(input: ContextInput = DEFAULT_CONTEXT_INPUT): Promise<TemplateContext> {
  const participant = {
    ...SAMPLE_CONTEXT.participant,
    ...DEFAULT_CONTEXT_INPUT.participant,
    ...input.participant,
  };
  const category = { ...SAMPLE_CONTEXT.category, ...input.category };
  const event = {
    ...SAMPLE_CONTEXT.event,
    ...input.event,
    date: new Date(input.event?.date ?? SAMPLE_CONTEXT.event.date.toISOString()),
  };
  const badge = { ...SAMPLE_CONTEXT.badge, ...input.badge };

  return {
    participant,
    category,
    event,
    badge: { ...badge, qrCodeDataUrl: await generateQRCodeDataURL(badge.verifyUrl) },
  };
}
