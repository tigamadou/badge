import type { PrintProduct } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { systemRoleId } from "../../../../src/lib/permissions/db";
import { createDraft } from "../../../../src/lib/print-requests/service";
import {
  acceptQuote, cancelRequest, submitRequest,
} from "../../../../src/lib/print-requests/lifecycle";
import { setBadges, setOrganizerProducts, updateDetails } from "../../../../src/lib/print-requests/content";
import {
  addStaffLine, advanceStatus, rejectRequest, removeStaffLine, sendQuote, updateStaffLine,
} from "../../../../src/lib/print-requests/quote";
import { applyOrgCredit, getAvailableOrgPrintCredit } from "../../../../src/lib/print-requests/org-credit";
import {
  notifyPrintRequestQuoted, notifyPrintRequestStatusChanged,
} from "../../../../src/lib/notifications/triggers";
import {
  defaultConfiguration, loadProductForPricing, validateChoices, type OptionChoice,
} from "../../../../src/lib/print-catalog/pricing";
import type { DemoContext, DemoEvent, DemoOrg, DemoRegistrationRef, DemoUser } from "../context";
import { DAY_MS, parkPrintJobs, pick, type PrintState, type ShowcaseOrder } from "./helpers";
import { ensureOnsiteSettings, orderedForCap, recordOnsitePrints } from "./onsite";
import { attemptPayments, settleOrder } from "./payments";
import { SCENARIOS, type Scenario } from "./scenarios";
import { computeWindow, retimeRequest, retimeSupplement } from "./timeline";

export type Phase = "draft" | "submitted" | "revision" | "quoted" | "accepted" | "paid" | "produced" | "done";

/** Ce que les hooks (conversation, planches) savent d'une commande en cours de cycle. */
export type ScenarioRef = {
  scenario: Scenario;
  requestId: string;
  event: DemoEvent;
  org: DemoOrg;
  owner: DemoUser;
  staff: DemoUser;
  support: DemoUser;
  /** Version du devis courant (0 avant le premier envoi). */
  version: number;
};
export type ScenarioHooks = Partial<Record<Phase, (ref: ScenarioRef) => Promise<void>>>;

const iso = (d: Date) => d.toISOString().slice(0, 10);

const SERVICE_LABEL = "Conception graphique du fond de badge";
const CUSTOM_LABEL = "Livraison express sur site";
const REMOVED_LABEL = "Frais de dossier";

/** Proprietaire de l'organisation (celui qui accepte les devis) ; cree s'il manque dans le registre. */
export async function ownerFor(ctx: DemoContext, state: PrintState, org: DemoOrg): Promise<DemoUser> {
  const cached = state.owners.get(org.id);
  if (cached) return cached;
  let owner = ctx.registry.orgMembers.get(org.id)?.OWNER[0];
  if (!owner) {
    const local = `owner.${org.slug.replace(/^demo-/, "")}`;
    const firstName = ctx.faker.person.firstName();
    const lastName = ctx.faker.person.lastName();
    const email = `${local}@demo.local`;
    const created = await prisma.user.create({
      data: { email, password: ctx.passwordHash, name: `${firstName} ${lastName}`, firstName, lastName, emailVerifiedAt: ctx.dates.now },
    });
    await prisma.orgMembership.create({ data: { userId: created.id, orgId: org.id, role: "OWNER", roleId: await systemRoleId(prisma, "OWNER") } });
    owner = { id: created.id, email: created.email, name: created.name };
    const bucket = ctx.registry.orgMembers.get(org.id) ?? { OWNER: [], MANAGER: [], AUDITOR: [], AGENT: [] };
    bucket.OWNER.push(owner);
    ctx.registry.orgMembers.set(org.id, bucket);
    ctx.recordAccount(email, "OWNER", `Propriétaire de ${org.name} (commandes d'impression)`);
  }
  state.owners.set(org.id, owner);
  return owner;
}

function freeRegistrations(ctx: DemoContext, state: PrintState, event: DemoEvent): DemoRegistrationRef[] {
  const claimed = state.claimed.get(event.id);
  return (ctx.registry.registrations.get(event.id)?.APPROVED ?? []).filter((r) => !claimed?.has(r.id));
}

type Choice = { event: DemoEvent; org: DemoOrg; free: DemoRegistrationRef[] };

