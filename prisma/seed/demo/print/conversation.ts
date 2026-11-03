import { prisma } from "../../../../src/lib/prisma";
import { appendThreadEvent, postMessage } from "../../../../src/lib/print-requests/thread";
import { markRead } from "../../../../src/lib/print-requests/read-state";
import { notifyPrintRequestMessage } from "../../../../src/lib/notifications/triggers";
import type { DemoContext } from "../context";
import { SCENARIOS } from "./scenarios";
import { makePdf, MINUTE_MS, parkPrintJobs, pickPhoto, type PrintState } from "./helpers";
import type { ScenarioHooks, ScenarioRef } from "./orders";

type Side = "ORGANIZER" | "STAFF";

const ORGANIZER_QUESTIONS = [
  "Bonjour, nous aimerions recevoir les badges au plus tard une semaine avant l'évènement. Est-ce réalisable ?",
  "Bonsoir, pouvez-vous confirmer que le logo de l'évènement sera bien imprimé en haut à gauche ?",
  "Bonjour, une dizaine de participants se sont ajoutés cette semaine. La quantité peut-elle être ajustée ?",
  "Merci pour votre retour. Pouvez-vous préciser le délai de livraison à Cotonou ?",
];
const STAFF_ANSWERS = [
  "Bonjour, oui c'est possible si le devis est accepté avant la fin de la semaine. Nous vous envoyons le détail.",
  "Bonjour, le logo sera reproduit à l'identique d'après la maquette fournie. Une épreuve vous sera transmise.",
  "Bonjour, nous pouvons ajuster la quantité tant que la production n'a pas démarré. Merci de mettre à jour la commande.",
  "Bonjour, comptez trois jours ouvrés après la fin de la production. Nous vous prévenons dès l'expédition.",
];
const INTERNAL_NOTES = [
  "Vérifier le stock de cordons avant d'envoyer le devis.",
  "Client fidèle : appliquer la remise habituelle si la quantité dépasse 200.",
  "Contrôler la maquette fournie (fond perdu et résolution) avant impression.",
];
const REVISION_REQUESTS = [
  "Nous avons ajouté des porte-badges à la commande, pouvez-vous revoir le devis ?",
  "Nous préférons un autre accessoire, voir la nouvelle sélection dans la commande.",
];
const QUOTE_REMARKS = [
  "Le devis nous convient dans l'ensemble, pouvez-vous seulement revoir le prix du cordon ?",
  "Merci pour le devis. Le délai de production est-il bien de cinq jours ?",
];

export async function postDemoMessage(
  ctx: DemoContext,
  state: PrintState,
  ref: ScenarioRef,
  side: Side,
  body: string,
  opts: { internal?: boolean; attachment?: "png" | "pdf"; author?: "admin" | "support" } = {},
): Promise<void> {
  const authorId = side === "ORGANIZER"
    ? ref.owner.id
    : (opts.author === "admin" ? ref.staff.id : ref.support.id);
  let attachmentKey: string | null = null;
  if (opts.attachment) {
    const n = state.attachmentSeq++;
    const name = `demo-${n}.${opts.attachment}`;
    const prefix = side === "STAFF" ? `print-requests/staff/${ref.requestId}/` : `print-requests/${ref.event.id}/`;
    attachmentKey = `${prefix}${name}`;
    if (opts.attachment === "png") {
      const photo = await pickPhoto(ctx, n);
      await ctx.storage.putAt(attachmentKey, photo.body, photo.contentType);
    } else {
      await ctx.storage.putAt(attachmentKey, await makePdf(side === "STAFF" ? "Devis détaillé (démo)" : "Maquette (démo)"), "application/pdf");
    }
  }
  const message = await postMessage({ requestId: ref.requestId, authorId, side, body, attachmentKey, internal: opts.internal });
  if (!opts.internal) await notifyPrintRequestMessage(message.id, authorId);
}

const plan = (ref: ScenarioRef) => ref.scenario.conversation;
const pickText = (ctx: DemoContext, list: string[]) => ctx.faker.helpers.arrayElement(list);

