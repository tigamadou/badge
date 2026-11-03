import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import type { Prisma, PrintSheetGeneration, PrintSheetLayout } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { createGeneration } from "../../../../src/lib/print-sheets/generations";
import { computeSheetLayout } from "../../../../src/lib/print-sheets/compute-layout";
import { toLayoutSpec } from "../../../../src/lib/print-sheets/layout-input";
import { mmToPt, pxToMm, tenthsToMm } from "../../../../src/lib/print-sheets/units";
import { resolveEventTemplate } from "../../../../src/lib/badge-templates/render-badge";
import type { DemoContext, DemoEvent } from "../context";
import { LAYOUT_NAME_PREFIX, MINUTE_MS, makePdf, type PrintState } from "./helpers";
import type { ScenarioHooks, ScenarioRef } from "./orders";
import type { SheetState } from "./scenarios";

type LayoutSpecRow = Omit<Prisma.PrintSheetLayoutUncheckedCreateInput, "name" | "createdAt"> & { name: string; archivedDaysAgo?: number };

const LAYOUTS: LayoutSpecRow[] = [
  {
    name: `${LAYOUT_NAME_PREFIX}A4 portrait`, sheetWidth: 2100, sheetHeight: 2970, sheetOrientation: "PORTRAIT",
    marginTop: 100, marginRight: 100, marginBottom: 100, marginLeft: 100, gapHorizontal: 50, gapVertical: 50,
    badgeOrientation: "AUTO", duplexFlip: "LONG_EDGE", cropMarks: true,
  },
  {
    name: `${LAYOUT_NAME_PREFIX}A4 paysage`, sheetWidth: 2100, sheetHeight: 2970, sheetOrientation: "LANDSCAPE",
    marginTop: 80, marginRight: 80, marginBottom: 80, marginLeft: 80, gapHorizontal: 30, gapVertical: 30,
    badgeOrientation: "ORIGINAL", duplexFlip: "SHORT_EDGE", cropMarks: true,
  },
  {
    name: `${LAYOUT_NAME_PREFIX}A3 recto-verso`, sheetWidth: 2970, sheetHeight: 4200, sheetOrientation: "PORTRAIT",
    marginTop: 120, marginRight: 120, marginBottom: 120, marginLeft: 120, gapHorizontal: 0, gapVertical: 0,
    badgeOrientation: "ROTATED", duplexFlip: "SHORT_EDGE", cropMarks: false,
  },
  {
    name: `${LAYOUT_NAME_PREFIX}A5 (ancien format)`, sheetWidth: 1480, sheetHeight: 2100, sheetOrientation: "PORTRAIT",
    marginTop: 60, marginRight: 60, marginBottom: 60, marginLeft: 60, gapHorizontal: 40, gapVertical: 40,
    badgeOrientation: "AUTO", duplexFlip: "LONG_EDGE", cropMarks: true, archived: true, archivedDaysAgo: 20,
  },
];

export async function seedLayouts(ctx: DemoContext, state: PrintState): Promise<void> {
  const created: PrintSheetLayout[] = [];
  for (const spec of LAYOUTS) {
    const { archivedDaysAgo, ...data } = spec;
    created.push(
      await prisma.printSheetLayout.create({
        data: {
          ...data,
          createdById: state.staffAdmin.id,
          createdAt: ctx.dates.between(90, 200),
          archivedAt: archivedDaysAgo ? ctx.dates.daysAgo(archivedDaysAgo) : null,
        },
      }),
    );
  }
  state.layouts = created.filter((l) => !l.archived);
}

type Geometry = { perSheet: number; sheetMm: { width: number; height: number } };

async function badgeInfo(event: Pick<DemoEvent, "badgeTemplateId" | "orgId">) {
  const template = await resolveEventTemplate({ badgeTemplateId: event.badgeTemplateId, orgId: event.orgId });
  return {
    badgePages: (template.meta.pages === 2 ? 2 : 1) as 1 | 2,
    badgeMm: {
      width: pxToMm(parseFloat(template.meta.pageSize.width)),
      height: pxToMm(parseFloat(template.meta.pageSize.height)),
    },
  };
}

