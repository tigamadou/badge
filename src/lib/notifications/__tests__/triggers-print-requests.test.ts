import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/jobs/enqueue-email";
import {
  notifyPrintPaymentUnmatched,
  notifyPrintRequestMessage,
  notifyPrintRequestPaid,
  notifyPrintRequestQuoted,
  notifyPrintRequestStatusChanged,
  notifyPrintRequestSubmitted,
} from "../triggers";
import { addOrgMember, makeUser, seedTeam } from "./helpers";

vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/enqueue-email")>()),
  enqueueEmail: vi.fn(async () => undefined),
}));

beforeEach(() => vi.mocked(enqueueEmail).mockClear());

const idsOf = async (type: string) =>
  (await prisma.notification.findMany({ where: { type: type as never } })).map((r) => r.userId).sort();

let refCounter = 0;
async function setup(over: { type?: "ADVANCE" | "ONSITE"; estimatedQuantity?: number } = {}) {
  const team = await seedTeam();
  const manager = await makeUser({ name: "Manager" });
  await addOrgMember(manager.id, team.org.id, "MANAGER");
  const staffAdmin = await makeUser({ staffRole: "STAFF_ADMIN" });
  const superAdmin = await makeUser({ staffRole: "SUPER_ADMIN" });
  const support = await makeUser({ staffRole: "STAFF_SUPPORT" });
  const observer = await makeUser({ staffRole: "STAFF_OBSERVER" });
  refCounter += 1;
  const request = await prisma.printRequest.create({
    data: {
      reference: `IMP-T4-${Date.now()}-${refCounter}`,
      eventId: team.event.id,
      orgId: team.org.id,
      type: over.type ?? "ADVANCE",
      status: "QUOTED",
      quoteVersion: 2,
      total: 90000,
      estimatedQuantity: over.estimatedQuantity ?? null,
    },
  });
  return { ...team, manager, staffAdmin, superAdmin, support, observer, request };
}

const sorted = (...ids: string[]) => [...ids].sort();

describe("notifyPrintRequestSubmitted", () => {
  it("notifie STAFF_ADMIN et SUPER_ADMIN, pas STAFF_SUPPORT, un email chacun", async () => {
    const t = await setup();
    await notifyPrintRequestSubmitted(t.request.id, t.owner.id);
    const staff = (await idsOf("PRINT_REQUEST_SUBMITTED")).filter((id) =>
      [t.staffAdmin.id, t.superAdmin.id, t.support.id, t.observer.id].includes(id),
    );
    expect(staff).toEqual(sorted(t.staffAdmin.id, t.superAdmin.id));
    const rows = await prisma.notification.findMany({
      where: { type: "PRINT_REQUEST_SUBMITTED", userId: t.staffAdmin.id },
    });
    expect(rows[0]).toMatchObject({ scope: "PLATFORM", href: `/platform/print/requests/${t.request.id}` });
    expect(vi.mocked(enqueueEmail).mock.calls.length).toBe((await idsOf("PRINT_REQUEST_SUBMITTED")).length);
  });

  it("demande sur place sans item : quantité estimée, puis 0", async () => {
    const a = await setup({ type: "ONSITE", estimatedQuantity: 30 });
    await notifyPrintRequestSubmitted(a.request.id, a.owner.id);
    const rowA = await prisma.notification.findFirstOrThrow({ where: { userId: a.staffAdmin.id } });
    expect(rowA.body).toContain("30 badges");
    const b = await setup({ type: "ONSITE" });
    await notifyPrintRequestSubmitted(b.request.id, b.owner.id);
    const rowB = await prisma.notification.findFirstOrThrow({ where: { userId: b.staffAdmin.id } });
    expect(rowB.body).toContain("0 badges");
  });
});

describe("notifyPrintRequestQuoted", () => {
  it("notifie OWNER, MANAGER et ADMIN d'évènement, pas l'OPERATOR", async () => {
    const t = await setup();
    await notifyPrintRequestQuoted(t.request.id, t.staffAdmin.id);
    const rows = await prisma.notification.findMany({ where: { type: "PRINT_REQUEST_QUOTED", eventId: t.event.id } });
    expect(rows.map((r) => r.userId).sort()).toEqual(sorted(t.owner.id, t.admin.id, t.manager.id));
    expect(rows[0]).toMatchObject({ scope: "EVENT", href: `/event/${t.event.id}/print/${t.request.id}` });
    expect(rows[0].body).toContain("v2");
    expect(vi.mocked(enqueueEmail)).toHaveBeenCalledTimes(3);
  });
});