/** Evenement du scenario : organisation voulue d'abord, puis n'importe quelle autre, phases par preference. */
function chooseEvent(ctx: DemoContext, state: PrintState, s: Scenario): Choice | null {
  const orgs = ctx.registry.orgs.filter((o) => !o.archived);
  const preferred = orgs.find((o) => o.slug === s.org);
  const ordered = [...(preferred ? [preferred] : []), ...orgs.filter((o) => o !== preferred)];
  for (const org of ordered) {
    for (const phase of s.phases) {
      const candidates = (ctx.registry.eventsByOrg.get(org.id) ?? []).filter((e) => !e.archived && e.phase === phase);
      const scored = candidates.map((event) => {
        const free = s.type === "ADVANCE"
          ? freeRegistrations(ctx, state, event)
          : (ctx.registry.registrations.get(event.id)?.APPROVED ?? []);
        return { event, org, free };
      });
      scored.sort((a, b) => b.free.length - a.free.length);
      const best = scored[0];
      const needed = s.type === "ADVANCE" ? 1 : s.key === "o-completed-supplement" ? 2 : 0;
      if (best && best.free.length >= needed) {
        return best;
      }
    }
  }
  return null;
}

async function productConfig(product: PrintProduct, quantity: number): Promise<OptionChoice[] | null> {
  const loaded = await loadProductForPricing(product.id);
  if (!loaded) return null;
  const choices = defaultConfiguration(loaded).choices;
  return validateChoices(loaded, choices, quantity).ok ? choices : null;
}

async function organizerProducts(state: PrintState, index: number, badges: number, withAccessory: number | null) {
  const badge = pick(state.products.badge, index);
  const choices = await productConfig(badge, badges);
  if (!choices) throw new Error(`Configuration par defaut invalide pour ${badge.slug}`);
  const products: Array<{ productId: string; quantity: number | null; choices: OptionChoice[] }> = [
    { productId: badge.id, quantity: null, choices },
  ];
  if (withAccessory !== null) {
    const accessory = pick(state.products.accessories, withAccessory);
    // Quantité d'accessoire plafonnée au nombre de badges (spec 39) : on prend ce nombre, sans accessoire sous son minimum.
    const accChoices = badges >= accessory.minQuantity ? await productConfig(accessory, badges) : null;
    if (accChoices) products.push({ productId: accessory.id, quantity: badges, choices: accChoices });
  }
  return products;
}

const nameOf = (ctx: DemoContext) => ctx.faker.person.fullName();
const phoneOf = (ctx: DemoContext) => ctx.faker.phone.number({ style: "international" });

const sleepFree = async (ctx: DemoContext, state: PrintState) => {
  await parkPrintJobs(ctx, state);
};

/**
 * Rejoue un scenario par les fonctions du domaine (createDraft, submit, devis, paiement...), puis ramene
 * les horodatages dans le passe. Retourne null si aucun evenement ne convient.
 */
