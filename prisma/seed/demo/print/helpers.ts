import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PrintProduct, PrintSheetLayout } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { getFile } from "../../../../src/lib/storage";
import { DEMO_DOMAIN, DEMO_SLUG_PREFIX } from "../../constants";
import type { DemoContext, DemoUser } from "../context";

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;

/** Prefixe des produits, des gabarits et des fichiers de demo hors cascade d'organisation. */
export const PRODUCT_SLUG_PREFIX = "demo-";
export const LAYOUT_NAME_PREFIX = "Démo ";

/** Plage des identifiants de transaction FedaPay de ce lot (2b a 910_000_000-919_999_999). */
export const FEDAPAY_ID_START = 920_000_000;
export const FEDAPAY_ID_END = 929_999_999;

export const PRINT_ACTIVITY_TYPES = [
  "PRINT_REQUEST_SUBMITTED", "PRINT_REQUEST_UPDATED", "PRINT_REQUEST_QUOTED", "PRINT_REQUEST_ACCEPTED",
  "PRINT_REQUEST_REOPENED", "PRINT_REQUEST_STATUS_CHANGED", "PRINT_REQUEST_CANCELLED", "PRINT_REQUEST_REJECTED",
  "PRINT_REQUEST_MARKED_PAID", "PRINT_REQUEST_MARGIN_RAISED", "PRINT_CREDIT_APPLIED", "PRINT_CREDIT_EARNED",
  "PRINT_REQUEST_SUPPLEMENT_CREATED", "PRINT_LAYOUT_CREATED", "PRINT_LAYOUT_UPDATED", "PRINT_LAYOUT_ARCHIVED",
  "PRINT_SHEETS_GENERATED", "PRINT_PRODUCT_CREATED", "PRINT_PRODUCT_UPDATED", "PRINT_PRODUCT_ARCHIVED",
] as const;

export const PRINT_NOTIFICATION_TYPES = [
  "PRINT_REQUEST_SUBMITTED", "PRINT_REQUEST_QUOTED", "PRINT_REQUEST_MESSAGE", "PRINT_REQUEST_STATUS_CHANGED",
] as const;

/** Etat local du module, partage entre les etapes (jamais passe de l'exterieur). */
export type PrintState = {
  startedAt: Date;
  staffAdmin: DemoUser;
  staffSupport: DemoUser;
  /** Acteur d'une action reservee a STAFF_ADMIN : le meme que staffAdmin, nomme pour la lisibilite. */
  products: { badge: PrintProduct[]; accessories: PrintProduct[] };
  layouts: PrintSheetLayout[];
  /** Proprietaire d'organisation (celui qui accepte les devis), cree au besoin. */
  owners: Map<string, DemoUser>;
  /** Inscriptions deja reservees par une commande, par evenement. */
  claimed: Map<string, Set<string>>;
  /** Prochain identifiant de transaction FedaPay simulee. */
  fedapaySeq: number;
  /** Cle de scenario -> identifiant de commande. */
  orders: Map<string, string>;
  /** Commandes vitrine : informations utiles aux etapes suivantes. */
  showcase: Map<string, ShowcaseOrder>;
  /** Numero du prochain fichier joint (nom `demo-<n>.<ext>`). */
  attachmentSeq: number;
};

export type ShowcaseOrder = {
  key: string;
  requestId: string;
  eventId: string;
  orgId: string;
  type: "ADVANCE" | "ONSITE";
  ownerId: string;
  window: { start: Date; end: Date };
};

function firstOf(list: DemoUser[], fallback: DemoUser[]): DemoUser {
  const user = list[0] ?? fallback[0];
  if (!user) throw new Error("Aucun compte staff de demo : seedAccounts doit s'executer avant seedPrint");
  return user;
}

