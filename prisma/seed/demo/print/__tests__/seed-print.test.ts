import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import { unreadByRequest } from "@/lib/print-requests/read-state";
import type { PrintRequestStatus } from "@prisma/client";
import { DEMO_SLUG_PREFIX } from "../../../constants";
import type { DemoContext } from "../../context";
import { cleanupPrint, seedPrint } from "../../print";
import { PRINT_ACTIVITY_TYPES } from "../helpers";
import { buildWorld, disposeWorld } from "./helpers";

const STATUSES: PrintRequestStatus[] = [
  "DRAFT", "SUBMITTED", "QUOTED", "ACCEPTED", "PAID", "IN_PRODUCTION", "READY", "COMPLETED", "CANCELLED", "REJECTED",
];

async function counts() {
  const demoOrgs = { org: { slug: { startsWith: DEMO_SLUG_PREFIX } } };
  return {
    requests: await prisma.printRequest.count({ where: demoOrgs }),
    messages: await prisma.printRequestMessage.count({ where: { request: demoOrgs } }),
    products: await prisma.printProduct.count({ where: { slug: { startsWith: "demo-" } } }),
    layouts: await prisma.printSheetLayout.count({ where: { name: { startsWith: "Démo " } } }),
    payments: await prisma.payment.count({ where: { purpose: "PRINT_REQUEST" } }),
    notifications: await prisma.notification.count({ where: { type: { in: ["PRINT_REQUEST_SUBMITTED", "PRINT_REQUEST_QUOTED", "PRINT_REQUEST_MESSAGE", "PRINT_REQUEST_STATUS_CHANGED"] } } }),
    logs: await prisma.activityLog.count({ where: { type: { in: [...PRINT_ACTIVITY_TYPES] } } }),
  };
}

