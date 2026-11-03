import { hash } from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import { ensureReferenceTemplates, defaultTemplateId } from "../../src/lib/badge-templates/install";
import { DEFAULT_PLAN_NAME } from "../../src/lib/subscription";
import { readBadgeEnv } from "../../src/lib/badge-env";
import { seedSuperAdmin } from "../../src/lib/seed-super-admin";
import { DEMO_PASSWORD, DEV_SUPER_ADMIN_EMAIL } from "./constants";

// Gabarit d'impression cree par defaut (seed minimal).
const DEFAULT_LAYOUT_NAME = "A3 standard";

// Accessoires de la boutique d'impression (seed minimal). Prix en FCFA ; paliers
// [quantite minimale, prix unitaire]. Le porte-badge est un accessoire : le support de
// badge (PVC, carton) est le badge imprime lui-meme, produit de famille BADGE.
type AccessoryOptionSeed = {
  name: string;
  help?: string;
  type: "CHOICE" | "COLOR" | "TEXT" | "FILE";
  required?: boolean;
  priceDelta?: number;
  maxLength?: number;
  values?: Array<{ label: string; colorHex?: string; priceDelta?: number }>;
};
const ACCESSORY_SEEDS: Array<{
  slug: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  minQuantity: number;
  leadTimeDays: number;
  tiers: Array<[number, number]>;
  options: AccessoryOptionSeed[];
}> = [
  {
    slug: "porte-badge-souple",
    name: "Porte-badge souple",
    category: "Porte-badges",
    description: "Pochette transparente en PVC souple, fermeture zip, pour badge format carte.",
    basePrice: 200,
    minQuantity: 10,
    leadTimeDays: 2,
    tiers: [[100, 170], [500, 150]],
    options: [
      {
        name: "Format",
        type: "CHOICE",
        required: true,
        values: [{ label: "Carte (86 × 54 mm)" }, { label: "A6 (105 × 148 mm)", priceDelta: 50 }],
      },
      {
        name: "Sens",
        type: "CHOICE",
        required: true,
        values: [{ label: "Vertical" }, { label: "Horizontal" }],
      },
    ],
  },
  {
    slug: "porte-badge-rigide",
    name: "Porte-badge rigide",
    category: "Porte-badges",
    description: "Étui rigide transparent, protège le badge des plis et des projections.",
    basePrice: 500,
    minQuantity: 10,
    leadTimeDays: 3,
    tiers: [[100, 450], [500, 400]],
    options: [
      {
        name: "Sens",
        type: "CHOICE",
        required: true,
        values: [{ label: "Vertical" }, { label: "Horizontal" }],
      },
    ],
  },
  {
    slug: "cordon-tour-de-cou",
    name: "Cordon tour de cou",
    category: "Cordons",
    description: "Cordon polyester 15 mm avec mousqueton, attache de sécurité au niveau de la nuque.",
    basePrice: 500,
    minQuantity: 20,
    leadTimeDays: 7,
    tiers: [[100, 450], [500, 380]],
    options: [
      {
        name: "Couleur",
        type: "COLOR",
        required: true,
        values: [
          { label: "Noir", colorHex: "#111827" },
          { label: "Bleu", colorHex: "#1D4ED8" },
          { label: "Rouge", colorHex: "#DC2626" },
          { label: "Vert", colorHex: "#16A34A" },
          { label: "Blanc", colorHex: "#FFFFFF" },
        ],
      },
      {
        name: "Marquage",
        help: "Texte imprimé sur toute la longueur du cordon.",
        type: "TEXT",
        priceDelta: 150,
        maxLength: 40,
      },
      {
        name: "Logo",
        help: "Logo vectoriel (PDF ou PNG haute définition) imprimé sur le cordon.",
        type: "FILE",
        priceDelta: 200,
      },
    ],
  },
  {
    slug: "pince-crocodile",
    name: "Pince crocodile",
    category: "Fixations",
    description: "Pince métallique avec languette transparente, à fixer au vêtement.",
    basePrice: 150,
    minQuantity: 10,
    leadTimeDays: 2,
    tiers: [[100, 120]],
    options: [],
  },
  {
    slug: "enrouleur-de-badge",
    name: "Enrouleur de badge",
    category: "Fixations",
    description: "Enrouleur rétractable avec cordon de 60 cm et clip ceinture.",
    basePrice: 800,
    minQuantity: 10,
    leadTimeDays: 5,
    tiers: [[100, 700]],
    options: [
      {
        name: "Couleur",
        type: "COLOR",
        required: true,
        values: [
          { label: "Noir", colorHex: "#111827" },
          { label: "Blanc", colorHex: "#FFFFFF" },
          { label: "Bleu", colorHex: "#1D4ED8" },
        ],
      },
    ],
  },
];

