import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import { listThread } from "@/lib/print-requests/thread";
import { countOrdersWithUnread, unreadByRequest } from "@/lib/print-requests/read-state";
import type { DemoContext } from "../../context";
import { seedCatalog } from "../catalog";
import { conversationHooks, seedReadStates } from "../conversation";
import { createPrintState } from "../helpers";
import { seedShowcaseOrders } from "../orders";
import { buildWorld, disposeWorld } from "./helpers";

describe("conversations des commandes", () => {
  let ctx: DemoContext;

  afterEach(async () => {
    await disposeWorld(ctx);
  });

  it("ecrit des fils scenarises, des pieces jointes lisibles et des non-lus sans note interne cote organisateur", async () => {
    ctx = await buildWorld();
    const state = createPrintState(ctx);
    await seedCatalog(ctx, state);
    await seedShowcaseOrders(ctx, state, conversationHooks(ctx, state));
    await seedReadStates(ctx, state);

    const requests = await prisma.printRequest.findMany({ select: { id: true, status: true, eventId: true } });
    const messages = await prisma.printRequestMessage.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(messages.some((m) => m.kind === "MESSAGE" && m.side === "ORGANIZER")).toBe(true);
    expect(messages.some((m) => m.kind === "MESSAGE" && m.side === "STAFF")).toBe(true);
    expect(messages.some((m) => m.kind === "EVENT" && m.side === "SYSTEM")).toBe(true);
    for (const type of ["REGISTRATIONS_SKIPPED", "ORG_CREDIT_APPLIED", "TEMPLATE_CHANGED", "BADGES_CHANGED", "ONSITE_MARGIN_CHANGED"]) {
      expect(messages.some((m) => m.eventType === type), type).toBe(true);
    }
    expect(messages.find((m) => m.eventType === "ONSITE_MARGIN_CHANGED")?.internal).toBe(true);

    const organizerFiles = messages.filter((m) => m.attachmentKey && m.side === "ORGANIZER");
    const staffFiles = messages.filter((m) => m.attachmentKey && m.side === "STAFF");
    expect(organizerFiles.length).toBeGreaterThan(0);
    expect(staffFiles.length).toBeGreaterThan(0);
    for (const m of organizerFiles) {
      const eventId = requests.find((r) => r.id === m.requestId)!.eventId;
      expect(m.attachmentKey!.startsWith(`print-requests/${eventId}/`)).toBe(true);
      await expect(getFile(m.attachmentKey!)).resolves.toBeDefined();
    }
    for (const m of staffFiles) {
      expect(m.attachmentKey!.startsWith(`print-requests/staff/${m.requestId}/`)).toBe(true);
      await expect(getFile(m.attachmentKey!)).resolves.toBeDefined();
    }

    const notes = messages.filter((m) => m.internal);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((m) => m.side !== "ORGANIZER")).toBe(true);

    // Aucun echange sur un brouillon.
    const drafts = requests.filter((r) => r.status === "DRAFT").map((r) => r.id);
    expect(messages.filter((m) => drafts.includes(m.requestId))).toHaveLength(0);

    // Non-lus : plusieurs situations, jamais de note interne cote organisateur.
    const ids = requests.map((r) => r.id);
    const { staffAdmin } = state;
    const staffCounts = await unreadByRequest(staffAdmin.id, "STAFF", ids);
    const ownerOf = new Map([...state.showcase.values()].map((o) => [o.requestId, o.ownerId]));
    let someOrganizerUnread = false;
    let someFullyRead = false;
    let strictlyLess = false;
    for (const order of state.showcase.values()) {
      const request = requests.find((r) => r.id === order.requestId)!;
      if (request.status === "DRAFT") continue;
      const owner = ownerOf.get(order.requestId)!;
      const orgCount = (await unreadByRequest(owner, "ORGANIZER", [order.requestId]))[order.requestId];
      const staffCount = staffCounts[order.requestId];
      const thread = await listThread(order.requestId, "ORGANIZER");
      expect(thread.some((e) => e.internal)).toBe(false);
      const reads = await prisma.printRequestRead.findFirst({ where: { requestId: order.requestId, userId: owner } });
      const visible = messages.filter((m) => m.requestId === order.requestId && !m.internal && m.authorId !== owner);
      const expected = visible.filter((m) => !reads || m.createdAt > reads.lastReadAt).length;
      expect(orgCount, order.key).toBe(expected);
      if (orgCount > 0) someOrganizerUnread = true;
      if (orgCount === 0 && staffCount === 0) someFullyRead = true;
      const hasNote = messages.some((m) => m.requestId === order.requestId && m.internal);
      if (hasNote && orgCount < staffCount) strictlyLess = true;
    }
    expect(someOrganizerUnread).toBe(true);
    expect(someFullyRead).toBe(true);
    expect(strictlyLess).toBe(true);
    expect(Object.values(staffCounts).some((n) => n > 0)).toBe(true);

    const scoped = await countOrdersWithUnread(staffAdmin.id, "STAFF", {});
    expect(scoped).toBe(Object.entries(staffCounts).filter(([id, n]) => n > 0 && requests.find((r) => r.id === id)!.status !== "DRAFT").length);

    // Horodatages : ordre croissant strict par commande, jamais dans le futur.
    for (const id of ids) {
      const times = messages.filter((m) => m.requestId === id).map((m) => m.createdAt.getTime());
      expect(new Set(times).size).toBe(times.length);
      for (const t of times) expect(t).toBeLessThanOrEqual(ctx.dates.now.getTime());
    }
  }, 600_000);
});