export function createPrintState(ctx: DemoContext): PrintState {
  const { staff } = ctx.registry;
  const anyStaff = [...staff.SUPER_ADMIN, ...staff.STAFF_ADMIN, ...staff.STAFF_SUPPORT];
  return {
    startedAt: new Date(),
    staffAdmin: firstOf(staff.STAFF_ADMIN, anyStaff),
    staffSupport: firstOf(staff.STAFF_SUPPORT, anyStaff),
    products: { badge: [], accessories: [] },
    layouts: [],
    owners: new Map(),
    claimed: new Map(),
    fedapaySeq: FEDAPAY_ID_START,
    orders: new Map(),
    showcase: new Map(),
    attachmentSeq: 1,
  };
}

/** Supprime ce que ce lot a cree hors cascade d'organisation (produits, gabarits, journaux, notifications, jobs). */
export async function cleanupPrintData(): Promise<void> {
  const orgs = await prisma.organization.findMany({ where: { slug: { startsWith: DEMO_SLUG_PREFIX } }, select: { id: true } });
  const orgIds = orgs.map((o) => o.id);
  const events = await prisma.event.findMany({ where: { orgId: { in: orgIds } }, select: { id: true } });
  const eventIds = events.map((e) => e.id);

  const products = await prisma.printProduct.findMany({ where: { slug: { startsWith: PRODUCT_SLUG_PREFIX } }, select: { id: true } });
  const layouts = await prisma.printSheetLayout.findMany({ where: { name: { startsWith: LAYOUT_NAME_PREFIX } }, select: { id: true } });
  const generations = await prisma.printSheetGeneration.findMany({
    where: { OR: [{ eventId: { in: eventIds } }, { layoutId: { in: layouts.map((l) => l.id) } }] },
    select: { id: true },
  });
  const targets = [...products, ...layouts, ...generations].map((r) => r.id);

  await prisma.activityLog.deleteMany({
    where: {
      type: { in: [...PRINT_ACTIVITY_TYPES] },
      OR: [{ targetId: { in: targets } }, { orgId: { in: orgIds } }, { eventId: { in: eventIds } }],
    },
  });
  await prisma.notification.deleteMany({
    where: { type: { in: [...PRINT_NOTIFICATION_TYPES] }, OR: [{ orgId: { in: orgIds } }, { eventId: { in: eventIds } }] },
  });
  await prisma.job.deleteMany({
    where: {
      kind: { startsWith: "notification.print_request" },
      OR: [{ recipient: { endsWith: DEMO_DOMAIN } }, { runAt: { gt: new Date(Date.now() + 1000 * DAY_MS) } }],
    },
  });
  await prisma.printProduct.deleteMany({ where: { id: { in: products.map((p) => p.id) } } });
  await prisma.printSheetLayout.deleteMany({ where: { id: { in: layouts.map((l) => l.id) } } });
}

/** Petite image de la reserve du contexte (octets + type), la n-ieme en boucle. */
export async function pickPhoto(ctx: DemoContext, index: number): Promise<{ body: Buffer; contentType: string; ext: string }> {
  const key = ctx.images.photos[index % ctx.images.photos.length];
  const file = await getFile(key);
  return { body: file.body, contentType: file.contentType || "image/png", ext: "png" };
}

/** PDF minimal d'une ou plusieurs pages (dimensions en points). */
export async function makePdf(title: string, pages = 1, size: [number, number] = [420, 595]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage(size);
    page.drawText(title, { x: 24, y: size[1] - 48, size: 14, font, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`Page ${i} / ${pages}`, { x: 24, y: 24, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  }
  return Buffer.from(await doc.save());
}

/** Reporte a runAt lointain les jobs d'email crees depuis le debut de l'etape (le worker ne les prend jamais). */
export async function parkPrintJobs(ctx: DemoContext, state: PrintState): Promise<number> {
  void state;
  return ctx.parkJobs();
}

export const pick = <T,>(list: readonly T[], i: number): T => list[((i % list.length) + list.length) % list.length];