describe("seedPrint de bout en bout", () => {
  let ctx: DemoContext;

  afterEach(async () => {
    await cleanupPrint(ctx);
    await disposeWorld(ctx);
  });

  it("couvre les statuts, les fichiers, les notifications et le journal, et se rejoue a l'identique", async () => {
    ctx = await buildWorld(0.05);
    ctx.faker.seed(4242);
    await seedPrint(ctx);
    const demoOrgs = { org: { slug: { startsWith: DEMO_SLUG_PREFIX } } };

    const requests = await prisma.printRequest.findMany({ where: demoOrgs, include: { messages: true, org: true } });
    for (const status of STATUSES) expect(requests.some((r) => r.status === status), status).toBe(true);
    expect(new Set(requests.map((r) => r.type))).toEqual(new Set(["ADVANCE", "ONSITE"]));

    // Aucun non-lu organisateur ne compte de note interne.
    const showcase = requests.filter((r) => r.messages.some((m) => m.internal));
    expect(showcase.length).toBeGreaterThan(0);
    for (const r of showcase) {
      const owner = (await prisma.orgMembership.findFirst({ where: { orgId: r.orgId, role: "OWNER" } }))!;
      const read = await prisma.printRequestRead.findUnique({ where: { requestId_userId: { requestId: r.id, userId: owner.userId } } });
      const expected = r.messages.filter(
        (m) => !m.internal && m.authorId !== owner.userId && (!read || m.createdAt > read.lastReadAt),
      ).length;
      const counted = (await unreadByRequest(owner.userId, "ORGANIZER", [r.id]))[r.id];
      expect(counted, r.reference).toBe(expected);
    }

    // Chaque fichier reference existe.
    const keys = new Set<string>();
    for (const m of await prisma.printRequestMessage.findMany({ where: { request: demoOrgs, attachmentKey: { not: null } }, select: { attachmentKey: true } })) keys.add(m.attachmentKey!);
    for (const i of await prisma.printProductImage.findMany({ where: { product: { slug: { startsWith: "demo-" } } }, select: { storageKey: true } })) keys.add(i.storageKey);
    for (const g of await prisma.printSheetGeneration.findMany({ where: { event: { organization: { slug: { startsWith: DEMO_SLUG_PREFIX } } }, fileKey: { not: null } }, select: { fileKey: true } })) keys.add(g.fileKey!);
    expect(keys.size).toBeGreaterThan(0);
    for (const key of keys) await expect(getFile(key), key).resolves.toBeDefined();

    // Notifications : types, lus/non lus, scopes, liens vers une commande existante.
    const notifications = await prisma.notification.findMany({
      where: { type: { in: ["PRINT_REQUEST_SUBMITTED", "PRINT_REQUEST_QUOTED", "PRINT_REQUEST_MESSAGE", "PRINT_REQUEST_STATUS_CHANGED"] } },
    });
    for (const type of ["PRINT_REQUEST_SUBMITTED", "PRINT_REQUEST_QUOTED", "PRINT_REQUEST_MESSAGE", "PRINT_REQUEST_STATUS_CHANGED"]) {
      expect(notifications.some((n) => n.type === type), type).toBe(true);
    }
    expect(notifications.some((n) => n.readAt)).toBe(true);
    expect(notifications.some((n) => !n.readAt)).toBe(true);
    expect(new Set(notifications.map((n) => n.scope))).toEqual(new Set(["PLATFORM", "EVENT"]));
    const ids = new Set(requests.map((r) => r.id));
    for (const n of notifications.filter((x) => x.orgId && requests.some((r) => r.orgId === x.orgId))) {
      const id = n.href!.split("/").pop()!;
      expect(ids.has(id), n.href!).toBe(true);
      expect(n.createdAt.getTime()).toBeLessThanOrEqual(ctx.dates.now.getTime());
    }

    // Journal d'activite : chaque type du domaine, jamais dans le futur.
    const logs = await prisma.activityLog.findMany({ where: { type: { in: [...PRINT_ACTIVITY_TYPES] } } });
    const logTypes = new Set(logs.map((l) => l.type));
    for (const type of [
      "PRINT_REQUEST_SUBMITTED", "PRINT_REQUEST_QUOTED", "PRINT_REQUEST_ACCEPTED", "PRINT_REQUEST_STATUS_CHANGED",
      "PRINT_REQUEST_CANCELLED", "PRINT_REQUEST_REJECTED", "PRINT_REQUEST_MARKED_PAID", "PRINT_CREDIT_APPLIED",
      "PRINT_CREDIT_EARNED", "PRINT_REQUEST_SUPPLEMENT_CREATED", "PRINT_SHEETS_GENERATED", "PRINT_PRODUCT_CREATED",
      "PRINT_PRODUCT_UPDATED", "PRINT_PRODUCT_ARCHIVED", "PRINT_LAYOUT_CREATED", "PRINT_LAYOUT_ARCHIVED",
    ]) expect(logTypes.has(type as never), type).toBe(true);
    for (const l of logs) expect(l.createdAt.getTime(), l.type).toBeLessThanOrEqual(ctx.dates.now.getTime());

    // Aucun job du module ne peut partir.
    const jobs = await prisma.job.findMany({ where: { kind: { startsWith: "notification.print_request" }, status: "PENDING" } });
    for (const j of jobs) expect(j.runAt.getTime(), j.kind).toBeGreaterThan(ctx.dates.now.getTime());

    // Rejeu sans cumul : structure identique ; les volumes aleatoires (graine decalee par l'etat du
    // monde de test) restent a quelques pourcents. L'identite stricte se verifie sur un monde recree
    // (make db-seed-demo deux fois).
    const first = await counts();
    ctx.faker.seed(4242);
    await seedPrint(ctx);
    const second = await counts();
    expect(second.products).toBe(first.products);
    expect(second.layouts).toBe(first.layouts);
    expect(Math.abs(second.requests - first.requests)).toBeLessThanOrEqual(2);
    for (const key of ["messages", "payments", "notifications", "logs"] as const) {
      expect(Math.abs(second[key] - first[key]) / first[key], key).toBeLessThan(0.15);
    }
  }, 900_000);
});
