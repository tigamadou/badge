import type { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { EMAIL_KIND } from "../../../../src/lib/jobs/enqueue-email";
import { isSensitiveEmailKind } from "../../../../src/lib/jobs/email-kinds";
import { EMAIL_PRIORITY_VALUE, LAST_ERROR_MAX_LENGTH } from "../../../../src/lib/jobs/constants";
import { escapeHtml } from "../../../../src/lib/mail-helpers";
import { DEMO_DOMAIN } from "../../constants";
import type { DemoContext } from "../context";
import type { DemoWorld, WorldOrg, WorldUser } from "../billing/world";

const DAY_MS = 86_400_000;
const FAR_FUTURE_DAYS = 3650;

export type SeededJobs = {
  failed: { id: string; kind: string; recipient: string; attempts: number; completedAt: Date }[];
  cancelled: { id: string; kind: string; completedAt: Date }[];
  /** Jobs relancés par le staff (FAILED repassé en attente d'un nouvel essai). */
  retried: { id: string; kind: string; at: Date }[];
};

type Audience = "participant" | "owner" | "staff";
type Template = {
  kind: string;
  audience: Audience;
  subject: (c: { event: string; org: string }) => string;
  text: (c: { event: string; org: string }) => string;
};

const TEMPLATES: Template[] = [
  { kind: EMAIL_KIND.REGISTRATION_RECEIVED, audience: "participant",
    subject: (c) => `Inscription reçue : ${c.event}`, text: (c) => `Votre inscription à ${c.event} a bien été reçue.` },
  { kind: EMAIL_KIND.REGISTRATION_APPROVED, audience: "participant",
    subject: (c) => `Inscription approuvée : ${c.event}`, text: (c) => `Votre inscription à ${c.event} a été approuvée.` },
  { kind: EMAIL_KIND.REGISTRATION_REJECTED, audience: "participant",
    subject: (c) => `Inscription rejetée : ${c.event}`, text: (c) => `Votre inscription à ${c.event} a été rejetée.` },
  { kind: EMAIL_KIND.BADGE_PRINTED, audience: "participant",
    subject: (c) => `Votre badge est prêt : ${c.event}`, text: (c) => `Votre badge pour ${c.event} a été imprimé.` },
  { kind: EMAIL_KIND.ACCOUNT_VERIFY_EMAIL, audience: "participant",
    subject: () => "Confirmez votre adresse email", text: () => "Confirmez votre adresse email depuis votre espace (lien masqué dans la démo)." },
  { kind: EMAIL_KIND.ACCOUNT_PASSWORD_RESET, audience: "participant",
    subject: () => "Réinitialisation de votre mot de passe", text: () => "Une réinitialisation de mot de passe a été demandée (lien masqué dans la démo)." },
  { kind: EMAIL_KIND.USER_INVITATION, audience: "owner",
    subject: (c) => `Invitation à rejoindre ${c.org}`, text: (c) => `Vous êtes invité(e) à rejoindre ${c.org} (lien masqué dans la démo).` },
  { kind: EMAIL_KIND.PROFILE_APPROVED, audience: "participant",
    subject: () => "Profil validé", text: () => "Votre profil a été validé." },
  { kind: EMAIL_KIND.PROFILE_REJECTED, audience: "participant",
    subject: () => "Documents refusés", text: () => "Les documents de votre profil ont été refusés." },
  { kind: "notification.registration_created", audience: "owner",
    subject: (c) => `Nouvelle inscription : ${c.event}`, text: (c) => `Un participant s'est inscrit à ${c.event}.` },
  { kind: "notification.subscription_changed", audience: "owner",
    subject: (c) => `Abonnement modifié : ${c.org}`, text: (c) => `L'abonnement de ${c.org} a été modifié.` },
  { kind: "notification.subscription_expiring", audience: "owner",
    subject: (c) => `Votre abonnement expire bientôt : ${c.org}`, text: (c) => `L'abonnement de ${c.org} arrive à échéance.` },
  { kind: "notification.org_created", audience: "staff",
    subject: (c) => `Nouvelle organisation : ${c.org}`, text: (c) => `L'organisation ${c.org} vient d'être créée.` },
];

const FAILURES = [
  "Connection timeout to smtp.demo.local:587 (ETIMEDOUT)",
  "550 5.1.1 The email account that you tried to reach does not exist",
  "421 4.7.0 Try again later, closing connection",
  "Greeting never received (ECONNRESET)",
];

/** Statuts répartis 55 % réussis, 15 % échoués, 15 % en attente, 10 % annulés, 5 % en cours ; les cinq présents dès le départ. */
function statusPlan(total: number): JobStatus[] {
  const pattern: JobStatus[] = [
    "SUCCEEDED", "RUNNING", "FAILED", "SUCCEEDED", "PENDING", "SUCCEEDED", "CANCELLED", "SUCCEEDED", "SUCCEEDED", "FAILED",
    "PENDING", "SUCCEEDED", "SUCCEEDED", "SUCCEEDED", "CANCELLED", "SUCCEEDED", "PENDING", "SUCCEEDED", "FAILED", "SUCCEEDED",
  ];
  return Array.from({ length: total }, (_, i) => pattern[i % pattern.length]);
}

export async function cleanupJobs(): Promise<number> {
  const res = await prisma.job.deleteMany({ where: { recipient: { endsWith: DEMO_DOMAIN } } });
  return res.count;
}

export async function seedJobs(ctx: DemoContext, world: DemoWorld): Promise<SeededJobs> {
  await cleanupJobs();
  const { faker, dates } = ctx;
  const now = dates.now;
  const demoOnly = (users: WorldUser[]) => users.filter((u) => u.email.endsWith(DEMO_DOMAIN));
  const pools: Record<Audience, WorldUser[]> = {
    participant: demoOnly(world.participants),
    owner: demoOnly(world.orgs.flatMap((o) => [...o.owners, ...o.members])),
    staff: demoOnly(world.staff),
  };
  const fallback = pools.participant.length > 0 ? pools.participant : demoOnly(world.staff);
  const seeded: SeededJobs = { failed: [], cancelled: [], retried: [] };
  // Monde vide (modules du socle absents ou mockes) : rien a envoyer.
  if (fallback.length === 0) return seeded;

  const orgsWithEvents = world.orgs.filter((o) => o.events.some((e) => !e.archived));
  const contextOf = (): { event: string; org: string } => {
    const org: WorldOrg = orgsWithEvents.length > 0 ? faker.helpers.arrayElement(orgsWithEvents) : world.orgs[0];
    const events = org.events.filter((e) => !e.archived);
    return { org: org.name, event: events.length > 0 ? faker.helpers.arrayElement(events).title : "un évènement" };
  };

  const statuses = statusPlan(ctx.scaled(60, 12));
  let pendingRetries = 0;

  for (const status of statuses) {
    const template = faker.helpers.arrayElement(TEMPLATES);
    const pool = pools[template.audience].length > 0 ? pools[template.audience] : fallback;
    const to = faker.helpers.arrayElement(pool);
    const c = contextOf();
    const subject = template.subject(c);
    const html = `<p>Bonjour ${escapeHtml(to.name)},</p><p>${escapeHtml(template.text(c))}</p>`;
    const priority = isSensitiveEmailKind(template.kind) ? EMAIL_PRIORITY_VALUE.high : EMAIL_PRIORITY_VALUE.normal;
    const base = { type: "EMAIL" as const, kind: template.kind, recipient: to.email, priority };
    const payload = (kept: string): Prisma.InputJsonValue => ({ to: to.email, subject, html: kept, kind: template.kind });
    const far = new Date(now.getTime() + FAR_FUTURE_DAYS * DAY_MS);

    if (status === "PENDING") {
      // Jamais antedate ni executable : runAt lointain. Le premier PENDING simule un nouvel essai apres echec.
      const retry = pendingRetries++ === 0;
      const row = await prisma.job.create({
        data: {
          ...base, status, payload: payload(html), runAt: far,
          attempts: retry ? 2 : 0, lastError: retry ? FAILURES[0] : null,
        },
      });
      if (retry) seeded.retried.push({ id: row.id, kind: template.kind, at: dates.between(0.1, 2) });
      continue;
    }
    if (status === "RUNNING") {
      await prisma.job.create({
        data: { ...base, status, payload: payload(html), runAt: far, lockedAt: far, lockedBy: "demo-worker", attempts: 1 },
      });
      continue;
    }

    const completedAt = dates.between(0.05, 24);
    const createdAt = new Date(completedAt.getTime() - faker.number.int({ min: 2, max: 120 }) * 1000);
    const failure = faker.helpers.arrayElement(FAILURES).slice(0, LAST_ERROR_MAX_LENGTH);
    const data: Prisma.JobUncheckedCreateInput =
      status === "SUCCEEDED"
        ? { ...base, status, payload: payload(""), attempts: faker.helpers.arrayElement([1, 1, 1, 2]), runAt: createdAt, completedAt }
        : status === "FAILED"
          ? { ...base, status, payload: payload(html), attempts: 5, maxAttempts: 5, lastError: failure, runAt: createdAt, completedAt }
          : { ...base, status, payload: payload(html), attempts: 0, lastError: "Annulé par le staff", runAt: createdAt, completedAt };
    const row = await prisma.job.create({ data });
    await ctx.backdate("job", row.id, createdAt, completedAt);

    if (status === "FAILED") seeded.failed.push({ id: row.id, kind: template.kind, recipient: to.email, attempts: 5, completedAt });
    if (status === "CANCELLED") seeded.cancelled.push({ id: row.id, kind: template.kind, completedAt });
  }

  await ctx.parkJobs();
  return seeded;
}
