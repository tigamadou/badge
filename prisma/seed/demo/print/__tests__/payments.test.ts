import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getOrgPrintCreditBalance, listOrgPrintCreditMovements } from "@/lib/print-requests/org-credit";
import { onsiteCap } from "@/lib/print-requests/onsite-counter";
import type { PaymentStatus } from "@prisma/client";
import type { DemoContext } from "../../context";
import { seedCatalog } from "../catalog";
import { createPrintState } from "../helpers";
import { seedShowcaseOrders } from "../orders";
import { buildWorld, disposeWorld } from "./helpers";

const STATUSES: PaymentStatus[] = ["PENDING", "APPROVED", "DECLINED", "CANCELED", "EXPIRED"];

describe("paiements, credits et impression sur place", () => {
  let ctx: DemoContext;

  afterEach(async () => {
    await disposeWorld(ctx);
  });

  it("simule les paiements de commande, les credits et les impressions sur place", async () => {
    ctx = await buildWorld();
    const state = createPrintState(ctx);
    await seedCatalog(ctx, state);
    await seedShowcaseOrders(ctx, state);

    const payments = await prisma.payment.findMany({ where: { purpose: "PRINT_REQUEST" } });
    for (const status of STATUSES) expect(payments.some((p) => p.status === status), status).toBe(true);
    for (const p of payments) {
      expect(p.planId).toBeNull();
      expect(p.printRequestId).not.toBeNull();
      expect(p.fedapayTransactionId).toBeGreaterThanOrEqual(920_000_000);
      expect(p.fedapayTransactionId).toBeLessThanOrEqual(929_999_999);
    }
    expect(new Set(payments.map((p) => p.fedapayTransactionId)).size).toBe(payments.length);

    const requests = await prisma.printRequest.findMany({ include: { messages: true, lines: true } });
    const paidStatuses = ["PAID", "IN_PRODUCTION", "READY", "COMPLETED"];
    let offline = 0;
    let byCredit = 0;
    for (const r of requests.filter((x) => paidStatuses.includes(x.status))) {
      expect(r.paidAt, r.reference).not.toBeNull();
      const received = r.messages.find((m) => m.eventType === "PAYMENT_RECEIVED");
      expect(received, r.reference).toBeDefined();
      const details = received!.details as { reason?: string; byCredit?: boolean };
      if (r.paidPaymentId) {
        const payment = payments.find((p) => p.id === r.paidPaymentId)!;
        expect(payment.status).toBe("APPROVED");
        expect(payment.amount).toBe(r.acceptedTotal);
        expect(payment.approvedAt!.getTime()).toBeLessThanOrEqual(r.paidAt!.getTime());
      } else if (details.byCredit) {
        byCredit++;
        expect(r.acceptedTotal).toBe(0);
        expect(payments.some((p) => p.printRequestId === r.id)).toBe(false);
      } else {
        offline++;
        expect(details.reason).toBeTruthy();
      }
    }
    expect(offline).toBeGreaterThan(0);
    expect(byCredit).toBeGreaterThan(0);

    const failed = requests.find((r) => r.status === "ACCEPTED" && payments.some((p) => p.printRequestId === r.id && p.status === "DECLINED"));
    expect(failed?.messages.some((m) => m.eventType === "PAYMENT_FAILED")).toBe(true);

    // Credits : mouvements EARNED et SPENT, solde = somme.
    const credits = await prisma.orgPrintCredit.findMany();
    const earned = credits.filter((c) => c.kind === "EARNED");
    const spent = credits.filter((c) => c.kind === "SPENT");
    expect(earned.length).toBeGreaterThan(0);
    expect(spent.length).toBeGreaterThan(0);
    for (const c of earned) {
      expect(c.amount).toBeGreaterThan(0);
      expect(c.quantity).toBeGreaterThan(0);
      expect(c.unitPrice).toBeGreaterThan(0);
    }
    for (const c of spent) expect(c.amount).toBeLessThan(0);
    for (const orgId of new Set(credits.map((c) => c.orgId))) {
      const sum = credits.filter((c) => c.orgId === orgId).reduce((acc, c) => acc + c.amount, 0);
      expect(await getOrgPrintCreditBalance(orgId)).toBe(sum);
      expect((await listOrgPrintCreditMovements(orgId)).length).toBe(credits.filter((c) => c.orgId === orgId).length);
    }
    expect(new Set(credits.map((c) => `${c.requestId}|${c.kind}`)).size).toBe(credits.length);

    // Impression sur place : plafond respecte, reimpressions presentes.
    const prints = await prisma.printRequestPrint.findMany();
    expect(prints.some((p) => p.reprint)).toBe(true);
    for (const r of requests.filter((x) => x.type === "ONSITE")) {
      const own = prints.filter((p) => p.requestId === r.id && !p.reprint);
      if (own.length === 0) continue;
      const badge = r.lines.find((l) => l.kind === "PRODUCT" && l.removedAt === null)!;
      expect(own.length, r.reference).toBeLessThanOrEqual(onsiteCap(badge.quantity, r.marginPercent ?? 0));
    }
    expect(requests.some((r) => r.type === "ONSITE" && r.parentRequestId !== null)).toBe(true);
    const printed = await prisma.registration.count({ where: { id: { in: prints.map((p) => p.registrationId!) }, badgePrinted: true } });
    expect(printed).toBeGreaterThan(0);

    const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    expect((settings.onsitePrintTemplateIds as string[]).length).toBeGreaterThan(0);
    expect(settings.onsitePrinterNote).toBeTruthy();
  }, 600_000);
});