/** Hooks de cycle : le fil est ecrit en meme temps que la commande, donc dans l'ordre naturel. */
export function conversationHooks(ctx: DemoContext, state: PrintState): ScenarioHooks {
  const post = (ref: ScenarioRef, side: Side, body: string, opts?: Parameters<typeof postDemoMessage>[4]) =>
    postDemoMessage(ctx, state, ref, side, body, opts);

  return {
    async submitted(ref) {
      if (plan(ref) === "none") return;
      const full = plan(ref) === "full";
      await post(ref, "ORGANIZER", pickText(ctx, ORGANIZER_QUESTIONS), full ? { attachment: "png" } : undefined);
      await post(ref, "STAFF", pickText(ctx, STAFF_ANSWERS), full ? { attachment: "pdf" } : undefined);
      if (full) await post(ref, "STAFF", pickText(ctx, INTERNAL_NOTES), { internal: true, author: "admin" });
    },
    async revision(ref) {
      if (plan(ref) === "none") return;
      await post(ref, "ORGANIZER", pickText(ctx, REVISION_REQUESTS));
      if (plan(ref) === "full" && ref.version === 1 && ref.scenario.key === "a-quoted-v3") {
        const count = await prisma.printRequestItem.count({ where: { requestId: ref.requestId } });
        await prisma.$transaction(async (tx) => {
          await appendThreadEvent(tx, ref.requestId, "BADGES_CHANGED", { added: 1, removed: 0, count, lagging: [] }, { userId: ref.owner.id, side: "ORGANIZER" });
          await appendThreadEvent(tx, ref.requestId, "TEMPLATE_CHANGED", {
            fromLabel: "Badge standard (démo)", toLabel: "Badge recto-verso (démo)", acceptanceCancelled: false,
          });
          const ids = (ctx.registry.registrations.get(ref.event.id)?.PENDING ?? []).slice(0, 2).map((r) => r.id);
          if (ids.length > 0) await appendThreadEvent(tx, ref.requestId, "REGISTRATIONS_SKIPPED", { registrationIds: ids });
        });
      }
    },
    async quoted(ref) {
      if (plan(ref) === "none") return;
      if (ref.version === 1 || plan(ref) === "full") {
        await post(ref, "STAFF", `Le devis v${ref.version} est disponible. N'hésitez pas à nous poser vos questions.`, { author: "admin" });
        if (plan(ref) === "full" || ref.version === 1) await post(ref, "ORGANIZER", pickText(ctx, QUOTE_REMARKS));
      }
    },
    async accepted(ref) {
      if (plan(ref) === "none") return;
      await post(ref, "ORGANIZER", "Merci, nous procédons au paiement du devis accepté.");
      if (plan(ref) === "full") await post(ref, "STAFF", "Rapprocher le paiement dès réception avant de lancer la production.", { internal: true });
    },
    async paid(ref) {
      if (plan(ref) === "none") return;
      await post(ref, "STAFF", "Paiement bien reçu, nous lançons la production dans les meilleurs délais.", { author: "admin" });
      if (plan(ref) === "full" && ref.scenario.key === "o-completed-supplement") {
        // Marge relevee par le staff : l'entree reste interne (le motif n'est jamais montre a l'organisateur).
        await prisma.printRequest.update({ where: { id: ref.requestId }, data: { marginPercent: 15 } });
        await prisma.$transaction((tx) =>
          appendThreadEvent(tx, ref.requestId, "ONSITE_MARGIN_CHANGED", { from: 10, to: 15, reason: "Affluence prévue supérieure aux inscriptions" }, { userId: ref.staff.id, side: "STAFF" }, { internal: true }),
        );
      }
    },
    async done(ref) {
      if (plan(ref) === "none") return;
      await post(ref, "STAFF", "La commande est terminée, merci de votre confiance !", { author: "admin" });
      await post(ref, "ORGANIZER", "Merci à toute l'équipe, tout s'est très bien passé.");
    },
  };
}

/** Lectures du fil (apres le recalage des horodatages) : lu partout, en retard cote staff ou organisateur, jamais ouvert. */
export async function seedReadStates(ctx: DemoContext, state: PrintState): Promise<void> {
  for (const order of state.showcase.values()) {
    const scenario = SCENARIOS.find((s) => s.key === order.key)!;
    const request = await prisma.printRequest.findUniqueOrThrow({ where: { id: order.requestId }, select: { status: true } });
    if (request.status === "DRAFT") continue;
    const entries = await prisma.printRequestMessage.findMany({
      where: { requestId: order.requestId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { side: true, internal: true, createdAt: true },
    });
    const last = (predicate: (e: (typeof entries)[number]) => boolean) => [...entries].reverse().find(predicate);
    const lastVisible = last((e) => !e.internal);
    const lastOrganizer = last((e) => e.side === "ORGANIZER");
    const lastStaffVisible = last((e) => e.side === "STAFF" && !e.internal);
    const end = ctx.dates.now;
    const before = (d: Date) => new Date(d.getTime() - 1000);
    const { staffAdmin, staffSupport } = state;
    const read = (userId: string, at: Date) => markRead(order.requestId, userId, at);

    let ownerAt: Date | null = end;
    let adminAt: Date = end;
    switch (scenario.reads) {
      case "staffBehind":
        if (lastOrganizer) adminAt = before(lastOrganizer.createdAt);
        break;
      case "orgBehind":
        if (lastStaffVisible) ownerAt = before(lastStaffVisible.createdAt);
        break;
      case "orgBehindInternal": {
        // Une note interne posterieure a la derniere lecture de l'organisateur : il ne la compte jamais.
        const noteAt = new Date(Math.min((lastVisible?.createdAt ?? end).getTime() + 30 * MINUTE_MS, end.getTime() - MINUTE_MS));
        await prisma.printRequestMessage.create({
          data: {
            requestId: order.requestId, authorId: staffSupport.id, side: "STAFF", kind: "MESSAGE", internal: true,
            body: "Vérifier le stock de cordons avant la prochaine expédition.",
          },
        }).then((m) => ctx.backdate("printRequestMessage", m.id, noteAt));
        ownerAt = lastVisible?.createdAt ?? end;
        adminAt = ownerAt;
        break;
      }
      case "neverOpened":
        ownerAt = null;
        break;
      default:
        break;
    }
    if (ownerAt) await read(order.ownerId, ownerAt);
    await read(staffAdmin.id, adminAt);
    await read(staffSupport.id, end);
  }
  await parkPrintJobs(ctx, state);
}
