import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { applyTransition, lockRequestWithEvent, paymentProbe } from "@/lib/print-requests/service";
import {
  TEMPLATE_LOCK_STATUSES,
  assertTemplateChangeAllowed,
  findTemplateLock,
  pinLockedEventTemplates,
  releaseTemplatePin,
  syncRequestTemplates,
} from "@/lib/print-requests/template-lock";
import { seedPrintFixture, makeRequest, type PrintFixture } from "./helpers/print-requests";

let fx: PrintFixture;
let other: Awaited<ReturnType<typeof newTemplate>>;

const uniq = () => `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function newTemplate(label: string, w = 500, h = 700, pages = 1) {
  return prisma.installedBadgeTemplate.create({
    data: {
      family: uniq(), version: 1, label, description: "", pages, pageWidthPx: w, pageHeightPx: h,
      layout: { variables: [] }, bindings: {}, assetPrefix: "badge-templates/x/", formatVersion: 3,
      installedById: "u1",
    },
  });
}
const copyOf = (t: { id: string; pageWidthPx: number; pageHeightPx: number; pages: number }) => ({
  badgeTemplateId: t.id, badgeWidthPx: t.pageWidthPx, badgeHeightPx: t.pageHeightPx, badgePages: t.pages,
});
const reject = (p: Promise<unknown>) => p.then(() => null, (e) => e as PrintRequestError);
const run = <T,>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn);
const thread = (id: string) => prisma.printRequestMessage.findMany({ where: { requestId: id }, orderBy: { createdAt: "asc" } });

beforeEach(async () => {
  fx = await seedPrintFixture();
  other = await newTemplate("Autre badge");
});
afterEach(() => vi.restoreAllMocks());

describe("findTemplateLock / assertTemplateChangeAllowed", () => {
  it("expose les statuts verrouillants", () => {
    expect(TEMPLATE_LOCK_STATUSES).toEqual(["PAID", "IN_PRODUCTION", "READY"]);
  });

  it("rien ne verrouille sans demande payée", async () => {
    await makeRequest(fx, { status: "QUOTED" });
    expect(await findTemplateLock(fx.event.id)).toBeNull();
    await expect(assertTemplateChangeAllowed(fx.event.id)).resolves.toBeUndefined();
  });

  it.each(["PAID", "IN_PRODUCTION", "READY"] as const)("%s verrouille avec la référence", async (status) => {
    const r = await makeRequest(fx, { status });
    expect(await findTemplateLock(fx.event.id)).toEqual({ requestId: r.id, reference: r.reference });
    const err = await reject(assertTemplateChangeAllowed(fx.event.id));
    expect(err?.code).toBe("TEMPLATE_LOCKED_BY_PRINT_REQUEST");
    expect(err?.status).toBe(409);
    expect(err?.details).toEqual({ reference: r.reference });
  });

  it("COMPLETED ne verrouille plus", async () => {
    await makeRequest(fx, { status: "COMPLETED" });
    expect(await findTemplateLock(fx.event.id)).toBeNull();
  });

  it("ACCEPTED avec paiement en cours : PAYMENT_IN_PROGRESS ; sans paiement : autorisé", async () => {
    await makeRequest(fx, { status: "ACCEPTED" });
    await expect(assertTemplateChangeAllowed(fx.event.id)).resolves.toBeUndefined();
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    const err = await reject(assertTemplateChangeAllowed(fx.event.id));
    expect(err?.code).toBe("PAYMENT_IN_PROGRESS");
  });
});

describe("pinLockedEventTemplates", () => {
  async function inheritingEvent(orgId: string) {
    return prisma.event.create({
      data: { orgId, title: "Herite", slug: uniq(), location: "X", date: new Date() },
    });
  }

  it("org : épingle l'évènement verrouillé qui hérite, pas les autres", async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: null } });
    const locked = await prisma.printRequest.update({
      where: { id: (await makeRequest(fx, { status: "PAID", ...copyOf(fx.template) })).id },
      data: {},
    });
    const free = await inheritingEvent(fx.org.id);
    const own = await inheritingEvent(fx.org.id);
    await prisma.event.update({ where: { id: own.id }, data: { badgeTemplateId: other.id } });
    const ownReq = await makeRequest({ ...fx, event: own }, { status: "PAID", ...copyOf(fx.template) });
    const noCopy = await inheritingEvent(fx.org.id);
    await makeRequest({ ...fx, event: noCopy }, { status: "PAID" });

    expect(await pinLockedEventTemplates({ orgId: fx.org.id })).toBe(1);
    expect((await prisma.event.findUnique({ where: { id: fx.event.id } }))?.badgeTemplateId).toBe(fx.template.id);
    expect((await prisma.printRequest.findUnique({ where: { id: locked.id } }))?.templatePinned).toBe(true);
    expect((await prisma.event.findUnique({ where: { id: free.id } }))?.badgeTemplateId).toBeNull();
    expect((await prisma.event.findUnique({ where: { id: own.id } }))?.badgeTemplateId).toBe(other.id);
    expect((await prisma.printRequest.findUnique({ where: { id: ownReq.id } }))?.templatePinned).toBe(false);
    expect((await prisma.event.findUnique({ where: { id: noCopy.id } }))?.badgeTemplateId).toBeNull();
  });

  it("épingle aussi la demande ACCEPTED avec paiement en cours, pas sans paiement", async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: null } });
    const other2 = await inheritingEvent(fx.org.id);
    await makeRequest(fx, { status: "ACCEPTED", ...copyOf(fx.template) });
    await makeRequest({ ...fx, event: other2 }, { status: "ACCEPTED", ...copyOf(fx.template) });
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockImplementation(
      async (id) => (await prisma.printRequest.findUnique({ where: { id } }))?.eventId === fx.event.id,
    );
    expect(await pinLockedEventTemplates({ orgId: fx.org.id })).toBe(1);
    expect((await prisma.event.findUnique({ where: { id: fx.event.id } }))?.badgeTemplateId).toBe(fx.template.id);
    expect((await prisma.event.findUnique({ where: { id: other2.id } }))?.badgeTemplateId).toBeNull();
  });

  it("plateforme : seuls les évènements qui héritent de la plateforme sont épinglés", async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: null } });
    await makeRequest(fx, { status: "READY", ...copyOf(fx.template) });
    const orgWithOwn = await prisma.organization.create({
      data: { name: "O2", slug: uniq(), badgeTemplateId: other.id },
    });
    const ev2 = await prisma.event.create({
      data: { orgId: orgWithOwn.id, title: "E2", slug: uniq(), location: "X", date: new Date() },
    });
    await makeRequest({ ...fx, org: orgWithOwn, event: ev2 }, { status: "PAID", ...copyOf(fx.template) });
    expect(await pinLockedEventTemplates({ platform: true })).toBeGreaterThanOrEqual(1);
    expect((await prisma.event.findUnique({ where: { id: fx.event.id } }))?.badgeTemplateId).toBe(fx.template.id);
    expect((await prisma.event.findUnique({ where: { id: ev2.id } }))?.badgeTemplateId).toBeNull();
  });

  it("ignore un évènement qui a changé entre la lecture et le verrou", async () => {
    const own = await inheritingEvent(fx.org.id);
    await prisma.event.update({ where: { id: own.id }, data: { badgeTemplateId: other.id } });
    const spy = vi.spyOn(prisma.event, "findMany");
    spy.mockResolvedValueOnce([{ id: own.id }, { id: "ghost" }] as never);
    expect(await pinLockedEventTemplates({ orgId: fx.org.id })).toBe(0);
    expect((await prisma.event.findUnique({ where: { id: own.id } }))?.badgeTemplateId).toBe(other.id);
  });

  it("ignore un évènement dont plus aucune demande ne retient le template", async () => {
    const free = await inheritingEvent(fx.org.id);
    await makeRequest({ ...fx, event: free }, { status: "QUOTED", ...copyOf(fx.template) });
    vi.spyOn(prisma.event, "findMany").mockResolvedValueOnce([{ id: free.id }] as never);
    expect(await pinLockedEventTemplates({ orgId: fx.org.id })).toBe(0);
  });
});

describe("releaseTemplatePin (via applyTransition)", () => {
  async function pinned(over: Record<string, unknown> = {}) {
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: fx.template.id } });
    return makeRequest(fx, { status: "READY", templatePinned: true, ...copyOf(fx.template), ...over });
  }
  const complete = (id: string) =>
    run((tx) =>
      applyTransition(tx, { id, status: "READY" }, "COMPLETE", "STAFF"),
    );
  const eventTemplate = async () => (await prisma.event.findUnique({ where: { id: fx.event.id } }))?.badgeTemplateId;

  it("READY -> COMPLETED remet l'héritage et lève l'épinglage", async () => {
    const r = await pinned();
    await complete(r.id);
    expect(await eventTemplate()).toBeNull();
    expect((await prisma.printRequest.findUnique({ where: { id: r.id } }))?.templatePinned).toBe(false);
  });

  it("conserve le template si l'évènement en a changé entre-temps", async () => {
    const r = await pinned();
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: other.id } });
    await complete(r.id);
    expect(await eventTemplate()).toBe(other.id);
    expect((await prisma.printRequest.findUnique({ where: { id: r.id } }))?.templatePinned).toBe(false);
  });

  it("conserve le template si une autre demande payée le verrouille", async () => {
    const r = await pinned();
    await makeRequest(fx, { status: "PAID", ...copyOf(fx.template) });
    await complete(r.id);
    expect(await eventTemplate()).toBe(fx.template.id);
  });

  it("conserve le template si une autre demande ACCEPTED l'a épinglé", async () => {
    const r = await pinned();
    await makeRequest(fx, { status: "ACCEPTED", templatePinned: true, ...copyOf(fx.template) });
    await complete(r.id);
    expect(await eventTemplate()).toBe(fx.template.id);
  });

  it("sans épinglage : rien ne change", async () => {
    const r = await pinned({ templatePinned: false });
    await complete(r.id);
    expect(await eventTemplate()).toBe(fx.template.id);
  });

  it("épinglage sans copie de template : seul le drapeau est levé", async () => {
    const r = await pinned({ badgeTemplateId: null });
    await complete(r.id);
    expect(await eventTemplate()).toBe(fx.template.id);
    expect((await prisma.printRequest.findUnique({ where: { id: r.id } }))?.templatePinned).toBe(false);
  });

  it("demande inconnue : sans effet", async () => {
    await expect(run((tx) => releaseTemplatePin(tx, "ghost"))).resolves.toBeUndefined();
  });

  it("ACCEPTED -> PAID conserve l'épinglage ; ACCEPTED -> CANCELLED le lève", async () => {
    const r = await pinned({ status: "ACCEPTED" });
    await run((tx) => applyTransition(tx, { id: r.id, status: "ACCEPTED" }, "MARK_PAID", "SYSTEM"));
    expect(await eventTemplate()).toBe(fx.template.id);
    const r2 = await makeRequest(fx, { status: "ACCEPTED", templatePinned: true, ...copyOf(fx.template) });
    await run((tx) => applyTransition(tx, { id: r2.id, status: "ACCEPTED" }, "CANCEL", "ORGANIZER"));
    expect(await eventTemplate()).toBe(fx.template.id); // r (PAID) le retient encore
    expect((await prisma.printRequest.findUnique({ where: { id: r2.id } }))?.templatePinned).toBe(false);
  });
});

describe("syncRequestTemplates", () => {
  beforeEach(async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: other.id } });
  });

  it("QUOTED -> SUBMITTED, copie mise à jour, entrée au fil", async () => {
    const r = await makeRequest(fx, { status: "QUOTED", ...copyOf(fx.template) });
    expect(await syncRequestTemplates({ eventId: fx.event.id }, fx.owner.id)).toEqual([r.id]);
    const after = await prisma.printRequest.findUnique({ where: { id: r.id } });
    expect(after).toMatchObject({ status: "SUBMITTED", badgeTemplateId: other.id, badgeWidthPx: 500, badgeHeightPx: 700, badgePages: 1 });
    const msgs = await thread(r.id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body).toBe("Template de badge changé : Badge test → Autre badge");
  });

  it("ACCEPTED -> acceptation effacée, entrée suffixée", async () => {
    const r = await makeRequest(fx, {
      status: "ACCEPTED", acceptedVersion: 1, acceptedTotal: 1000, acceptedAt: new Date(),
      acceptedById: fx.owner.id, ...copyOf(fx.template),
    });
    await syncRequestTemplates({ eventId: fx.event.id }, fx.owner.id);
    const after = await prisma.printRequest.findUnique({ where: { id: r.id } });
    expect(after).toMatchObject({ status: "SUBMITTED", acceptedVersion: null, acceptedTotal: null, acceptedAt: null });
    expect((await thread(r.id))[0].body).toBe(
      "Template de badge changé : Badge test → Autre badge; l'acceptation est annulée",
    );
  });

  it("ignore brouillons, demandes payées, copies déjà à jour et ACCEPTED avec paiement", async () => {
    const draft = await makeRequest(fx, { status: "DRAFT" });
    const paid = await makeRequest(fx, { status: "PAID", ...copyOf(fx.template) });
    const same = await makeRequest(fx, { status: "SUBMITTED", ...copyOf(other) });
    const accepted = await makeRequest(fx, { status: "ACCEPTED", ...copyOf(fx.template) });
    vi.spyOn(paymentProbe, "isPaymentInProgress").mockResolvedValue(true);
    expect(await syncRequestTemplates({ eventId: fx.event.id }, fx.owner.id)).toEqual([]);
    const get = (id: string) => prisma.printRequest.findUnique({ where: { id } });
    expect((await get(draft.id))?.badgeTemplateId).toBeNull();
    expect((await get(paid.id))?.badgeTemplateId).toBe(fx.template.id);
    expect((await get(same.id))?.status).toBe("SUBMITTED");
    expect((await get(accepted.id))).toMatchObject({ status: "ACCEPTED", badgeTemplateId: fx.template.id });
  });

  it("copie absente : « — » comme ancien libellé", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    await syncRequestTemplates({ eventId: fx.event.id }, fx.owner.id);
    expect((await thread(r.id))[0].body).toBe("Template de badge changé : — → Autre badge");
  });

  it("périmètres org et plateforme", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED", ...copyOf(fx.template) });
    expect(await syncRequestTemplates({ orgId: fx.org.id }, fx.owner.id)).toEqual([r.id]);
    await prisma.printRequest.update({ where: { id: r.id }, data: copyOf(fx.template) });
    expect(await syncRequestTemplates({ platform: true }, fx.owner.id)).toContain(r.id);
  });

  it("ignore une demande qui a changé de statut ou disparu entre la liste et le verrou", async () => {
    const paid = await makeRequest(fx, { status: "PAID", ...copyOf(fx.template) });
    vi.spyOn(prisma.printRequest, "findMany").mockResolvedValueOnce([
      { id: paid.id, eventId: fx.event.id },
      { id: "ghost", eventId: fx.event.id },
    ] as never);
    expect(await syncRequestTemplates({ eventId: fx.event.id }, fx.owner.id)).toEqual([]);
  });
});

describe("erreur inattendue du verrou", () => {
  it("syncRequestTemplates la propage", async () => {
    await prisma.event.update({ where: { id: fx.event.id }, data: { badgeTemplateId: other.id } });
    await makeRequest(fx, { status: "SUBMITTED", ...copyOf(fx.template) });
    vi.spyOn(prisma.printRequest, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect(syncRequestTemplates({ eventId: fx.event.id }, fx.owner.id)).rejects.toThrow("boom");
  });
});

describe("ordre des verrous (Event puis PrintRequest)", () => {
  it("lockRequestWithEvent renvoie l'évènement ; demande inconnue : NOT_FOUND", async () => {
    const r = await makeRequest(fx, { status: "SUBMITTED" });
    await expect(run((tx) => lockRequestWithEvent(tx, r.id))).resolves.toEqual({ eventId: fx.event.id });
    const err = await reject(run((tx) => lockRequestWithEvent(tx, "ghost")));
    expect(err?.code).toBe("NOT_FOUND");
  });

  it("une demande épinglée terminée pendant un changement de template d'org ne s'interbloque pas", async () => {
    for (let i = 0; i < 5; i++) {
      const f = await seedPrintFixture();
      await prisma.event.update({ where: { id: f.event.id }, data: { badgeTemplateId: null } });
      const r = await makeRequest(f, { status: "READY", ...copyOf(f.template) });
      const results = await Promise.allSettled([
        run(async (tx) => {
          await lockRequestWithEvent(tx, r.id);
          await applyTransition(tx, { id: r.id, status: "READY" }, "COMPLETE", "STAFF");
        }),
        run(async (tx) => {
          await pinLockedEventTemplates({ orgId: f.org.id }, tx);
          await tx.organization.update({ where: { id: f.org.id }, data: { badgeTemplateId: other.id } });
        }),
      ]);
      expect(results.map((x) => x.status)).toEqual(["fulfilled", "fulfilled"]);
    }
  });

  it("pinLockedEventTemplates verrouille les évènements par identifiant croissant, avant toute lecture", async () => {
    const mk = () =>
      prisma.event.create({ data: { orgId: fx.org.id, title: "E", slug: uniq(), location: "X", date: new Date() } });
    const [a, b] = [await mk(), await mk()];
    for (const e of [a, b]) await makeRequest({ ...fx, event: e }, { status: "PAID", ...copyOf(fx.template) });
    vi.spyOn(prisma.event, "findMany").mockResolvedValueOnce([{ id: b.id }, { id: a.id }] as never);
    const locked: unknown[] = [];
    await prisma.$transaction(async (tx) => {
      const spy = vi.fn(((strings: TemplateStringsArray, ...values: unknown[]) => {
        if (strings[0].includes("`Event`")) locked.push(values[0]);
        return tx.$queryRaw(strings, ...values);
      }) as never);
      const proxied = new Proxy(tx, { get: (t, k) => (k === "$queryRaw" ? spy : Reflect.get(t, k)) });
      expect(await pinLockedEventTemplates({ orgId: fx.org.id }, proxied as never)).toBe(2);
    });
    expect(locked.slice(0, 2)).toEqual([a.id, b.id].sort());
  });
});
