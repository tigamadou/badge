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
  toEntryDTO,
  type LineChange,
  type ThreadEventType,
} from "@/lib/print-requests/thread";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function seed(status: "DRAFT" | "SUBMITTED" | "COMPLETED" | "REJECTED" | "CANCELLED" = "SUBMITTED") {
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
    SUBMITTED: [{ badgeCount: 10, total: 5000 }, `Commande envoyée : 10 badges, total estimé ${formatFcfa(5000)}`],
    BADGES_CHANGED: [
      { added: 2, removed: 1, count: 9, lagging: ["Cordon", "PVC"] },
      "Badges de la commande : +2, −1 (9 au total) — quantités fixées par l'équipe à vérifier : Cordon, PVC",
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
    REJECTED: [{ reason: "Hors délai" }, "Commande refusée : Hors délai"],
    CANCELLED: [{}, "Commande annulée"],
    PAYMENT_RECEIVED: [{ amount: 100, reason: "virement" }, `Paiement reçu : ${formatFcfa(100)} (hors ligne : virement)`],
    PAYMENT_FAILED: [{ amount: 100 }, `Paiement échoué : ${formatFcfa(100)}`],
    PAYMENT_UNMATCHED: [{ amount: 100 }, `Paiement de ${formatFcfa(100)} reçu alors que la commande n'attendait plus ce paiement : l'équipe Badge vérifie.`],
    SHEETS_GENERATED: [{ generationId: "g", badgeCount: 30 }, "Planches lancées pour 30 badges"],
    REGISTRATIONS_SKIPPED: [
      { registrationIds: ["r1", "r2"] },
      "2 badge(s) écarté(s) à la génération (inscription non approuvée) : r1, r2",
    ],
    ORG_CREDIT_APPLIED: [{ amount: 45000 }, `Crédit d'impression appliqué : ${formatFcfa(45000)}`],
    ORG_CREDIT_SPENT: [{ amount: 45000 }, `Crédit d'impression décompté : ${formatFcfa(45000)}`],
    ONSITE_MARGIN_CHANGED: [{ from: 10, to: 15, reason: "Badges perdus" }, "Marge : 10 % → 15 % (Badges perdus)"],
    ONSITE_CREDIT_EARNED: [
      { quantity: 30, amount: 45000 },
      `30 badges non utilisés : ${formatFcfa(45000)} versés au crédit d'impression`,
    ],
    ONSITE_SUPPLEMENT_CREATED: [
      { reference: "IMP-2026-0002", extraBadges: 12 },
      "Commande complémentaire IMP-2026-0002 : 12 badges supplémentaires",
    ],
  };

  it("REQUEST_UPDATED mentionne les lignes fixées en retard", () => {
    expect(describeThreadEvent("REQUEST_UPDATED", { fields: ["quantité estimée"], lagging: ["Cordon"] })).toBe(
      "Informations modifiées : quantité estimée — quantités fixées par l'équipe à vérifier : Cordon",
    );
  });

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
      "Badges de la commande : +1, −0 (1 au total)",
    );
    expect(describeThreadEvent("PAYMENT_RECEIVED", { amount: 100 })).toBe(`Paiement reçu : ${formatFcfa(100)}`);
    expect(describeThreadEvent("PAYMENT_RECEIVED", { amount: 0, byCredit: true })).toBe(
      "Devis réglé par le crédit d'impression : aucun paiement à effectuer",
    );
    expect(describeThreadEvent("TEMPLATE_CHANGED", { fromLabel: "A", toLabel: "B", acceptanceCancelled: false })).toBe(
      "Template de badge changé : A → B",
    );
  });
});

