// Portage de pdfStudio/src/server/migrate-v1.ts. Ecarts VOLONTAIRES avec l'original,
// a reappliquer lors d'un futur re-portage :
// - le moteur vient du package @tigamadou/pdf-engine ;
// - V1_VARIABLES_SANS_SAMPLE_IMAGE retire : seul le squelette du studio s'en servait ;
// - `rest` construit par Object.fromEntries/filter au lieu d'une destructuration a
//   variables ignorees, signalee par la regle no-unused-vars du lint ;
// - garde `visibleIf === undefined` retire de migrateConditions : l'appelant ne la
//   transmet que definie, la branche etait morte (et bloquait la couverture 100 %).
import type { VariableDeclaration } from "@tigamadou/pdf-engine";

// Le vocabulaire du format v1, fige. C'est la seule survivance du domaine badge
// dans le code : l'ancien SOURCES et l'ancien SAMPLE_CONTEXT fusionnes en une table
// de migration. Le moteur, lui, n'en sait plus rien.
// Les samples d'images designent des ressources du paquet : ils ne sont attaches
// que si la ressource existe, faute de quoi le manifeste produit serait invalide.
export const V1_VARIABLES: Array<VariableDeclaration & { assetSample?: string }> = [
  { name: "participant.firstName", kind: "text", label: "Prenom", sample: "Awa" },
  { name: "participant.lastName", kind: "text", label: "Nom", sample: "Diallo" },
  { name: "participant.structure", kind: "text", label: "Structure", sample: "Organisation de démonstration" },
  { name: "participant.photoDataUrl", kind: "image", label: "Photo", assetSample: "assets/photo-demo.png" },
  { name: "category.name", kind: "text", label: "Categorie", sample: "Visiteur" },
  { name: "category.color", kind: "color", label: "Couleur de categorie", sample: "#4f46e5" },
  { name: "category.neutralBadge", kind: "boolean", label: "Badge neutre", sample: false },
  { name: "category.anonymous", kind: "boolean", label: "Badge anonyme", sample: false },
  { name: "event.title", kind: "text", label: "Titre de l'evenement", sample: "Événement de démonstration" },
  { name: "event.date", kind: "date", label: "Date", format: "long", sample: "2027-12-15T00:00:00.000Z" },
  { name: "event.location", kind: "text", label: "Lieu", sample: "Cotonou" },
  { name: "event.logoDataUrl", kind: "image", label: "Logo de l'evenement", assetSample: "assets/logo-demo.png" },
  { name: "badge.id", kind: "text", label: "Identifiant", sample: "DEMO-0001" },
  { name: "badge.verifyUrl", kind: "text", label: "Lien de verification", sample: "https://badge.local/verify/DEMO-0001" },
  { name: "badge.qrCodeDataUrl", kind: "image", label: "QR code", assetSample: "assets/qr-demo.png" },
];

// Les quatre variantes du studio v1, devenues des presets du manifeste.
export const V1_PRESETS = [
  { label: "Sans photo", values: { "participant.photoDataUrl": "" } },
  { label: "Categorie anonyme", values: { "category.anonymous": true } },
  { label: "Badge neutre", values: { "category.neutralBadge": true, "category.anonymous": false } },
  {
    label: "Textes tres longs",
    values: {
      "participant.firstName": "Marie-Christine Elisabeth",
      "participant.lastName": "Ouedraogo-Zoungrana Kabore Sawadogo",
      "participant.structure":
        "Direction generale de la cooperation internationale et des partenariats institutionnels",
      "event.title":
        "Forum international sur la transformation numerique des administrations publiques",
      "category.name": "Delegation officielle accompagnante",
    },
  },
];

type AnyBlock = Record<string, unknown>;

// L'appelant ne transmet que des conditions presentes (visibleIf defini).
function migrateConditions(visibleIf: unknown): unknown {
  const list = Array.isArray(visibleIf) ? visibleIf : [visibleIf];
  const migrated = list.map((condition) => {
    const { path, ...rest } = condition as { path: string };
    return { variable: path, ...rest };
  });
  return Array.isArray(visibleIf) ? migrated : migrated[0];
}

function migrateBlock(block: AnyBlock, notes: string[]): AnyBlock {
  const out: AnyBlock = { ...block };

  if (out.visibleIf !== undefined) out.visibleIf = migrateConditions(out.visibleIf);

  // Le type `qr` a disparu : un QR est desormais une image posee dans une forme.
  // `rect` plutot que `square` : un carre exigerait w === h, ce que le bloc d'origine
  // ne garantit pas.
  if (out.type === "qr") {
    out.type = "rect";
    out.image = { source: "badge.qrCodeDataUrl", fit: "contain" };
    notes.push(`bloc qr converti en rect portant l'image "badge.qrCodeDataUrl"`);
  }

  if (Array.isArray(out.blocks)) {
    out.blocks = (out.blocks as AnyBlock[]).map((child) => migrateBlock(child, notes));
  }
  return out;
}

export function migrateManifest(
  input: unknown,
  entries: string[],
): { manifest: unknown; notes: string[] } {
  const source = input as { formatVersion?: unknown; blocks?: unknown };
  if (source?.formatVersion !== 1) {
    throw new Error("migrateManifest : ce manifeste n'est pas en v1.");
  }

  const notes: string[] = [];
  const variables = V1_VARIABLES.map(({ assetSample, ...variable }) => {
    if (!assetSample) return variable;
    if (entries.includes(assetSample)) return { ...variable, sample: assetSample };
    notes.push(`variable "${variable.name}" : aucun sample, "${assetSample}" absent du paquet`);
    return variable;
  });

  const blocks = (source.blocks as AnyBlock[]).map((block) => migrateBlock(block, notes));
  notes.push("formatVersion passe de 1 a 2");

  const rest = Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(
      ([key]) => key !== "formatVersion" && key !== "blocks",
    ),
  );
  return {
    manifest: { formatVersion: 2, ...rest, variables, presets: V1_PRESETS, blocks },
    notes,
  };
}