type Env = Record<string, string | undefined>;

// Cree le SUPER_ADMIN et retourne son identifiant (null si aucun n'existe).
// Dev : admin@badge.local, mot de passe de demo ; ailleurs : variables SEED_SUPER_ADMIN_*.
async function ensureSuperAdmin(env: Env): Promise<string | null> {
  if (readBadgeEnv(env) === "dev") {
    const passwordHash = await hash(DEMO_PASSWORD, 12);
    const user = await prisma.user.upsert({
      where: { email: DEV_SUPER_ADMIN_EMAIL },
      create: {
        email: DEV_SUPER_ADMIN_EMAIL,
        password: passwordHash,
        name: "Super Admin",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
        emailVerifiedAt: new Date(),
      },
      update: {
        password: passwordHash,
        isStaff: true,
        staffRole: "SUPER_ADMIN",
        archived: false,
        archivedAt: null,
        emailVerifiedAt: new Date(),
      },
    });
    return user.id;
  }
  const result = await seedSuperAdmin(env);
  if (result.status === "created") console.log(`SUPER_ADMIN cree : ${result.email}`);
  else if (result.status === "exists") console.log("SUPER_ADMIN deja present, rien a faire");
  else console.warn(`Seed SUPER_ADMIN ignore : ${result.reason}`);
  const admin = await prisma.user.findFirst({
    where: { isStaff: true, staffRole: "SUPER_ADMIN", archived: false },
    select: { id: true },
  });
  return admin?.id ?? null;
}

