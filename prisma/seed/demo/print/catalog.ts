import type { Prisma, PrintOptionType, PrintProduct } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import type { DemoContext } from "../context";
import { pickPhoto, type PrintState } from "./helpers";

type ValueSpec = { label: string; colorHex?: string; priceDelta?: number; image?: boolean; archived?: boolean };
type OptionSpec = {
  name: string;
  help?: string;
  type: PrintOptionType;
  required?: boolean;
  priceDelta?: number;
  maxLength?: number;
  archived?: boolean;
  values?: ValueSpec[];
};
type ProductSpec = {
  kind: "BADGE" | "ACCESSORY";
  slug: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  minQuantity: number;
  leadTimeDays: number | null;
  tiers: Array<[number, number]>;
  options: OptionSpec[];
  images: number;
  published: boolean;
  archived?: boolean;
};

const MATERIAL: OptionSpec = {
  name: "Matière",
  help: "Le support du badge. Les échantillons sont disponibles sur demande.",
  type: "CHOICE",
  required: true,
  values: [
    { label: "PVC rigide 0,76 mm", image: true },
    { label: "PVC souple 0,5 mm", priceDelta: -100 },
    { label: "Carton renforcé 350 g", priceDelta: -250 },
    { label: "Carton recyclé (fin de série)", archived: true },
  ],
};

const SPECS: ProductSpec[] = [
  {
    kind: "BADGE", slug: "demo-badge-standard", name: "Badge PVC standard", category: "Badges",
    description: "Badge nominatif au format carte, impression couleur recto, support PVC. Le choix le plus courant pour les congrès et les salons.",
    basePrice: 1200, minQuantity: 1, leadTimeDays: 5, published: true, images: 3,
    tiers: [[50, 1000], [200, 850], [1000, 700]],
    options: [
      MATERIAL,
      { name: "Finitions", help: "Plusieurs finitions peuvent être combinées.", type: "MULTI_CHOICE", values: [
        { label: "Pelliculage mat", priceDelta: 80 }, { label: "Vernis sélectif", priceDelta: 150 }, { label: "Coins arrondis", priceDelta: 40 } ] },
      { name: "Mention imprimée au verso", help: "Numéro d'urgence, consignes de sécurité…", type: "TEXT", maxLength: 60, priceDelta: 50 },
      { name: "Maquette complémentaire", help: "Fichier PDF ou image fourni par l'organisateur.", type: "FILE", priceDelta: 100 },
      { name: "Ancien gabarit de découpe", type: "CHOICE", archived: true, values: [{ label: "Découpe 90 × 60 mm" }] },
    ],
  },
  {
    kind: "BADGE", slug: "demo-badge-premium", name: "Badge premium PET-G", category: "Badges",
    description: "Badge haut de gamme en PET-G, impression recto-verso haute définition. Résiste à l'eau et à l'usure.",
    basePrice: 2200, minQuantity: 1, leadTimeDays: 7, published: true, images: 2,
    tiers: [[50, 1900], [200, 1600]],
    options: [
      { name: "Finition", type: "CHOICE", required: true, values: [
        { label: "Brillant" }, { label: "Satiné", priceDelta: 120 }, { label: "Soft touch", priceDelta: 200 } ] },
      { name: "Mention imprimée au verso", type: "TEXT", maxLength: 80, priceDelta: 60 },
    ],
  },
  {
    kind: "BADGE", slug: "demo-badge-cordon", name: "Badge avec cordon intégré", category: "Badges",
    description: "Badge livré avec son cordon tour de cou, prêt à porter. La couleur du cordon se choisit dans une palette.",
    basePrice: 1800, minQuantity: 1, leadTimeDays: 6, published: true, images: 1,
    tiers: [[100, 1500], [500, 1300]],
    options: [
      { name: "Couleur du cordon", type: "COLOR", required: true, values: [
        { label: "Bleu nuit", colorHex: "#1E3A8A" }, { label: "Rouge", colorHex: "#DC2626" },
        { label: "Vert", colorHex: "#16A34A" }, { label: "Noir", colorHex: "#111827" } ] },
      { name: "Répartition par taille de pochette", help: "La somme doit égaler la quantité commandée.", type: "QUANTITY_SPLIT", values: [
        { label: "Format carte" }, { label: "Format A6", priceDelta: 60 } ] },
    ],
  },
  {
    kind: "ACCESSORY", slug: "demo-accessoire-cordon", name: "Cordon tour de cou personnalisé", category: "Cordons",
    description: "Cordon polyester 15 mm avec mousqueton, impression du logo de l'évènement en une couleur.",
    basePrice: 450, minQuantity: 10, leadTimeDays: 8, published: true, images: 2,
    tiers: [[100, 380], [500, 320]],
    options: [
      { name: "Couleur", type: "COLOR", required: true, values: [
        { label: "Bleu", colorHex: "#2563EB" }, { label: "Blanc", colorHex: "#F9FAFB" }, { label: "Orange", colorHex: "#EA580C" } ] },
      { name: "Texte imprimé", type: "TEXT", maxLength: 40, priceDelta: 30 },
    ],
  },
  {
    kind: "ACCESSORY", slug: "demo-accessoire-porte-badge", name: "Porte-badge rigide transparent", category: "Porte-badges",
    description: "Étui rigide en polycarbonate, ouverture par le haut, protège le badge des plis.",
    basePrice: 350, minQuantity: 10, leadTimeDays: 3, published: true, images: 1,
    tiers: [[200, 300]],
    options: [{ name: "Orientation", type: "CHOICE", required: true, values: [{ label: "Portrait" }, { label: "Paysage" }] }],
  },
  {
    kind: "ACCESSORY", slug: "demo-accessoire-enrouleur", name: "Enrouleur à clip rétractable", category: "Porte-badges",
    description: "Enrouleur métallique avec clip ceinture. En cours de référencement, pas encore proposé.",
    basePrice: 700, minQuantity: 20, leadTimeDays: 10, published: false, images: 1,
    tiers: [],
    options: [],
  },
  {
    kind: "ACCESSORY", slug: "demo-accessoire-etui-cuir", name: "Étui cuir véritable", category: "Porte-badges",
    description: "Étui en cuir pleine fleur. Retiré du catalogue : le fournisseur a cessé son activité.",
    basePrice: 1500, minQuantity: 5, leadTimeDays: 14, published: false, archived: true, images: 1,
    tiers: [],
    options: [],
  },
];