describe("notifyPrintRequestMessage", () => {
  async function message(requestId: string, side: "ORGANIZER" | "STAFF" | "SYSTEM", authorId: string | null) {
    return prisma.printRequestMessage.create({
      data: { requestId, authorId, side, kind: "MESSAGE", body: "Bonjour" },
    });
  }

  it("message organisateur : staff STAFF_SUPPORT+, auteur exclu", async () => {
    const t = await setup();
    const m = await message(t.request.id, "ORGANIZER", t.owner.id);
    await notifyPrintRequestMessage(m.id, t.owner.id);
    const rows = await prisma.notification.findMany({ where: { type: "PRINT_REQUEST_MESSAGE" } });
    const ids = rows.map((r) => r.userId);
    for (const id of [t.staffAdmin.id, t.superAdmin.id, t.support.id]) expect(ids).toContain(id);
    for (const id of [t.observer.id, t.owner.id, t.admin.id]) expect(ids).not.toContain(id);
    expect(rows[0]).toMatchObject({ scope: "PLATFORM", href: `/platform/print/requests/${t.request.id}` });
    expect(rows[0].body).toBe("Owner : Bonjour");
    expect(vi.mocked(enqueueEmail)).toHaveBeenCalledTimes(rows.length);
  });

  it("message organisateur sans auteur connu : libellé générique", async () => {
    const t = await setup();
    const m = await message(t.request.id, "ORGANIZER", null);
    await notifyPrintRequestMessage(m.id, t.owner.id);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: t.support.id } });
    expect(row.body).toBe("L'organisateur : Bonjour");
  });

  it("message staff : administrateurs de l'évènement, auteur exclu", async () => {
    const t = await setup();
    const m = await message(t.request.id, "STAFF", t.staffAdmin.id);
    await notifyPrintRequestMessage(m.id, t.staffAdmin.id);
    const rows = await prisma.notification.findMany({ where: { type: "PRINT_REQUEST_MESSAGE", eventId: t.event.id } });
    expect(rows.map((r) => r.userId).sort()).toEqual(sorted(t.owner.id, t.admin.id, t.manager.id));
    expect(rows[0]).toMatchObject({ scope: "EVENT", href: `/event/${t.event.id}/print/${t.request.id}` });
  });

  it("message staff sans auteur connu : libellé générique", async () => {
    const t = await setup();
    const m = await message(t.request.id, "STAFF", null);
    await notifyPrintRequestMessage(m.id, t.staffAdmin.id);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: t.admin.id } });
    expect(row.body).toBe("Le staff : Bonjour");
  });

  it("message SYSTEM ou introuvable : rien", async () => {
    const t = await setup();
    const m = await message(t.request.id, "SYSTEM", null);
    await notifyPrintRequestMessage(m.id, t.owner.id);
    await notifyPrintRequestMessage("absent", t.owner.id);
    expect(await prisma.notification.count({ where: { eventId: t.event.id } })).toBe(0);
  });
});