export async function runScenario(
  ctx: DemoContext,
  state: PrintState,
  s: Scenario,
  hooks: ScenarioHooks = {},
): Promise<ShowcaseOrder | null> {
  const choice = chooseEvent(ctx, state, s);
  if (!choice) {
    console.warn(`[seed demo] impression : aucun evenement pour le scenario ${s.key}, ignore`);
    return null;
  }
  const { event, org } = choice;
  const owner = await ownerFor(ctx, state, org);
  const staff = state.staffAdmin;
  const support = state.staffSupport;
  const window = computeWindow(ctx, event, s);

  const draft = await createDraft({ eventId: event.id, orgId: org.id, type: s.type, userId: owner.id, now: ctx.dates.now });
  const requestId = draft.id;
  const ref: ScenarioRef = { scenario: s, requestId, event, org, owner, staff, support, version: 0 };
  const reserving = !["DRAFT", "REJECTED", "CANCELLED"].includes(s.target);

  let badgeCount: number;
  if (s.type === "ADVANCE") {
    const regs = choice.free.slice(0, Math.min(s.badgeCount, choice.free.length));
    badgeCount = regs.length;
    await setBadges({ requestId, eventId: event.id, userId: owner.id, selection: { mode: "IDS", registrationIds: regs.map((r) => r.id) } });
    if (reserving) {
      const set = state.claimed.get(event.id) ?? new Set<string>();
      for (const r of regs) set.add(r.id);
      state.claimed.set(event.id, set);
    }
    await setOrganizerProducts({
      requestId, eventId: event.id, userId: owner.id,
      products: await organizerProducts(state, s.key.length, badgeCount, null),
    });
    const wanted = iso(new Date(event.date.getTime() - 7 * DAY_MS));
    await updateDetails({
      requestId, eventId: event.id, userId: owner.id,
      patch: s.delivery === "DELIVERY"
        ? {
            delivery: "DELIVERY",
            deliveryAddress: `${ctx.faker.location.streetAddress()}, ${ctx.faker.location.city()}`,
            deliveryContactName: nameOf(ctx),
            deliveryContactPhone: phoneOf(ctx),
            wantedBy: wanted,
            notes: "Livraison à l'accueil, merci de prévenir 24 h avant.",
          }
        : { delivery: "PICKUP", wantedBy: wanted },
    });
  } else {
    const available = choice.free.length;
    badgeCount = s.onsite?.ordered ?? (s.onsite?.printedRatio && s.onsite.printedRatio > 1 ? orderedForCap(available) : s.badgeCount);
    const day = iso(event.date);
    const nextDay = iso(new Date(event.date.getTime() + DAY_MS));
    await updateDetails({
      requestId, eventId: event.id, userId: owner.id,
      patch: {
        estimatedQuantity: badgeCount,
        onsiteSchedule: [
          { date: day, from: "08:00", to: "18:00" },
          ...(event.endDate ? [{ date: nextDay, from: "08:30", to: "17:00" }] : []),
        ],
        onsiteLocation: "Hall d'accueil, poste d'impression à côté du comptoir d'inscription",
        onsiteContactName: nameOf(ctx),
        onsiteContactPhone: phoneOf(ctx),
        notes: "Prévoir une prise électrique et une table de 2 m.",
      },
    });
    await setOrganizerProducts({
      requestId, eventId: event.id, userId: owner.id,
      products: await organizerProducts(state, s.key.length, badgeCount, null),
    });
  }
  await hooks.draft?.(ref);
  if (s.target === "DRAFT") return finish(ctx, state, ref, window, badgeCount, 0);

  await submitRequest({ requestId, eventId: event.id, userId: owner.id, now: ctx.dates.now });
  await parkPrintJobs(ctx, state);
  await hooks.submitted?.(ref);
  if (s.target === "SUBMITTED") return finish(ctx, state, ref, window, badgeCount, 0);

  if (s.endsFrom === "SUBMITTED") return conclude(ctx, state, ref, window, badgeCount);

  // Lignes du staff.
  const extras = new Set(s.extras);
  const total = async () => (await prisma.printRequest.findUniqueOrThrow({ where: { id: requestId }, select: { total: true } })).total;
  if (extras.has("SERVICE")) {
    await addStaffLine({ requestId, userId: staff.id, line: { kind: "SERVICE", label: SERVICE_LABEL, quantity: 1, unitPrice: 15000 } });
  }
  if (extras.has("CUSTOM")) {
    await addStaffLine({ requestId, userId: support.id, line: { kind: "CUSTOM", label: CUSTOM_LABEL, quantity: 1, unitPrice: 8000 } });
  }
  if (extras.has("DISCOUNT")) {
    const discount = Math.min(5000, Math.floor((await total()) * 0.15));
    if (discount > 0) {
      await addStaffLine({ requestId, userId: staff.id, line: { kind: "DISCOUNT", label: "Remise fidélité", quantity: 1, unitPrice: -discount } });
    }
  }
  if (extras.has("REMOVED")) {
    await addStaffLine({ requestId, userId: support.id, line: { kind: "CUSTOM", label: REMOVED_LABEL, quantity: 1, unitPrice: 2500 } });
    const added = await prisma.printQuoteLine.findFirstOrThrow({ where: { requestId, label: REMOVED_LABEL, removedAt: null } });
    await removeStaffLine({ requestId, lineId: added.id, userId: support.id });
  }
  if (extras.has("CREDIT") || extras.has("CREDIT_FULL")) {
    const available = await getAvailableOrgPrintCredit(org.id, requestId);
    const current = await total();
    const amount = extras.has("CREDIT_FULL") ? Math.min(available, current) : Math.min(available, Math.floor(current / 2));
    if (amount > 0) await applyOrgCredit({ requestId, amount, userId: staff.id });
  }

  // Devis, allers-retours de l'organisateur, nouveaux envois.
  for (let version = 1; version <= s.quoteVersions; version++) {
    if (version > 1) {
      // L'organisateur change d'accessoire, le staff ajuste ses lignes : le devis repart en revision.
      ref.version = version - 1;
      await setOrganizerProducts({
        requestId, eventId: event.id, userId: owner.id,
        products: await organizerProducts(state, s.key.length, badgeCount, version === 2 ? 0 : 1),
      });
      await hooks.revision?.(ref);
      const service = await prisma.printQuoteLine.findFirst({ where: { requestId, kind: "SERVICE", removedAt: null } });
      if (service) {
        await updateStaffLine({ requestId, lineId: service.id, userId: staff.id, patch: { unitPrice: service.unitPrice - 1000 * (version - 1) } });
      } else {
        await addStaffLine({ requestId, userId: staff.id, line: { kind: "CUSTOM", label: `Ajustement devis v${version}`, quantity: 1, unitPrice: 1500 } });
      }
    }
    await sendQuote({ requestId, userId: version % 2 === 1 ? staff.id : support.id, now: ctx.dates.now });
    await notifyPrintRequestQuoted(requestId, version % 2 === 1 ? staff.id : support.id);
    await parkPrintJobs(ctx, state);
    ref.version = version;
    await hooks.quoted?.(ref);
  }
  await sleepFree(ctx, state);
  if (s.target === "QUOTED") return finish(ctx, state, ref, window, badgeCount, 0);

  if (s.endsFrom === "QUOTED") return conclude(ctx, state, ref, window, badgeCount);

  await acceptQuote({ requestId, eventId: event.id, userId: owner.id, version: ref.version, now: ctx.dates.now });
  await parkPrintJobs(ctx, state);
  await hooks.accepted?.(ref);
  if (s.endsFrom === "ACCEPTED") return conclude(ctx, state, ref, window, badgeCount);
  if (s.target === "ACCEPTED") {
    await attemptPayments(ctx, state, { requestId, orgId: org.id, ownerId: owner.id }, s);
    await sleepFree(ctx, state);
    return finish(ctx, state, ref, window, badgeCount, 0);
  }

  await settleOrder(ctx, state, { requestId, orgId: org.id, ownerId: owner.id }, s);
  await hooks.paid?.(ref);
  if (s.target === "PAID") return finish(ctx, state, ref, window, badgeCount, 0);

  const advance = async (to: "IN_PRODUCTION" | "READY" | "COMPLETED") => {
    const result = await advanceStatus({ requestId, userId: staff.id, to });
    await notifyPrintRequestStatusChanged(requestId, staff.id, { organizer: true, staff: false });
    await parkPrintJobs(ctx, state);
    return result;
  };
  await advance("IN_PRODUCTION");
  await hooks.produced?.(ref);
  if (s.type === "ONSITE" && ["IN_PRODUCTION", "READY", "COMPLETED"].includes(s.target)) {
    const request = await prisma.printRequest.findUniqueOrThrow({ where: { id: requestId } });
    await recordOnsitePrints(ctx, state, event, request, s);
  }
  if (s.target === "IN_PRODUCTION") return finish(ctx, state, ref, window, badgeCount, 0);
  await advance("READY");
  if (s.target === "READY") return finish(ctx, state, ref, window, badgeCount, 0);
  const done = await advance("COMPLETED");
  await hooks.done?.(ref);
  return finish(ctx, state, ref, window, badgeCount, done.closure?.outcome === "SUPPLEMENT" ? 1 : 0);
}