function geometry(layout: PrintSheetLayout, badgeMm: { width: number; height: number }): Geometry {
  const spec = toLayoutSpec(layout);
  const computed = computeSheetLayout(spec, { widthMm: badgeMm.width, heightMm: badgeMm.height });
  const landscape = layout.sheetOrientation === "LANDSCAPE";
  const w = tenthsToMm(layout.sheetWidth);
  const h = tenthsToMm(layout.sheetHeight);
  return { perSheet: computed.perSheet, sheetMm: landscape ? { width: h, height: w } : { width: w, height: h } };
}

async function sheetsPdf(title: string, sheetCount: number, duplex: boolean, geo: Geometry): Promise<Buffer> {
  return makePdf(title, sheetCount * (duplex ? 2 : 1), [mmToPt(geo.sheetMm.width), mmToPt(geo.sheetMm.height)]);
}

async function zipArchive(title: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("badge-1.pdf", await makePdf(`${title} (1)`, 1, [240, 150]));
  zip.file("badge-2.pdf", await makePdf(`${title} (2)`, 1, [240, 150]));
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

const ERROR_TEXT = "le badge n° 3 n'a pas le format attendu (le template a peut-être changé depuis la création)";

/** Fixe l'etat final d'une generation creee par createGeneration (PENDING) ; les dates sont recalees par retimeRequest. */
async function settleGeneration(
  ctx: DemoContext,
  generation: PrintSheetGeneration,
  layout: PrintSheetLayout,
  state: SheetState,
  info: Awaited<ReturnType<typeof badgeInfo>>,
  fileKey: string,
): Promise<void> {
  const geo = geometry(layout, info.badgeMm);
  const count = generation.badgeCount ?? 0;
  const sheetCount = Math.max(1, Math.ceil(count / geo.perSheet));
  const now = ctx.dates.now;
  if (state === "DONE") {
    await ctx.storage.putAt(fileKey, await sheetsPdf("Planche de démonstration", sheetCount, generation.duplex, geo), "application/pdf");
    await prisma.printSheetGeneration.update({
      where: { id: generation.id },
      data: { status: "DONE", attempts: 1, sheetCount, fileKey, startedAt: now, completedAt: now },
    });
  } else if (state === "FAILED") {
    await prisma.printSheetGeneration.update({
      where: { id: generation.id },
      data: { status: "FAILED", attempts: 3, error: ERROR_TEXT, startedAt: now, completedAt: now },
    });
  } else if (state === "RUNNING") {
    await prisma.printSheetGeneration.update({
      where: { id: generation.id },
      data: { status: "RUNNING", attempts: 1, lockedBy: "worker-demo", heartbeatAt: now, startedAt: now },
    });
  }
}

/** Planche d'une commande payee, creee par le domaine (createGeneration) puis amenee a l'etat voulu. */
export async function generateForOrder(ctx: DemoContext, state: PrintState, ref: ScenarioRef): Promise<void> {
  const wanted = ref.scenario.sheet;
  if (!wanted || ref.scenario.type !== "ADVANCE") return;
  const layout = state.layouts[state.orders.size % state.layouts.length];
  const generation = await createGeneration({
    eventId: ref.event.id,
    layoutId: layout.id,
    selection: { mode: "REQUEST" },
    duplex: false,
    userId: ref.staff.id,
    printRequestId: ref.requestId,
  });
  const info = await badgeInfo({ badgeTemplateId: ref.event.badgeTemplateId, orgId: ref.event.orgId });
  await settleGeneration(ctx, generation, layout, wanted, info, `print-sheets/orders/${ref.requestId}.pdf`);
}

export function sheetHooks(ctx: DemoContext, state: PrintState): ScenarioHooks {
  return { paid: (ref) => generateForOrder(ctx, state, ref) };
}

type FreeSpec = { status: SheetState; output: "SHEETS" | "ZIP"; layout: number; duplex?: boolean; huge?: boolean; daysAgo: number };

const FREE: FreeSpec[] = [
  { status: "DONE", output: "SHEETS", layout: 0, daysAgo: 12 },
  { status: "DONE", output: "SHEETS", layout: 2, duplex: true, huge: true, daysAgo: 6 },
  { status: "DONE", output: "SHEETS", layout: 1, daysAgo: 3 },
  { status: "FAILED", output: "SHEETS", layout: 1, daysAgo: 4 },
  { status: "PENDING", output: "SHEETS", layout: 0, daysAgo: 0 },
  { status: "RUNNING", output: "SHEETS", layout: 0, daysAgo: 0 },
  { status: "DONE", output: "ZIP", layout: 0, daysAgo: 8 },
];

/** Generations libres (hors commande) et archive ZIP, a tous les etats. */
export async function seedFreeGenerations(ctx: DemoContext, state: PrintState): Promise<void> {
  const events = ctx.registry.events.filter((e) => !e.archived);
  const orgsHuge = new Set(ctx.registry.orgsBySize.huge.map((o) => o.id));
  const withApproved = events
    .map((event) => ({ event, regs: ctx.registry.registrations.get(event.id)?.APPROVED ?? [] }))
    .filter((e) => e.regs.length > 0);
  const hugeCandidate = withApproved.find((e) => orgsHuge.has(e.event.orgId) && e.event.phase === "ongoing") ?? withApproved[0];
  if (!hugeCandidate) return;

  for (const [i, spec] of FREE.entries()) {
    const picked = spec.huge ? hugeCandidate : withApproved[(i * 3) % withApproved.length];
    const { event, regs } = picked;
    const layout = state.layouts[spec.layout % state.layouts.length];
    const ids = regs.slice(0, Math.min(regs.length, 6 + i)).map((r) => r.id);
    const rejected = ctx.registry.registrations.get(event.id)?.REJECTED ?? [];
    const info = await badgeInfo(event);
    const createdAt = spec.daysAgo === 0 ? new Date(ctx.dates.now.getTime() - 5 * MINUTE_MS) : ctx.dates.daysAgo(spec.daysAgo, 10 + (i % 6));
    const finished = new Date(createdAt.getTime() + 3 * MINUTE_MS);
    const isZip = spec.output === "ZIP";
    const duplex = !isZip && (spec.duplex ?? false) && info.badgePages === 2;
    const geo = isZip ? null : geometry(layout, info.badgeMm);
    const spec2 = toLayoutSpec(layout);

    const created = await prisma.printSheetGeneration.create({
      data: {
        output: spec.output,
        eventId: event.id,
        layoutId: isZip ? null : layout.id,
        layoutSnapshot: isZip ? undefined : ({ spec: spec2, badgeMm: info.badgeMm, badgePages: info.badgePages } as unknown as Prisma.InputJsonValue),
        duplex,
        registrationIds: ids,
        badgeCount: ids.length,
        status: spec.status,
        attempts: spec.status === "PENDING" ? 0 : spec.status === "FAILED" ? 3 : 1,
        lockedBy: spec.status === "RUNNING" ? "worker-demo" : null,
        heartbeatAt: spec.status === "RUNNING" ? ctx.dates.now : null,
        startedAt: spec.status === "PENDING" ? null : createdAt,
        completedAt: spec.status === "DONE" || spec.status === "FAILED" ? finished : null,
        error: spec.status === "FAILED" ? ERROR_TEXT : null,
        skippedIds: spec.status === "DONE" && !isZip && rejected[0] ? [rejected[0].id] : undefined,
        createdById: i % 2 === 0 ? state.staffAdmin.id : state.staffSupport.id,
        createdAt,
      },
    });
    if (spec.status !== "DONE") continue;
    if (isZip) {
      const key = `badge-exports/${event.id}/${created.id}.zip`;
      await ctx.storage.putAt(key, await zipArchive("Export de démonstration"), "application/zip");
      await prisma.printSheetGeneration.update({ where: { id: created.id }, data: { fileKey: key } });
    } else {
      const sheetCount = Math.max(1, Math.ceil(ids.length / geo!.perSheet));
      const key = `print-sheets/${created.id}.pdf`;
      await ctx.storage.putAt(key, await sheetsPdf("Planche de démonstration", sheetCount, duplex, geo!), "application/pdf");
      await prisma.printSheetGeneration.update({ where: { id: created.id }, data: { fileKey: key, sheetCount } });
    }
  }
}

export async function seedSheets(ctx: DemoContext, state: PrintState): Promise<void> {
  await seedFreeGenerations(ctx, state);
}

export async function pdfPageCount(body: Buffer): Promise<number> {
  return (await PDFDocument.load(body)).getPageCount();
}