export async function runMinimalSeed(env: Env = process.env): Promise<void> {
  // 1. PlatformSettings
  // Le SMTP est reecrit a chaque seed : les tests e2e et les essais manuels
  // dans l'UI plateforme peuvent l'avoir pointe ailleurs que sur mailpit.
  const platformSmtp = {
    smtpHost: process.env.PLATFORM_SMTP_HOST || "mailpit",
    smtpPort: parseInt(process.env.PLATFORM_SMTP_PORT || "1025", 10),
    smtpFrom: process.env.PLATFORM_SMTP_FROM || "noreply@badge.local",
    smtpUser: process.env.PLATFORM_SMTP_USER || "",
    smtpPassword: process.env.PLATFORM_SMTP_PASSWORD || "",
    smtpSecure: process.env.PLATFORM_SMTP_SECURE === "true",
  };
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      ...platformSmtp,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
      badgeTemplateId: "default-v1",
    },
    update: platformSmtp,
  });

  // 1b. Plans d'abonnement par defaut (v4). Upsert par nom (unique).
  // Le plan par defaut s'appelait « Gratuit » : on le renomme (abonnements conserves) plutot que
  // d'en creer un second, sauf si le nouveau nom existe deja (nom unique).
  if (!(await prisma.plan.findUnique({ where: { name: DEFAULT_PLAN_NAME } }))) {
    await prisma.plan.updateMany({ where: { name: "Gratuit" }, data: { name: DEFAULT_PLAN_NAME } });
  }
  await prisma.plan.upsert({
    where: { name: DEFAULT_PLAN_NAME },
    create: { name: DEFAULT_PLAN_NAME, maxEvents: 1, maxParticipantsPerEvent: 100 },
    update: {},
  });
  await prisma.plan.upsert({
    where: { name: "Standard" },
    create: { name: "Standard", maxEvents: 10, maxParticipantsPerEvent: 1000, price: 15000 },
    update: {},
  });
  // Prix de demo pour un Standard existant sans prix (ne touche pas un prix ajuste par le staff).
  await prisma.plan.updateMany({ where: { name: "Standard", price: null }, data: { price: 15000 } });
  console.log(`Plans par defaut (${DEFAULT_PLAN_NAME}, Standard) prets.`);

  // 1b'. Catalogue de motifs de rejet (v4 plan 08). Idempotent via findFirst sur le libelle.
  const rejectionReasonSeeds: Array<{
    label: string;
    scope: "PROFILE" | "REGISTRATION" | "BOTH";
    sortOrder: number;
  }> = [
    { label: "Photo illisible ou de mauvaise qualite", scope: "PROFILE", sortOrder: 10 },
    { label: "Photo non conforme (visage non visible)", scope: "PROFILE", sortOrder: 20 },
    { label: "Piece d'identite illisible", scope: "PROFILE", sortOrder: 30 },
    { label: "Piece d'identite expiree", scope: "PROFILE", sortOrder: 40 },
    { label: "Informations incoherentes entre la piece et le profil", scope: "PROFILE", sortOrder: 50 },
    { label: "Document suspecte de falsification", scope: "BOTH", sortOrder: 60 },
    { label: "Categorie demandee non justifiee", scope: "REGISTRATION", sortOrder: 70 },
    { label: "Quota de la categorie atteint", scope: "REGISTRATION", sortOrder: 80 },
    { label: "Inscription en doublon", scope: "REGISTRATION", sortOrder: 90 },
  ];
  for (const r of rejectionReasonSeeds) {
    const existing = await prisma.rejectionReason.findFirst({ where: { label: r.label } });
    if (!existing) {
      await prisma.rejectionReason.create({ data: r });
    }
  }
  console.log(`Motifs de rejet seedes : ${rejectionReasonSeeds.length}`);

  // 1c. Gabarit d'impression par defaut : A3 portrait, marges 10 mm, 5 mm entre les badges.
  // Longueurs en dixiemes de mm. Idempotent par nom ; un gabarit modifie par le staff est garde.
  await prisma.printSheetLayout.upsert({
    where: { name: DEFAULT_LAYOUT_NAME },
    create: {
      name: DEFAULT_LAYOUT_NAME,
      sheetWidth: 2970,
      sheetHeight: 4200,
      sheetOrientation: "PORTRAIT",
      marginTop: 100,
      marginRight: 100,
      marginBottom: 100,
      marginLeft: 100,
      gapHorizontal: 50,
      gapVertical: 50,
    },
    update: {},
  });
  console.log(`Gabarit d'impression par defaut (${DEFAULT_LAYOUT_NAME}) pret.`);

  // 1d. Accessoires de la boutique d'impression, publies. Idempotent par slug : un produit
  // deja present (eventuellement retouche par le staff) n'est pas modifie.
  let accessoriesCreated = 0;
  for (const [position, a] of ACCESSORY_SEEDS.entries()) {
    if (await prisma.printProduct.findUnique({ where: { slug: a.slug } })) continue;
    await prisma.printProduct.create({
      data: {
        kind: "ACCESSORY",
        slug: a.slug,
        name: a.name,
        category: a.category,
        description: a.description,
        basePrice: a.basePrice,
        minQuantity: a.minQuantity,
        leadTimeDays: a.leadTimeDays,
        position,
        published: true,
        priceTiers: { create: a.tiers.map(([minQuantity, unitPrice]) => ({ minQuantity, unitPrice })) },
        options: {
          create: a.options.map((o, i) => ({
            name: o.name,
            help: o.help,
            type: o.type,
            required: o.required ?? false,
            priceDelta: o.priceDelta ?? 0,
            maxLength: o.maxLength,
            position: i,
            values: {
              create: (o.values ?? []).map((v, j) => ({
                label: v.label,
                colorHex: v.colorHex,
                priceDelta: v.priceDelta ?? 0,
                position: j,
              })),
            },
          })),
        },
      },
    });
    accessoriesCreated++;
  }
  console.log(`Accessoires de la boutique : ${accessoriesCreated} crees, ${ACCESSORY_SEEDS.length} au catalogue.`);

  // 2. SUPER_ADMIN, puis templates de badge livres avec l'application (v4 plan 12). Ils ne
  // sont plus compiles : le seed les installe comme n'importe quel paquet, et porte la
  // garantie qu'un template par defaut existe. `installedById` est un champ nu (sans relation).
  const superAdminId = await ensureSuperAdmin(env);
  await ensureReferenceTemplates(superAdminId ?? "seed");
  const currentSettings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const pointsToExisting =
    currentSettings !== null &&
    (await prisma.installedBadgeTemplate.count({
      where: { id: currentSettings.badgeTemplateId },
    })) > 0;
  if (!pointsToExisting) {
    const fallback = await defaultTemplateId();
    if (fallback) {
      await prisma.platformSettings.update({
        where: { id: "singleton" },
        data: { badgeTemplateId: fallback },
      });
    }
  }
  console.log("Templates de badge de reference installes.");
}