describe("appendThreadEvent", () => {
  it("crée une entrée EVENT système par défaut", async () => {
    const { request } = await seed();
    const m = await prisma.$transaction((tx) => appendThreadEvent(tx, request.id, "CANCELLED", {}));
    expect(m).toMatchObject({ kind: "EVENT", side: "SYSTEM", authorId: null, eventType: "CANCELLED", body: "Commande annulée" });
  });

  it("trois modifications de lignes du même staff donnent trois entrées distinctes", async () => {
    const { request, staff } = await seed();
    const actor = { userId: staff.id, side: "STAFF" as const };
    const ids: string[] = [];
    for (const id of ["a", "b", "c"]) {
      const m = await prisma.$transaction((tx) =>
        appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added(id)] }, actor),
      );
      ids.push(m.id);
    }
    const rows = await prisma.printRequestMessage.findMany({
      where: { requestId: request.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(rows.map((r) => r.id).sort()).toEqual([...ids].sort());
    expect(rows.every((r) => (r.details as { changes: unknown[] }).changes.length === 1)).toBe(true);
    expect(rows.map((r) => (r.details as { changes: { lineId: string }[] }).changes[0].lineId)).toEqual(["a", "b", "c"]);
  });

  it("une entrée par appel, quel que soit l'auteur, le côté ou l'entrée intercalée", async () => {
    const { request, staff, staff2, organizer } = await seed();
    await prisma.$transaction(async (tx) => {
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("a")] }, { userId: staff.id, side: "STAFF" });
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("b")] }, { userId: staff2.id, side: "STAFF" });
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("c")] }, { userId: staff2.id, side: "ORGANIZER" });
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("d")] }, { userId: organizer.id, side: "ORGANIZER" });
      await appendThreadEvent(tx, request.id, "QUOTE_REVISION", {}, { userId: staff.id, side: "STAFF" });
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("e")] }, { userId: staff.id, side: "STAFF" });
    });
    await postMessage({ requestId: request.id, authorId: staff.id, side: "STAFF", body: "Bonjour", attachmentKey: null });
    expect(await prisma.printRequestMessage.count({ where: { requestId: request.id } })).toBe(7);
  });

  it("interne et public restent des entrées séparées", async () => {
    const { request, staff } = await seed();
    const actor = { userId: staff.id, side: "STAFF" as const };
    await prisma.$transaction(async (tx) => {
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("a")] }, actor, { internal: true });
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("b")] }, actor);
      await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added("c")] }, actor, { internal: true });
    });
    const rows = await prisma.printRequestMessage.findMany({
      where: { requestId: request.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(rows.map((r) => r.internal)).toEqual([true, false, true]);
    expect(rows.every((r) => (r.details as { changes: unknown[] }).changes.length === 1)).toBe(true);
    const organizerView = await listThread(request.id, "ORGANIZER");
    expect(organizerView).toHaveLength(1);
    expect(organizerView[0].id).toBe(rows[1].id);
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
    const ok = await postMessage({
      ...base(request, staff), side: "STAFF", attachmentKey: `print-requests/staff/${request.id}/x.pdf`,
    });
    expect(ok.side).toBe("STAFF");
  });

  it("staff : la clé d'une autre commande (autre organisation) ou sans commande est refusée", async () => {
    const mine = await seed();
    const theirs = await seed();
    const stf = (attachmentKey: string) =>
      postMessage({ ...base(mine.request, mine.staff), side: "STAFF", attachmentKey });
    for (const key of [
      `print-requests/staff/${theirs.request.id}/x.pdf`,
      "print-requests/staff/x.pdf",
      `print-requests/staff/${mine.request.id}/a/b.pdf`,
    ]) {
      await expect(stf(key)).rejects.toMatchObject({ code: "INVALID_ATTACHMENT", status: 400 });
    }
    await expect(stf(`print-requests/staff/${mine.request.id}/ok.pdf`)).resolves.toBeTruthy();
  });

  it("refuse un message sur un brouillon (409), sans rien écrire", async () => {
    const { request, organizer } = await seed("DRAFT");
    await expect(postMessage(base(request, organizer))).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
      status: 409,
    });
    expect(await prisma.printRequestMessage.count({ where: { requestId: request.id } })).toBe(0);
  });

  it("commande absente -> 404", async () => {
    const { organizer } = await seed();
    await expect(postMessage({ ...base({ id: "nope" }, organizer) })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("reste permis sur une commande COMPLETED, REJECTED et CANCELLED", async () => {
    for (const status of ["COMPLETED", "REJECTED", "CANCELLED"] as const) {
      const { request, organizer } = await seed(status);
      const m = await postMessage(base(request, organizer));
      expect(m.requestId).toBe(request.id);
    }
  });
});

describe("appendThreadEvent : concurrence", () => {
  it("deux ajouts simultanés du même auteur créent deux entrées", async () => {
    const { request, staff } = await seed();
    const actor = { userId: staff.id, side: "STAFF" as const };
    const add = (id: string) =>
      prisma.$transaction((tx) => appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [added(id)] }, actor));
    await Promise.all([add("a"), add("b")]);
    const rows = await prisma.printRequestMessage.findMany({ where: { requestId: request.id } });
    expect(rows).toHaveLength(2);
    const ids = rows.flatMap((r) => (r.details as { changes: { lineId: string }[] }).changes.map((c) => c.lineId)).sort();
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("postMessage : forme des clés de pièces jointes", () => {
  it("refuse les clés non strictes", async () => {
    const { request, organizer, staff, event } = await seed();
    const org = (attachmentKey: string) =>
      postMessage({ requestId: request.id, authorId: organizer.id, side: "ORGANIZER", body: "", attachmentKey });
    const stf = (attachmentKey: string) =>
      postMessage({ requestId: request.id, authorId: staff.id, side: "STAFF", body: "", attachmentKey });
    for (const k of [
      "print-requests/staff/../x",
      `print-requests/${event.id}/../staff/x`,
      `print-requests/${event.id}/..`,
      `print-requests/${event.id}/.`,
      `print-requests/${event.id}/a/b.pdf`,
      `print-requests/${event.id}/`,
      `/print-requests/${event.id}/x.pdf`,
      `print-requests/${event.id}/${"a".repeat(300)}.pdf`,
    ]) {
      await expect(org(k)).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    }
    const sp = `print-requests/staff/${request.id}`;
    for (const k of ["print-requests/staff/../x", "/print-requests/staff/x.pdf", `${sp}/a b.pdf`, `${sp}/${"a".repeat(300)}`, `${sp}/..`, `${sp}/.`]) {
      await expect(stf(k)).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    }
    await expect(org(`print-requests/${event.id}/a_b-1.pdf`)).resolves.toBeTruthy();
  });
});

describe("describeThreadEvent : details mal formés", () => {
  it("aucune famille ne produit undefined / NaN", () => {
    const malformed: ThreadEventType[] = [
      "LINES_CHANGED", "SUBMITTED", "BADGES_CHANGED", "REQUEST_UPDATED", "QUOTE_SENT", "QUOTE_ACCEPTED",
      "QUOTE_REOPENED", "TEMPLATE_CHANGED", "STATUS_CHANGED", "REJECTED", "PAYMENT_RECEIVED",
      "PAYMENT_FAILED", "PAYMENT_UNMATCHED", "SHEETS_GENERATED", "REGISTRATIONS_SKIPPED",
      "ORG_CREDIT_APPLIED", "ORG_CREDIT_SPENT",
    ];
    for (const t of malformed) {
      for (const d of [{}, { changes: "x", lagging: "x", fields: 3, registrationIds: null, amount: "abc", reason: 5, from: "ZZ" }]) {
        const out = describeThreadEvent(t, d);
        expect(out).not.toMatch(/undefined|NaN|null/);
      }
    }
    expect(describeThreadEvent("LINES_CHANGED", {})).toBe("0 lignes modifiées");
    expect(describeThreadEvent("PAYMENT_RECEIVED", { amount: 5, reason: "" })).toBe(`Paiement reçu : ${formatFcfa(5)}`);
    expect(describeThreadEvent("STATUS_CHANGED", { from: "ZZ", to: undefined })).toBe("Statut : ZZ → —");
    expect(describeLineChange({ op: "UPDATED", lineId: "a", label: "X" })).toBe("Ligne modifiée : X");
    expect(describeLineChange({ op: "ADDED", lineId: "a", label: "X" })).toContain("0 ×");
  });
});

describe("listThread", () => {
  it("renvoie le nom de l'auteur, null pour le système, dans l'ordre", async () => {
    const { request, organizer } = await seed();
    await prisma.$transaction((tx) => appendThreadEvent(tx, request.id, "CANCELLED", {}));
    await postMessage({ requestId: request.id, authorId: organizer.id, side: "ORGANIZER", body: "Hello", attachmentKey: null });
    const thread = await listThread(request.id, "STAFF");
    expect(thread.map((t) => [t.kind, t.authorName, t.body])).toEqual([
      ["EVENT", null, "Commande annulée"],
      ["MESSAGE", "Orga", "Hello"],
    ]);
    expect(thread[0]).toMatchObject({ eventType: "CANCELLED", attachmentKey: null, side: "SYSTEM" });
    expect(typeof thread[0].createdAt).toBe("string");
  });
});

describe("fil côté organisateur : détails filtrés (liste blanche)", () => {
  async function entries(request: { id: string }, rows: { eventType: string; details?: object | null; body?: string }[]) {
    for (const row of rows) {
      await prisma.printRequestMessage.create({
        data: {
          requestId: request.id, side: "SYSTEM", kind: "EVENT", eventType: row.eventType,
          body: row.body ?? "stocké", details: row.details ?? undefined,
        },
      });
    }
    return {
      organizer: await listThread(request.id, "ORGANIZER"),
      staff: await listThread(request.id, "STAFF"),
    };
  }

  it("retire paymentId, generationId et motif manuel ; le texte est reconstruit sans le motif", async () => {
    const { request } = await seed();
    const { organizer, staff } = await entries(request, [
      { eventType: "PAYMENT_RECEIVED", details: { amount: 5000, paymentId: "pay_1", reason: "Virement interne" } },
      { eventType: "PAYMENT_FAILED", details: { amount: 5000, paymentId: "pay_2", reason: "REPLACED" } },
      { eventType: "SHEETS_GENERATED", details: { badgeCount: 12, generationId: "gen_1" } },
      { eventType: "SUBMITTED", details: { badgeCount: 3, total: 4500, secret: "x" } },
      { eventType: "PAYMENT_RECEIVED", details: { amount: 0, byCredit: true } },
    ]);
    expect(organizer.map((e) => e.details)).toEqual([
      { amount: 5000 }, { amount: 5000 }, { badgeCount: 12 }, { badgeCount: 3, total: 4500 },
      { amount: 0, byCredit: true },
    ]);
    expect(organizer[0].body).toBe(`Paiement reçu : ${formatFcfa(5000)}`);
    expect(organizer[0].body).not.toContain("Virement");
    expect(JSON.stringify(organizer)).not.toMatch(/pay_|gen_|secret|Virement/);
    // Le staff voit tout.
    expect(staff[0].details).toEqual({ amount: 5000, paymentId: "pay_1", reason: "Virement interne" });
    expect(staff[0].body).toBe("stocké");
  });

  it("ONSITE_MARGIN_CHANGED : l'organisateur voit la marge sans le motif, le staff le voit", async () => {
    const { request } = await seed();
    const { organizer, staff } = await entries(request, [
      { eventType: "ONSITE_MARGIN_CHANGED", details: { from: 10, to: 15, reason: "Badges perdus" } },
    ]);
    expect(organizer[0].details).toEqual({ from: 10, to: 15 });
    expect(organizer[0].body).toBe("Marge : 10 % → 15 %");
    expect(JSON.stringify(organizer)).not.toContain("Badges perdus");
    expect(staff[0].details).toEqual({ from: 10, to: 15, reason: "Badges perdus" });
  });

  it("LINES_CHANGED garde de quoi afficher le texte, sans identifiant de ligne", async () => {
    const { request } = await seed();
    const { organizer } = await entries(request, [
      { eventType: "LINES_CHANGED", details: { changes: [added("line_1")], extra: 1 } },
    ]);
    expect(organizer[0].details).toEqual({ changes: [{ op: "ADDED", label: "Cordon", to: { quantity: 100, unitPrice: 450 } }] });
    expect(organizer[0].body).toBe(`Ligne ajoutée : Cordon (100 × ${formatFcfa(450)})`);
  });

  it("détails absents ou mal formés : objet vide ; type inconnu : aucun détail ; message intact", async () => {
    const { request, organizer: orga } = await seed();
    await prisma.printRequestMessage.create({
      data: { requestId: request.id, side: "SYSTEM", kind: "EVENT", eventType: "CANCELLED", body: "x" },
    });
    await prisma.printRequestMessage.create({
      data: { requestId: request.id, side: "SYSTEM", kind: "EVENT", eventType: "STATUS_CHANGED", body: "x", details: ["a"] },
    });
    await prisma.printRequestMessage.create({
      data: { requestId: request.id, side: "SYSTEM", kind: "EVENT", eventType: "FUTUR", body: "texte", details: { paymentId: "p" } },
    });
    await postMessage({ requestId: request.id, authorId: orga.id, side: "ORGANIZER", body: "Salut", attachmentKey: null });
    const thread = await listThread(request.id, "ORGANIZER");
    expect(thread.map((e) => e.details)).toEqual([{}, {}, null, null]);
    expect(thread[2].body).toBe("texte");
    expect(thread[3]).toMatchObject({ kind: "MESSAGE", body: "Salut" });
    const m = await prisma.printRequestMessage.findFirstOrThrow({ where: { requestId: request.id, kind: "MESSAGE" } });
    expect(toEntryDTO(m, "Orga", "ORGANIZER").details).toBeNull();
  });
});

describe("notes internes et lecture incrémentale", () => {
  it("postMessage refuse internal côté organisateur (VALIDATION)", async () => {
    const { request, organizer } = await seed();
    await expect(
      postMessage({ requestId: request.id, authorId: organizer.id, side: "ORGANIZER", body: "x", attachmentKey: null, internal: true }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await prisma.printRequestMessage.count({ where: { requestId: request.id } })).toBe(0);
  });

  it("une note interne du staff est stockée et absente du fil organisateur", async () => {
    const { request, staff, organizer } = await seed();
    await postMessage({ requestId: request.id, authorId: organizer.id, side: "ORGANIZER", body: "public", attachmentKey: null });
    const note = await postMessage({ requestId: request.id, authorId: staff.id, side: "STAFF", body: "secret", attachmentKey: null, internal: true });
    expect(note.internal).toBe(true);
    const orga = await listThread(request.id, "ORGANIZER");
    expect(orga.map((e) => e.body)).toEqual(["public"]);
    expect(orga[0].internal).toBe(false);
    const staffView = await listThread(request.id, "STAFF");
    expect(staffView.map((e) => [e.body, e.internal])).toEqual([["public", false], ["secret", true]]);
  });

  it("appendThreadEvent accepte internal ; l'évènement interne est masqué à l'organisateur", async () => {
    const { request } = await seed();
    const m = await prisma.$transaction((tx) =>
      appendThreadEvent(tx, request.id, "CANCELLED", {}, undefined, { internal: true }),
    );
    expect(m.internal).toBe(true);
    expect(await listThread(request.id, "ORGANIZER")).toEqual([]);
    expect(await listThread(request.id, "STAFF")).toHaveLength(1);
    const plain = await prisma.$transaction((tx) => appendThreadEvent(tx, request.id, "CANCELLED", {}));
    expect(plain.internal).toBe(false);
  });

  it("after ne renvoie que les entrées strictement postérieures", async () => {
    const { request, organizer } = await seed();
    const a = await postMessage({ requestId: request.id, authorId: organizer.id, side: "ORGANIZER", body: "a", attachmentKey: null });
    await new Promise((r) => setTimeout(r, 15));
    await postMessage({ requestId: request.id, authorId: organizer.id, side: "ORGANIZER", body: "b", attachmentKey: null });
    const after = await listThread(request.id, "ORGANIZER", { after: a.createdAt });
    expect(after.map((e) => e.body)).toEqual(["b"]);
    expect(await listThread(request.id, "ORGANIZER", {})).toHaveLength(2);
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
