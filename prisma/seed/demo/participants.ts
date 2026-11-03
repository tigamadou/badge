import type { Prisma, ProfileStatus } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma";
import { DEMO_DOMAIN } from "../constants";
import { insertInBatches, type DemoContext, type DemoUser } from "./context";

type Draft = {
  email: string;
  firstName: string;
  lastName: string;
  status: ProfileStatus;
  /** APPROVED uniquement : une première soumission rejetée précède l'approbation. */
  resubmitted: boolean;
  scenario?: string;
};

const DOC_TYPES = ["CNI", "PASSEPORT", "PERMIS"];
const REJECTION_DETAILS = [
  "Le document transmis est difficilement lisible, merci de le renvoyer en meilleure qualité.",
  "Les informations saisies ne correspondent pas à celles de la pièce jointe.",
  "La photo ne permet pas d'identifier clairement le participant.",
];

/** Motifs du catalogue (seed minimal) acceptés pour une portée donnée. */
export async function loadRejectionReasons(scopes: Array<"PROFILE" | "REGISTRATION" | "BOTH">) {
  const reasons = await prisma.rejectionReason.findMany({
    where: { archived: false, scope: { in: scopes } },
    orderBy: { sortOrder: "asc" },
  });
  if (reasons.length === 0) {
    throw new Error("Catalogue de motifs de rejet vide : lancer le seed minimal avant le seed de demo");
  }
  return reasons;
}

function reviewerId(ctx: DemoContext): string {
  const { staff } = ctx.registry;
  const reviewer = staff.STAFF_SUPPORT[0] ?? staff.STAFF_ADMIN[0] ?? staff.SUPER_ADMIN[0];
  if (!reviewer) throw new Error("Aucun compte staff de demo pour relire les profils");
  return reviewer.id;
}

function buildDrafts(ctx: DemoContext, count: number): Draft[] {
  const { faker } = ctx;
  const approved = Math.max(count, 2);
  const extras = Math.max(3, Math.round(approved * 0.08));
  const resubmitted = Math.max(1, Math.round(approved * 0.08));
  const pending = Math.max(1, Math.round(extras * 0.4));
  const rejected = Math.max(1, Math.round(extras * 0.3));
  const incomplete = Math.max(1, extras - pending - rejected);

  const plan: Array<{ status: ProfileStatus; resubmitted: boolean }> = [
    ...Array.from({ length: approved }, (_, i) => ({ status: "APPROVED" as const, resubmitted: i < resubmitted })),
    ...Array.from({ length: pending }, () => ({ status: "PENDING" as const, resubmitted: false })),
    ...Array.from({ length: rejected }, () => ({ status: "REJECTED" as const, resubmitted: false })),
    ...Array.from({ length: incomplete }, () => ({ status: "INCOMPLETE" as const, resubmitted: false })),
  ];
  const padding = String(plan.length).length < 4 ? 4 : String(plan.length).length;
  return plan.map((p, i) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      ...p,
      firstName,
      lastName,
      email: `participant.${String(i + 1).padStart(padding, "0")}${DEMO_DOMAIN}`,
    };
  });
}

/**
 * Crée `count` participants à profil APPROUVÉ (plus quelques profils en attente, rejetés et incomplets)
 * avec leurs soumissions de profil, et retourne les seuls profils APPROUVÉS (les inscriptibles).
 */
