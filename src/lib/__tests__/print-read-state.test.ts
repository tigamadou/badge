import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { countOrdersWithUnread, markRead, unreadByRequest } from "@/lib/print-requests/read-state";
import { makeEvent, makeOrg, makePrintMessage, makePrintOrder, makeStaff, makeUser } from "@/test/factories";

const T = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n));

async function seed() {
  const org = await makeOrg();
  const event = await makeEvent(org.id);
  const request = await makePrintOrder({ eventId: event.id, orgId: org.id });
  const organizer = await makeUser();
  const staff = await makeStaff("STAFF_ADMIN");
  return { org, event, request, organizer, staff };
}

describe("unreadByRequest", () => {
  it("liste vide : objet vide", async () => {
    expect(await unreadByRequest("u", "STAFF", [])).toEqual({});
  });

  it("jamais lu : tout compte, evenements systeme inclus ; une commande sans message vaut 0", async () => {
    const { request, org, event, organizer, staff } = await seed();
    const empty = await makePrintOrder({ eventId: event.id, orgId: org.id });
    await makePrintMessage({ requestId: request.id, authorId: staff.id, side: "STAFF" });
    await makePrintMessage({ requestId: request.id, kind: "EVENT" });
    expect(await unreadByRequest(organizer.id, "ORGANIZER", [request.id, empty.id])).toEqual({
      [request.id]: 2,
      [empty.id]: 0,
    });
  });

  it("lu puis nouveau message : seuls les posterieurs comptent", async () => {
    const { request, organizer, staff } = await seed();
    await makePrintMessage({ requestId: request.id, authorId: staff.id, side: "STAFF", createdAt: T(1) });
    await markRead(request.id, organizer.id, T(5));
    await makePrintMessage({ requestId: request.id, authorId: staff.id, side: "STAFF", createdAt: T(9) });
    expect((await unreadByRequest(organizer.id, "ORGANIZER", [request.id]))[request.id]).toBe(1);
  });

  it("mes propres messages sont exclus", async () => {
    const { request, organizer, staff } = await seed();
    await makePrintMessage({ requestId: request.id, authorId: organizer.id });
    await makePrintMessage({ requestId: request.id, authorId: staff.id, side: "STAFF" });
    expect((await unreadByRequest(organizer.id, "ORGANIZER", [request.id]))[request.id]).toBe(1);
  });

  it("note interne : non comptee pour l'organisateur, comptee pour le staff", async () => {
    const { request, organizer, staff } = await seed();
    const other = await makeStaff("STAFF_ADMIN");
    await makePrintMessage({ requestId: request.id, authorId: other.id, side: "STAFF", internal: true });
    expect((await unreadByRequest(organizer.id, "ORGANIZER", [request.id]))[request.id]).toBe(0);
    expect((await unreadByRequest(staff.id, "STAFF", [request.id]))[request.id]).toBe(1);
  });
});

describe("markRead", () => {
  it("cree puis ne recule jamais lastReadAt", async () => {
    const { request, organizer } = await seed();
    const get = () =>
      prisma.printRequestRead.findUniqueOrThrow({
        where: { requestId_userId: { requestId: request.id, userId: organizer.id } },
      });
    await markRead(request.id, organizer.id, T(10));
    expect((await get()).lastReadAt).toEqual(T(10));
    await markRead(request.id, organizer.id, T(3));
    expect((await get()).lastReadAt).toEqual(T(10));
    await markRead(request.id, organizer.id, T(20));
    expect((await get()).lastReadAt).toEqual(T(20));
  });

  it("sans date : maintenant", async () => {
    const { request, organizer } = await seed();
    const before = Date.now();
    await markRead(request.id, organizer.id);
    const row = await prisma.printRequestRead.findUniqueOrThrow({
      where: { requestId_userId: { requestId: request.id, userId: organizer.id } },
    });
    expect(row.lastReadAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});

describe("countOrdersWithUnread", () => {
  it("compte les commandes non brouillon avec non-lu, restreintes a l'evenement", async () => {
    const { request, org, event, staff, organizer } = await seed();
    const read = await makePrintOrder({ eventId: event.id, orgId: org.id });
    const draft = await makePrintOrder({ eventId: event.id, orgId: org.id, status: "DRAFT" });
    const otherEvent = await makeEvent(org.id);
    const elsewhere = await makePrintOrder({ eventId: otherEvent.id, orgId: org.id });
    for (const r of [request, read, draft, elsewhere]) {
      await makePrintMessage({ requestId: r.id, authorId: staff.id, side: "STAFF", createdAt: T(1) });
    }
    await markRead(read.id, organizer.id, T(2));
    expect(await countOrdersWithUnread(organizer.id, "ORGANIZER", { eventId: event.id })).toBe(1);
    expect(await countOrdersWithUnread(organizer.id, "ORGANIZER", {})).toBeGreaterThanOrEqual(2);
  });

  it("aucune commande : 0", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    expect(await countOrdersWithUnread("u", "STAFF", { eventId: event.id })).toBe(0);
  });
});
