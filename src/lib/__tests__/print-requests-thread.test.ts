import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { formatFcfa, PRINT_REQUEST_STATUS_LABELS } from "@/lib/print-requests/labels";
import {
  PrintRequestError,
  printRequestErrorResponse,
  PRINT_REQUEST_ERROR_MESSAGES,
  type PrintRequestErrorCode,
} from "@/lib/print-requests/errors";
import {
  appendThreadEvent,
  describeLineChange,
  describeThreadEvent,
  listThread,
  postMessage,
  type LineChange,
  type ThreadEventType,
} from "@/lib/print-requests/thread";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function seed(status: "SUBMITTED" | "COMPLETED" | "REJECTED" | "CANCELLED" = "SUBMITTED") {
  const u = uniq();
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${u}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${u}`, location: "L", date: new Date() },
  });
  const request = await prisma.printRequest.create({
    data: { reference: `PR-T-${u}`, eventId: event.id, orgId: org.id, type: "ADVANCE", status },
  });
  const mk = (name: string, staff: boolean) =>
    prisma.user.create({
      data: {
        email: `${name}-${u}@x`, password: "x", name, isStaff: staff,
        ...(staff ? { staffRole: "STAFF_ADMIN" as const } : {}),
      },
    });
  return { event, request, organizer: await mk("Orga", false), staff: await mk("Staff", true), staff2: await mk("Staff2", true) };
}

const added = (id: string): LineChange => ({
  op: "ADDED", lineId: id, label: "Cordon", to: { quantity: 100, unitPrice: 450 },
});

describe("describeLineChange", () => {
  it("ADDED, REMOVED", () => {
    expect(describeLineChange(added("a"))).toBe(`Ligne ajoutée : Cordon (100 × ${formatFcfa(450)})`);
    expect(describeLineChange({ op: "REMOVED", lineId: "a", label: "Cordon" })).toBe("Ligne retirée : Cordon");
  });
  it("UPDATED ne cite que le prix quand seul le prix change", () => {
    expect(
      describeLineChange({
        op: "UPDATED", lineId: "a", label: "Support PVC",
        from: { quantity: 150, unitPrice: 1500 }, to: { quantity: 150, unitPrice: 1200 },
      }),
    ).toBe(`Ligne modifiée : Support PVC (prix unitaire ${formatFcfa(1500)} → ${formatFcfa(1200)})`);
  });
  it("UPDATED cite la quantité seule, puis les deux", () => {
    const base = { op: "UPDATED" as const, lineId: "a", label: "X" };
    expect(
      describeLineChange({ ...base, from: { quantity: 1, unitPrice: 5 }, to: { quantity: 2, unitPrice: 5 } }),
    ).toBe("Ligne modifiée : X (quantité 1 → 2)");
    expect(
      describeLineChange({ ...base, from: { quantity: 1, unitPrice: 5 }, to: { quantity: 2, unitPrice: 6 } }),
    ).toBe(`Ligne modifiée : X (quantité 1 → 2, prix unitaire ${formatFcfa(5)} → ${formatFcfa(6)})`);
  });
});

describe("describeThreadEvent", () => {
  const cases: Record<ThreadEventType, [Record<string, unknown>, string]> = {
    LINES_CHANGED: [{ changes: [added("a"), added("b")] }, "2 lignes modifiées"],
    SUBMITTED: [{ badgeCount: 10, total: 5000 }, `Demande envoyée : 10 badges, total estimé ${formatFcfa(5000)}`],
    BADGES_CHANGED: [
      { added: 2, removed: 1, count: 9, lagging: ["Cordon", "PVC"] },
      "Badges de la demande : +2, −1 (9 au total) — quantités fixées par l'équipe à vérifier : Cordon, PVC",
    ],
    REQUEST_UPDATED: [{ fields: ["livraison", "notes"] }, "Informations modifiées : livraison, notes"],
    QUOTE_SENT: [{ version: 2, total: 900 }, `Devis v2 envoyé : ${formatFcfa(900)}`],
    QUOTE_ACCEPTED: [{ version: 2, total: 900 }, `Devis v2 accepté : ${formatFcfa(900)}`],
    QUOTE_REOPENED: [{ version: 2 }, "Devis v2 rouvert : l'acceptation est annulée"],
    QUOTE_REVISION: [{}, "Devis en révision : il sera renvoyé avant acceptation"],
    TEMPLATE_CHANGED: [{ fromLabel: "A", toLabel: "B", acceptanceCancelled: true }, "Template de badge changé : A → B; l'acceptation est annulée"],
    STATUS_CHANGED: [
      { from: "PAID", to: "READY" },
      `Statut : ${PRINT_REQUEST_STATUS_LABELS.PAID} → ${PRINT_REQUEST_STATUS_LABELS.READY}`,
    ],
    REJECTED: [{ reason: "Hors délai" }, "Demande refusée : Hors délai"],
    CANCELLED: [{}, "Demande annulée"],
    PAYMENT_RECEIVED: [{ amount: 100, reason: "virement" }, `Paiement reçu : ${formatFcfa(100)} (hors ligne : virement)`],
    PAYMENT_FAILED: [{ amount: 100 }, `Paiement échoué : ${formatFcfa(100)}`],
    PAYMENT_UNMATCHED: [{ amount: 100 }, `Paiement reçu sans correspondance avec le devis : ${formatFcfa(100)}`],
    SHEETS_GENERATED: [{ generationId: "g", badgeCount: 30 }, "Planches lancées pour 30 badges"],
    REGISTRATIONS_SKIPPED: [
      { registrationIds: ["r1", "r2"] },
      "2 badge(s) écarté(s) à la génération (inscription non approuvée) : r1, r2",
    ],
  };

  it("couvre chaque ThreadEventType (texte non vide, sans 'undefined')", () => {
    for (const [type, [details, text]] of Object.entries(cases)) {
      const out = describeThreadEvent(type as ThreadEventType, details);
      expect(out).toBe(text);
      expect(out).not.toContain("undefined");
    }
  });

  it("variantes : une seule ligne, sans retard, sans motif, template sans annulation", () => {
    expect(describeThreadEvent("LINES_CHANGED", { changes: [added("a")] })).toBe(describeLineChange(added("a")));
    expect(describeThreadEvent("BADGES_CHANGED", { added: 1, removed: 0, count: 1, lagging: [] })).toBe(
      "Badges de la demande : +1, −0 (1 au total)",
    );
    expect(describeThreadEvent("PAYMENT_RECEIVED", { amount: 100 })).toBe(`Paiement reçu : ${formatFcfa(100)}`);
    expect(describeThreadEvent("TEMPLATE_CHANGED", { fromLabel: "A", toLabel: "B", acceptanceCancelled: false })).toBe(
      "Template de badge changé : A → B",
    );
  });
});

describe("appendThreadEvent", () => {
  it("crée une entrée EVENT système par défaut", async () => {
    const { request } = await seed();
    const m = await prisma.$transaction((tx) => appendThreadEvent(tx, request.id, "CANCELLED", {}));
    expect(m).toMatchObject({ kind: "EVENT", side: "SYSTEM", authorId: null, eventType: "CANCELLED", body: "Demande annulée" });
  });

  it("trois modifications de lignes du même staff donnent une seule entrée « 3 lignes modifiées »", async () => {
    const { request, staff } = await seed();
    const actor = { userId: staff.id, side: "STAFF" as const };
    let last;
    for (const id of ["a", "b", "c"]) {
      last = await prisma.$transaction((tx) =>
        appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added(id)] }, actor),
      );
    }
    const rows = await prisma.printRequestMessage.findMany({ where: { requestId: request.id } });
    expect(rows).toHaveLength(1);
    expect((rows[0].details as { changes: unknown[] }).changes).toHaveLength(3);
    expect(rows[0].body).toBe("3 lignes modifiées");
    expect(last!.id).toBe(rows[0].id);
  });

  it("un message intercalé coupe le regroupement", async () => {
    const { request, staff } = await seed();
    const actor = { userId: staff.id, side: "STAFF" as const };
    const add = (id: string) =>
      prisma.$transaction((tx) => appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added(id)] }, actor));
    await add("a");
    await postMessage({ requestId: request.id, authorId: staff.id, side: "STAFF", body: "Bonjour", attachmentKey: null });
    await add("b");
    expect(await prisma.printRequestMessage.count({ where: { requestId: request.id } })).toBe(3);
  });

  it("un autre type d'entrée intercalé coupe le regroupement", async () => {
    const { request, staff } = await seed();
    const actor = { userId: staff.id, side: "STAFF" as const };
    await prisma.$transaction(async (tx) => {
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("a")] }, actor);
      await appendThreadEvent(tx, request.id, "QUOTE_REVISION", {}, actor);
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("b")] }, actor);
    });
    expect(await prisma.printRequestMessage.count({ where: { requestId: request.id } })).toBe(3);
  });

  it("auteur différent ou côté différent : pas de regroupement", async () => {
    const { request, staff, staff2, organizer } = await seed();
    await prisma.$transaction(async (tx) => {
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("a")] }, { userId: staff.id, side: "STAFF" });
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("b")] }, { userId: staff2.id, side: "STAFF" });
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("c")] }, { userId: staff2.id, side: "ORGANIZER" });
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("d")] }, { userId: organizer.id, side: "ORGANIZER" });
    });
    expect(await prisma.printRequestMessage.count({ where: { requestId: request.id } })).toBe(4);
  });
});

describe("postMessage", () => {
  const base = (r: { id: string }, u: { id: string }) => ({
    requestId: r.id, authorId: u.id, side: "ORGANIZER" as const, body: "Salut", attachmentKey: null,
  });

  it("refuse un corps vide sans pièce jointe (VALIDATION), même fait d'espaces", async () => {
    const { request, organizer } = await seed();
    await expect(postMessage({ ...base(request, organizer), body: "  \u0007 " })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuse plus de 5000 caractères", async () => {
    const { request, organizer } = await seed();
    await expect(postMessage({ ...base(request, organizer), body: "a".repeat(5001) })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("nettoie le corps ; un corps vide est permis avec une pièce jointe", async () => {
    const { request, organizer, event } = await seed();
    const m = await postMessage({ ...base(request, organizer), body: " a\u0000b\nc " });
    expect(m).toMatchObject({ body: "ab\nc", kind: "MESSAGE", side: "ORGANIZER" });
    const att = await postMessage({
      ...base(request, organizer), body: "", attachmentKey: `print-requests/${event.id}/x.pdf`,
    });
    expect(att.attachmentKey).toBe(`print-requests/${event.id}/x.pdf`);
  });

  it("organisateur avec une clé print-requests/staff/x.pdf -> INVALID_ATTACHMENT, staff avec la clé de l'événement aussi", async () => {
    const { request, organizer, staff, event } = await seed();
    await expect(
      postMessage({ ...base(request, organizer), attachmentKey: "print-requests/staff/x.pdf" }),
    ).rejects.toMatchObject({ code: "INVALID_ATTACHMENT", status: 400 });
    await expect(
      postMessage({ ...base(request, staff), side: "STAFF", attachmentKey: `print-requests/${event.id}/x.pdf` }),
    ).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    const ok = await postMessage({ ...base(request, staff), side: "STAFF", attachmentKey: "print-requests/staff/x.pdf" });
    expect(ok.side).toBe("STAFF");
  });

  it("demande absente -> 404", async () => {
    const { organizer } = await seed();
    await expect(postMessage({ ...base({ id: "nope" }, organizer) })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("reste permis sur une demande COMPLETED, REJECTED et CANCELLED", async () => {
    for (const status of ["COMPLETED", "REJECTED", "CANCELLED"] as const) {
      const { request, organizer } = await seed(status);
      const m = await postMessage(base(request, organizer));
      expect(m.requestId).toBe(request.id);
    }
  });
});

describe("listThread", () => {
  it("renvoie le nom de l'auteur, null pour le système, dans l'ordre", async () => {
    const { request, organizer } = await seed();
    await prisma.$transaction((tx) => appendThreadEvent(tx, request.id, "CANCELLED", {}));
    await postMessage({ requestId: request.id, authorId: organizer.id, side: "ORGANIZER", body: "Hello", attachmentKey: null });
    const thread = await listThread(request.id);
    expect(thread.map((t) => [t.kind, t.authorName, t.body])).toEqual([
      ["EVENT", null, "Demande annulée"],
      ["MESSAGE", "Orga", "Hello"],
    ]);
    expect(thread[0]).toMatchObject({ eventType: "CANCELLED", attachmentKey: null, side: "SYSTEM" });
    expect(typeof thread[0].createdAt).toBe("string");
  });
});

describe("printRequestErrorResponse", () => {
  it("PrintRequestError -> statut, { error, message, ...details }", async () => {
    const res = printRequestErrorResponse(new PrintRequestError("REGISTRATIONS_TAKEN", 409, { ids: ["a"] }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "REGISTRATIONS_TAKEN",
      message: PRINT_REQUEST_ERROR_MESSAGES.REGISTRATIONS_TAKEN,
      ids: ["a"],
    });
  });
  it("sans détails, et chaque code a un message français non vide", async () => {
    const res = printRequestErrorResponse(new PrintRequestError("CREDIT_LINE_LOCKED", 409));
    expect(await res.json()).toMatchObject({ error: "CREDIT_LINE_LOCKED" });
    for (const code of Object.keys(PRINT_REQUEST_ERROR_MESSAGES) as PrintRequestErrorCode[]) {
      expect(PRINT_REQUEST_ERROR_MESSAGES[code].length).toBeGreaterThan(5);
    }
  });
  it("relance toute autre erreur", () => {
    const boom = new Error("boom");
    expect(() => printRequestErrorResponse(boom)).toThrow(boom);
  });
});