export async function seedParticipants(ctx: DemoContext, count: number): Promise<DemoUser[]> {
  const { faker, dates, images } = ctx;
  const reasons = await loadRejectionReasons(["PROFILE", "BOTH"]);
  const reviewer = reviewerId(ctx);

  const drafts = buildDrafts(ctx, count);
  // Comptes historiques de l'ancien seed, recréés ici avec le profil qu'ils illustrent.
  const historic: Draft[] = [
    { email: "participant@badge.local", firstName: "Camille", lastName: "Démo", status: "APPROVED", resubmitted: false, scenario: "Participant historique, profil validé" },
    { email: "profil-attente@badge.local", firstName: "Alix", lastName: "Attente", status: "PENDING", resubmitted: false, scenario: "Profil en attente de validation" },
    { email: "profil-rejete@badge.local", firstName: "Robin", lastName: "Rejeté", status: "REJECTED", resubmitted: false, scenario: "Profil rejeté" },
  ];
  const all = [...historic, ...drafts];

  const photo = (i: number) => images.photos[i % images.photos.length];
  const userRows: Prisma.UserCreateManyInput[] = [];
  const submissions: Array<Prisma.ProfileSubmissionCreateManyInput & { email: string }> = [];

  all.forEach((d, i) => {
    const fields = {
      photo: photo(i),
      idDocumentType: DOC_TYPES[i % DOC_TYPES.length],
      idDocumentNumber: faker.string.alphanumeric({ length: 9, casing: "upper" }),
      idDocument: photo(i + 7),
    };
    const created = dates.between(300, 360);
    const complete = d.status !== "INCOMPLETE";
    userRows.push({
      email: d.email,
      password: ctx.passwordHash,
      name: `${d.firstName} ${d.lastName}`,
      firstName: d.firstName,
      lastName: d.lastName,
      structure: faker.company.name(),
      emailVerifiedAt: created,
      createdAt: created,
      profileStatus: d.status,
      lastLoginAt: i % 3 === 0 ? dates.between(0, 20) : null,
      ...(complete ? { ...fields, participantProfileCompletedAt: dates.between(250, 295) } : {}),
    });
    if (!complete) return;

    const reason = () => faker.helpers.arrayElement(reasons);
    const rejection = () => {
      const r = reason();
      return {
        status: "REJECTED" as const,
        rejectionReasonId: r.id,
        rejectionReasonLabel: r.label,
        rejectionDetails: faker.helpers.arrayElement(REJECTION_DETAILS),
        reviewedById: reviewer,
        reviewedAt: dates.between(260, 290),
      };
    };
    const base = { email: d.email, userId: "", ...fields };
    if (d.resubmitted) {
      submissions.push({ ...base, ...rejection(), createdAt: dates.between(296, 300) });
    }
    if (d.status === "APPROVED") {
      submissions.push({ ...base, status: "APPROVED", reviewedById: reviewer, reviewedAt: dates.between(240, 255), createdAt: dates.between(256, 259) });
    } else if (d.status === "PENDING") {
      submissions.push({ ...base, status: "PENDING", createdAt: dates.between(0, 4) });
    } else {
      submissions.push({ ...base, ...rejection(), createdAt: dates.between(296, 300) });
    }
  });

  await insertInBatches(userRows, (chunk) => prisma.user.createMany({ data: chunk }));

  const emails = all.map((d) => d.email);
  const byEmail = new Map<string, DemoUser>();
  for (let i = 0; i < emails.length; i += 1000) {
    const rows = await prisma.user.findMany({ where: { email: { in: emails.slice(i, i + 1000) } } });
    for (const u of rows) byEmail.set(u.email, { id: u.id, email: u.email, name: u.name });
  }

  const subRows: Prisma.ProfileSubmissionCreateManyInput[] = submissions.map(({ email, ...row }) => ({
    ...row,
    userId: byEmail.get(email)!.id,
  }));
  await insertInBatches(subRows, (chunk) => prisma.profileSubmission.createMany({ data: chunk }));

  const { registry } = ctx;
  const approvedUsers: DemoUser[] = [];
  let firstIncomplete: DemoUser | undefined;
  for (const d of all) {
    const user = byEmail.get(d.email)!;
    if (d.scenario) ctx.recordAccount(d.email, "PARTICIPANT", d.scenario);
    if (d.status === "APPROVED") approvedUsers.push(user);
    if (d.email === "profil-attente@badge.local") registry.special.profilePending = user;
    if (d.email === "profil-rejete@badge.local") registry.special.profileRejected = user;
    if (d.status === "INCOMPLETE" && !firstIncomplete) firstIncomplete = user;
  }
  if (firstIncomplete) {
    registry.special.profileIncomplete = firstIncomplete;
    ctx.recordAccount(firstIncomplete.email, "PARTICIPANT", "Profil incomplet (aucune pièce envoyée)");
  }
  registry.participants.push(...approvedUsers);
  return approvedUsers;
}
