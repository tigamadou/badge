import type { Prisma, RegistrationStatus } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma";
import { generateId } from "../../../src/lib/generate-id";
import {
  insertInBatches,
  type DemoContext, type DemoEvent, type DemoOrg, type DemoRegistrationRef,
} from "./context";
import { loadRejectionReasons, seedParticipants } from "./participants";

const DAY_MS = 86_400_000;
const HISTORIC_EMAIL = "participant@badge.local";

type Mix = { approved: number; pending: number; rejected: number; printed: number };
const MIX: Record<DemoEvent["phase"], Mix> = {
  past: { approved: 88, pending: 5, rejected: 7, printed: 0.9 },
  ongoing: { approved: 70, pending: 20, rejected: 10, printed: 0.6 },
  upcoming: { approved: 35, pending: 50, rejected: 15, printed: 0.03 },
};

// Cibles a scale 1 (somme ~7 500 ; la grosse organisation depasse 3 000 sur son evenement en cours).
function targetFor(org: DemoOrg, event: DemoEvent, rankInPhase: number): number {
  switch (org.size) {
    case "huge":
      if (event.phase === "ongoing") return 3200;
      if (event.phase === "past") return rankInPhase === 0 ? 450 : 700;
      return rankInPhase === 0 ? 250 : 150;
    case "medium":
      return event.phase === "ongoing" ? 350 : event.phase === "past" ? 250 : 120;
    case "small":
      return event.phase === "ongoing" ? 50 : event.phase === "past" ? 40 : 25;
    case "archived":
      return 30;
  }
}

const REJECTION_DETAILS = [
  "Le profil ne correspond pas à la catégorie demandée.",
  "Le nombre de places de cette catégorie est atteint.",
  "Une inscription existe déjà pour ce participant sous une autre adresse.",
];