describe("notifyPrintRequestStatusChanged", () => {
  it("organizer seul : aucune notification staff", async () => {
    const t = await setup();
    await notifyPrintRequestStatusChanged(t.request.id, t.staffAdmin.id, { organizer: true, staff: false });
    const ids = await idsOf("PRINT_REQUEST_STATUS_CHANGED");
    expect(ids).not.toContain(t.superAdmin.id);
    expect(ids).toEqual(expect.arrayContaining([t.owner.id, t.admin.id, t.manager.id]));
    expect(ids).not.toContain(t.staffAdmin.id);
    expect(vi.mocked(enqueueEmail)).toHaveBeenCalledTimes(ids.length);
  });

  it("staff seul : STAFF_ADMIN+, sans acteur", async () => {
    const t = await setup();
    await notifyPrintRequestStatusChanged(t.request.id, null, { organizer: false, staff: true });
    const ids = await idsOf("PRINT_REQUEST_STATUS_CHANGED");
    expect(ids).toEqual(expect.arrayContaining([t.staffAdmin.id, t.superAdmin.id]));
    expect(ids).not.toContain(t.support.id);
    expect(ids).not.toContain(t.owner.id);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: t.staffAdmin.id } });
    expect(row).toMatchObject({ scope: "PLATFORM", href: `/platform/print/requests/${t.request.id}` });
    expect(row.title).toContain("devis envoyé");
  });

  it("les deux côtés : chaque côté reçoit son lien", async () => {
    const t = await setup();
    await notifyPrintRequestStatusChanged(t.request.id, null, { organizer: true, staff: true });
    const org = await prisma.notification.findFirstOrThrow({ where: { userId: t.owner.id } });
    const staff = await prisma.notification.findFirstOrThrow({ where: { userId: t.staffAdmin.id } });
    expect(org.href).toBe(`/event/${t.event.id}/print/${t.request.id}`);
    expect(staff.href).toBe(`/platform/print/requests/${t.request.id}`);
  });
});

describe("demande supprimée", () => {
  it("aucune notification, aucune exception", async () => {
    const t = await setup();
    await prisma.printRequest.delete({ where: { id: t.request.id } });
    await expect(notifyPrintRequestSubmitted(t.request.id, t.owner.id)).resolves.toBeUndefined();
    await expect(notifyPrintRequestQuoted(t.request.id, t.owner.id)).resolves.toBeUndefined();
    await expect(
      notifyPrintRequestStatusChanged(t.request.id, null, { organizer: true, staff: true }),
    ).resolves.toBeUndefined();
    expect(await prisma.notification.count({ where: { eventId: t.event.id } })).toBe(0);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("notifyPrintRequestPaid / notifyPrintPaymentUnmatched", () => {
  it("paid : admin évènement et STAFF_ADMIN, montant accepté ; manual : texte du marquage hors ligne", async () => {
    const t = await setup();
    await prisma.printRequest.update({ where: { id: t.request.id }, data: { acceptedTotal: 80000 } });
    await notifyPrintRequestPaid(t.request.id, null);
    await notifyPrintRequestPaid(t.request.id, t.staffAdmin.id, { manual: true });
    const staff = await prisma.notification.findMany({
      where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: t.staffAdmin.id },
    });
    expect(staff.some((r) => r.body.includes("80"))).toBe(true);
    const manager = await prisma.notification.findMany({
      where: { type: "PRINT_REQUEST_STATUS_CHANGED", userId: t.manager.id },
    });
    expect(manager.some((r) => r.body.includes("marquée payée par l'équipe Badge"))).toBe(true);
    expect(manager[0].href).toBe(`/event/${t.event.id}/print/${t.request.id}`);
  });

  it("paid : repli sur total sans acceptedTotal ; demande inconnue sans effet", async () => {
    const t = await setup();
    await notifyPrintRequestPaid(t.request.id, null);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: t.staffAdmin.id } });
    expect(row.body).toContain("90");
    const before = await prisma.notification.count();
    await notifyPrintRequestPaid("inconnue", null);
    expect(await prisma.notification.count()).toBe(before);
  });

  it("unmatched : STAFF_ADMIN seul, montant du Payment ; données absentes sans effet", async () => {
    const t = await setup();
    const payment = await prisma.payment.create({
      data: {
        orgId: t.org.id, purpose: "PRINT_REQUEST", printRequestId: t.request.id, amount: 42000, status: "APPROVED",
      },
    });
    await notifyPrintPaymentUnmatched(t.request.id, payment.id);
    const rows = await prisma.notification.findMany({ where: { type: "PRINT_REQUEST_STATUS_CHANGED" } });
    const mine = rows.filter((r) => [t.staffAdmin.id, t.manager.id, t.owner.id].includes(r.userId));
    expect(mine.map((r) => r.userId)).toEqual([t.staffAdmin.id]);
    expect(mine[0].body).toContain("42");
    const before = await prisma.notification.count();
    await notifyPrintPaymentUnmatched(t.request.id, "inconnu");
    await notifyPrintPaymentUnmatched("inconnue", payment.id);
    expect(await prisma.notification.count()).toBe(before);
  });
});
