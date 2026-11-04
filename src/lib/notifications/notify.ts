import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/brand-colors";
import { buildEmail, resolveTransporter } from "@/lib/mail";
import { buildBaseUrl, escapeHtml } from "@/lib/mail-helpers";
import { enqueueEmail } from "@/lib/jobs/enqueue-email";
import { resolveRecipients, type Recipient } from "./recipients";
import type { NotificationContent, NotifyInput } from "./types";

// Matrice de la spec 24 : true = un email part par la queue en plus de la notification.
export const EMAIL_BY_TYPE: Record<NotificationType, boolean> = {
  REGISTRATION_CREATED: true,
  REGISTRATION_RESUBMITTED: true,
  REGISTRATION_APPROVED: false,
  REGISTRATION_REJECTED: false,
  BADGE_PRINTED: false,
  PROFILE_SUBMITTED: true,
  PROFILE_APPROVED: false,
  PROFILE_REJECTED: false,
  ORG_MEMBERSHIP_ADDED: true,
  EVENT_MEMBERSHIP_ADDED: true,
  MEMBERSHIP_ROLE_CHANGED: true,
  EVENT_REGISTRATION_OPENED: true,
  EVENT_REGISTRATION_CLOSED: true,
  ORG_CREATED: true,
  SUBSCRIPTION_CHANGED: true,
  QUOTA_EXCEEDED: true,
  EMAIL_FAILED: false,
  SUBSCRIPTION_EXPIRING: true,
  PRINT_REQUEST_SUBMITTED: true,
  PRINT_REQUEST_QUOTED: true,
  PRINT_REQUEST_MESSAGE: true,
  PRINT_REQUEST_STATUS_CHANGED: true,
};

function buildEmailBody(content: NotificationContent): string {
  const url = `${buildBaseUrl(process.env)}${content.href}`;
  return `
    <p style="margin:0 0 20px;">${escapeHtml(content.body)}</p>
    <p style="margin:0;"><a href="${escapeHtml(url)}" style="display:inline-block;background-color:${BRAND.navy};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">${escapeHtml(content.primaryLabel)}</a></p>
  `;
}

async function notifyOne(
  input: NotifyInput,
  served: Set<string>,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  const recipients: Recipient[] = await resolveRecipients(
    input.recipients,
    { actorId: input.actorId, excludeUserIds: served },
    db,
  );
  if (recipients.length === 0) return;

  // Toute notification d'évènement porte l'orgId (la portée org s'en sert).
  let orgId = input.orgId;
  if (input.eventId && !orgId) {
    orgId = (await db.event.findUniqueOrThrow({ where: { id: input.eventId }, select: { orgId: true } })).orgId;
  }

  const { content } = input;
  await db.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      type: input.type,
      scope: input.scope,
      orgId: orgId ?? null,
      eventId: input.eventId ?? null,
      title: content.title,
      body: content.body,
      href: content.href,
      links: [
        { label: content.primaryLabel, href: content.href, ...(content.anchor ? { anchor: content.anchor } : {}) },
        ...content.links,
      ],
    })),
  });
  for (const r of recipients) served.add(r.id);

  if (!(input.email ?? EMAIL_BY_TYPE[input.type])) return;
  const ctx = { eventId: input.eventId, orgId };
  const branding = await resolveTransporter(ctx);
  const html = buildEmail({ title: content.title, body: buildEmailBody(content), ctx: branding });
  for (const r of recipients) {
    await enqueueEmail(
      {
        to: r.email,
        subject: content.title,
        html,
        kind: `notification.${input.type.toLowerCase()}`,
        priority: "normal",
        ctx,
      },
      tx,
    );
  }
}

// Traite les entrées dans l'ordre ; un utilisateur déjà servi n'est pas re-notifié par
// les entrées suivantes. Aucune exception ne sort : une notification ne casse jamais l'action.
export async function notifyAll(inputs: NotifyInput[], tx?: Prisma.TransactionClient): Promise<void> {
  const served = new Set<string>();
  for (const input of inputs) {
    try {
      await notifyOne(input, served, tx);
    } catch (error) {
      console.error("[notify] failed", { type: input.type, error });
    }
  }
}

export async function notify(input: NotifyInput, tx?: Prisma.TransactionClient): Promise<void> {
  await notifyAll([input], tx);
}

// Enveloppe un déclencheur entier (chargement de données compris).
export async function withNotificationGuard(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error("[notify] trigger failed", { label, error });
  }
}