export async function seedRegistrations(ctx: DemoContext): Promise<void> {
  const { faker, dates, registry } = ctx;
  const reasons = await loadRejectionReasons(["REGISTRATION", "BOTH"]);

  await seedParticipants(ctx, ctx.scaled(4500, 12));
  const people = new Map(
    (await prisma.user.findMany({ where: { id: { in: [...registry.participants.map((p) => p.id)] } } })).map((u) => [u.id, u]),
  );
  const historic = [...people.values()].find((u) => u.email === HISTORIC_EMAIL);
  // Les participants de la reserve sont tires sans remise pour un meme evenement (@@unique userId+eventId).
  const poolIds = registry.participants.map((p) => p.id);

  const orgById = new Map(registry.orgs.map((o) => [o.id, o]));
  const rankInPhase = new Map<string, number>();
  for (const events of registry.eventsByOrg.values()) {
    const seen: Record<string, number> = {};
    for (const e of events) rankInPhase.set(e.id, (seen[e.phase] = (seen[e.phase] ?? -1) + 1));
  }

  // Compteur d'identifiants metier par (jour d'evenement, chiffre des unites de la categorie) : le
  // separateur de generateId est aleatoire, donc seul un numero de sequence jamais reutilise garantit
  // l'unicite, y compris au-dela de 999 par categorie (le numero s'allonge alors a 4 chiffres).
  const counters = new Map<string, number>();
  const usedIds = new Set<string>();
  const nextId = (event: DemoEvent, categoryNumber: number): string => {
    const day = event.date.toISOString().slice(0, 10);
    const key = `${day}|${categoryNumber % 10}`;
    const seq = (counters.get(key) ?? 0) + 1;
    counters.set(key, seq);
    const id = generateId({ categoryNumber, date: day, sequentialNumber: seq });
    if (usedIds.has(id)) throw new Error(`Identifiant metier de demo en double : ${id}`);
    usedIds.add(id);
    return id;
  };

  for (const event of registry.events) {
    const org = orgById.get(event.orgId)!;
    const byStatus: Record<RegistrationStatus, DemoRegistrationRef[]> = { PENDING: [], APPROVED: [], REJECTED: [] };
    registry.registrations.set(event.id, byStatus);

    const wanted = Math.min(ctx.scaled(targetFor(org, event, rankInPhase.get(event.id) ?? 0), 4), poolIds.length);
    const chosen = faker.helpers.arrayElements(poolIds, wanted);
    // Le participant historique est inscrit a tous les evenements de la grosse organisation.
    if (historic && org.size === "huge" && !chosen.includes(historic.id)) chosen[0] = historic.id;
    if (event === registry.eventsByPhase.ongoing.find((e) => orgById.get(e.orgId)!.size === "medium")) {
      const dual = registry.special.organizerAndParticipant;
      if (dual && registry.participants.some((p) => p.id === dual.id) && !chosen.includes(dual.id)) chosen[1] = dual.id;
    }

    const mix = MIX[event.phase];
    const weights = [
      { value: "APPROVED" as const, weight: mix.approved },
      { value: "PENDING" as const, weight: mix.pending },
      { value: "REJECTED" as const, weight: mix.rejected },
    ];
    // Poids des categories : la premiere (Participant) domine, la categorie speciale est rare.
    const catWeights = event.categories.map((c, i) => ({ value: c, weight: i === 0 ? 70 : i === 1 ? 15 : i === 2 ? 6 : 9 }));

    const rows: Prisma.RegistrationCreateManyInput[] = [];
    chosen.forEach((userId, i) => {
      const user = people.get(userId)!;
      // Les quatre premiers cas garantissent la presence de chaque etat, quel que soit le facteur d'echelle.
      const forced: RegistrationStatus | null = i === 0 || i === 1 ? "APPROVED" : i === 2 ? "PENDING" : i === 3 ? "REJECTED" : null;
      const status = forced ?? faker.helpers.weightedArrayElement(weights);
      const category = faker.helpers.weightedArrayElement(catWeights);
      const approved = status === "APPROVED";
      const printed = approved && (i === 1 ? event.phase !== "upcoming" : i === 0 ? false : faker.number.float() < mix.printed);

      const earliest = Math.max(event.date.getTime() - 40 * DAY_MS, dates.daysAgo(230).getTime());
      const latest = Math.min(event.date.getTime() - 2 * DAY_MS, dates.daysAgo(1).getTime());
      const createdAt = faker.date.between({ from: new Date(Math.min(earliest, latest - DAY_MS)), to: new Date(latest) });
      const updatedAt = status === "PENDING" ? createdAt : faker.date.between({ from: createdAt, to: dates.now });
      const printedAt = printed ? faker.date.between({ from: updatedAt, to: dates.now }) : null;
      const reason = status === "REJECTED" ? faker.helpers.arrayElement(reasons) : null;

      rows.push({
        id: nextId(event, category.number),
        eventId: event.id,
        categoryId: category.id,
        userId,
        status,
        badgePrinted: printed,
        badgePrintedAt: printedAt,
        allAccessGranted: approved && (i === 0 || faker.number.float() < 0.05),
        rejectionReason: reason?.label ?? null,
        rejectionReasonId: reason?.id ?? null,
        rejectionDetails: reason ? faker.helpers.arrayElement(REJECTION_DETAILS) : null,
        snapshotFirstName: user.firstName!,
        snapshotLastName: user.lastName!,
        snapshotEmail: user.email,
        snapshotStructure: user.structure!,
        snapshotPhoto: user.photo!,
        snapshotIdDocumentType: user.idDocumentType!,
        snapshotIdDocumentNumber: user.idDocumentNumber!,
        snapshotIdDocument: user.idDocument!,
        createdAt,
        updatedAt,
      });
      byStatus[status].push({
        id: rows[rows.length - 1].id as string,
        userId, eventId: event.id, categoryId: category.id, status, badgePrinted: printed,
      });
    });

    // Pas de skipDuplicates : une collision (userId+eventId ou identifiant) doit echouer.
    await insertInBatches(rows, (chunk) => prisma.registration.createMany({ data: chunk }));
  }
}