async function writeImage(ctx: DemoContext, index: number): Promise<string> {
  const photo = await pickPhoto(ctx, index);
  const key = ctx.storage.key("platform", "print-products", `${ctx.faker.string.uuid()}.${photo.ext}`);
  return ctx.storage.put(key, photo.body, photo.contentType);
}

/** Catalogue de demo : trois supports BADGE, des accessoires (dont un non publie et un archive). Idempotent par le nettoyage. */
export async function seedCatalog(ctx: DemoContext, state: PrintState): Promise<void> {
  const base = await prisma.printProduct.aggregate({ _max: { position: true } });
  let position = (base._max.position ?? -1) + 1;
  let imageIndex = 0;
  const created: PrintProduct[] = [];

  for (const spec of SPECS) {
    const createdAt = ctx.dates.between(120, 400);
    const archivedAt = spec.archived ? ctx.dates.between(5, 60) : null;
    const images: Prisma.PrintProductImageCreateWithoutProductInput[] = [];
    for (let i = 0; i < spec.images; i++) {
      images.push({ storageKey: await writeImage(ctx, imageIndex++), alt: `${spec.name}, vue ${i + 1}`, position: i });
    }
    const options: Prisma.PrintProductOptionCreateWithoutProductInput[] = [];
    for (const [o, option] of spec.options.entries()) {
      const values: Prisma.PrintProductOptionValueCreateWithoutOptionInput[] = [];
      for (const [v, value] of (option.values ?? []).entries()) {
        values.push({
          label: value.label,
          colorHex: value.colorHex ?? null,
          imageKey: value.image ? await writeImage(ctx, imageIndex++) : null,
          priceDelta: value.priceDelta ?? 0,
          position: v,
          archived: value.archived ?? false,
          archivedAt: value.archived ? ctx.dates.between(5, 60) : null,
        });
      }
      options.push({
        name: option.name,
        help: option.help ?? null,
        type: option.type,
        required: option.required ?? false,
        priceDelta: option.priceDelta ?? 0,
        maxLength: option.maxLength ?? null,
        position: o,
        archived: option.archived ?? false,
        archivedAt: option.archived ? ctx.dates.between(5, 60) : null,
        values: { create: values },
      });
    }
    const product = await prisma.printProduct.create({
      data: {
        kind: spec.kind,
        slug: spec.slug,
        name: spec.name,
        category: spec.category,
        description: spec.description,
        basePrice: spec.basePrice,
        minQuantity: spec.minQuantity,
        leadTimeDays: spec.leadTimeDays,
        position: position++,
        published: spec.published,
        archived: spec.archived ?? false,
        archivedAt,
        createdById: state.staffAdmin.id,
        createdAt,
        images: { create: images },
        priceTiers: { create: spec.tiers.map(([minQuantity, unitPrice]) => ({ minQuantity, unitPrice })) },
        options: { create: options },
      },
    });
    created.push(product);
  }

  state.products.badge = created.filter((p) => p.kind === "BADGE" && p.published && !p.archived);
  state.products.accessories = created.filter((p) => p.kind === "ACCESSORY" && p.published && !p.archived);
}
