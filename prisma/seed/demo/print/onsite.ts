import type { PrintRequest } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { onsiteCap } from "../../../../src/lib/print-requests/onsite-counter";
import { findEffectiveTemplateRow, resolveEventTemplateId } from "../../../../src/lib/badge-templates/event-template-variables";
import type { DemoContext, DemoEvent } from "../context";
import { MINUTE_MS, type PrintState } from "./helpers";
import type { Scenario } from "./scenarios";

/**
 * Reglages de l'impression sur place : templates adaptes (ceux que les evenements de demo utilisent),
 * note de l'imprimeur et marge par defaut. Singleton mis a jour, donc idempotent.
 */
export async function ensureOnsiteSettings(ctx: DemoContext): Promise<string[]> {
  const ids = new Set<string>();
  for (const event of ctx.registry.events) {
    const templateId = await resolveEventTemplateId({ badgeTemplateId: event.badgeTemplateId, orgId: event.orgId });
    const row = await findEffectiveTemplateRow(templateId);
    if (row) ids.add(row.id);
  }
  const templateIds = [...ids];
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      onsitePrintTemplateIds: templateIds,
      onsitePrinterNote: "Imprimante thermique à sublimation : prévoir 20 minutes d'installation et un point d'eau à proximité.",
      onsiteDefaultMarginPercent: 10,
    },
    update: {
      onsitePrintTemplateIds: templateIds,
      onsitePrinterNote: "Imprimante thermique à sublimation : prévoir 20 minutes d'installation et un point d'eau à proximité.",
      onsiteDefaultMarginPercent: 10,
    },
  });
  return templateIds;
}

/** Nombre de badges a commander pour que le plafond tienne dans les inscriptions disponibles. */
export function orderedForCap(available: number, margin = 10, max = 18): number {
  let best = 1;
  for (let ordered = 1; ordered <= max; ordered++) {
    if (onsiteCap(ordered, margin) <= available) best = ordered;
  }
  return best;
}

/**
 * Impressions d'une commande sur place en production : premieres impressions dans la limite du plafond,
 * quelques reimpressions, `Registration.badgePrinted` mis a jour. Retourne le nombre de premieres impressions.
 */
export async function recordOnsitePrints(
  ctx: DemoContext,
  state: PrintState,
  event: DemoEvent,
  request: PrintRequest,
  s: Scenario,
): Promise<number> {
  const line = await prisma.printQuoteLine.findFirst({
    where: { requestId: request.id, removedAt: null, kind: "PRODUCT", product: { kind: "BADGE" } },
    orderBy: { position: "asc" },
    select: { quantity: true },
  });
  const ordered = line?.quantity ?? request.estimatedQuantity ?? 0;
  const cap = onsiteCap(ordered, request.marginPercent ?? 0);
  const registrations = await prisma.registration.findMany({
    where: { eventId: event.id, status: "APPROVED" },
    select: { id: true, badgePrinted: true },
    orderBy: { id: "asc" },
  });
  // Les inscriptions pas encore imprimees d'abord : une premiere impression en consomme une nouvelle.
  const pool = [...registrations.filter((r) => !r.badgePrinted), ...registrations.filter((r) => r.badgePrinted)];
  const ratio = s.onsite?.printedRatio ?? 0.5;
  const wanted = ratio > 1 ? cap : Math.round(ordered * ratio);
  const first = pool.slice(0, Math.max(0, Math.min(wanted, cap, pool.length)));

  const evStart = event.date.getTime();
  const evEnd = (event.endDate ?? new Date(evStart + 86_400_000)).getTime();
  const windowEnd = Math.min(evEnd, ctx.dates.now.getTime() - 10 * MINUTE_MS);
  const operator = ctx.registry.eventMembers.get(event.id)?.PRINTER[0] ?? state.staffSupport;
  const at = () => ctx.faker.date.between({ from: new Date(evStart), to: new Date(Math.max(evStart + MINUTE_MS, windowEnd)) });

  const rows = first.map((r) => ({ requestId: request.id, registrationId: r.id, printedById: operator.id, printedAt: at(), reprint: false }));
  const reprints = first
    .slice(0, Math.min(s.onsite?.reprints ?? 0, first.length))
    .map((r) => ({ requestId: request.id, registrationId: r.id, printedById: operator.id, printedAt: at(), reprint: true }));
  if (rows.length + reprints.length > 0) await prisma.printRequestPrint.createMany({ data: [...rows, ...reprints] });
  for (const r of rows) {
    await prisma.registration.updateMany({ where: { id: r.registrationId }, data: { badgePrinted: true, badgePrintedAt: r.printedAt } });
  }
  return first.length;
}