async function conclude(ctx: DemoContext, state: PrintState, ref: ScenarioRef, window: ReturnType<typeof computeWindow>, badgeCount: number) {
  const { scenario: s, requestId, event, owner, staff } = ref;
  if (s.target === "REJECTED") {
    await rejectRequest({
      requestId, userId: staff.id,
      reason: "Le délai de production demandé n'est pas compatible avec notre planning. Merci de repousser la date de livraison d'au moins deux semaines.",
    });
    await notifyPrintRequestStatusChanged(requestId, staff.id, { organizer: true, staff: false });
  } else {
    await cancelRequest({ requestId, eventId: event.id, userId: owner.id });
  }
  await parkPrintJobs(ctx, state);
  await sleepFree(ctx, state);
  return finish(ctx, state, ref, window, badgeCount, 0);
}

async function finish(
  ctx: DemoContext,
  state: PrintState,
  ref: ScenarioRef,
  window: ReturnType<typeof computeWindow>,
  _badgeCount: number,
  supplements: number,
): Promise<ShowcaseOrder> {
  void _badgeCount;
  await parkPrintJobs(ctx, state);
  const order: ShowcaseOrder = {
    key: ref.scenario.key, requestId: ref.requestId, eventId: ref.event.id, orgId: ref.org.id,
    type: ref.scenario.type, ownerId: ref.owner.id, window,
  };
  await retimeRequest(ctx, order, window);
  if (supplements > 0) {
    const child = await prisma.printRequest.findFirst({ where: { parentRequestId: ref.requestId } });
    const parent = await prisma.printRequest.findUniqueOrThrow({ where: { id: ref.requestId }, select: { completedAt: true } });
    if (child) await retimeSupplement(ctx, child.id, parent.completedAt ?? window.end);
  }
  state.orders.set(ref.scenario.key, ref.requestId);
  state.showcase.set(ref.scenario.key, order);
  return order;
}

/** Commandes vitrine : un cas par statut et par type, rejoues etape par etape. */
export async function seedShowcaseOrders(
  ctx: DemoContext,
  state: PrintState,
  hooks: ScenarioHooks = {},
): Promise<Map<string, string>> {
  await ensureOnsiteSettings(ctx);
  for (const scenario of SCENARIOS) {
    const start = Date.now();
    await runScenario(ctx, state, scenario, hooks);
    if (process.env.DEMO_SEED_VERBOSE) console.log(`[seed demo] impression / ${scenario.key} : ${Date.now() - start} ms`);
  }
  return state.orders;
}

