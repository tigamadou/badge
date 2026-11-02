import type { EventRole, OrgRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAll, withNotificationGuard } from "./notify";
import {
  badgePrintedMessage,
  emailFailedMessage,
  eventMembershipAddedMessage,
  eventRegistrationToggledMessage,
  membershipRoleChangedMessage,
  orgCreatedMessage,
  orgMembershipAddedMessage,
  quotaExceededMessage,
  subscriptionChangedMessage,
  subscriptionExpiringMessage,
  printRequestMessageMessage,
  printRequestQuotedMessage,
  printRequestStatusChangedMessage,
  printRequestSubmittedMessage,
  profileApprovedMessage,
  printPaymentUnmatchedMessage,
  printRequestPaidMessage,
  profileRejectedMessage,
  profileSubmittedMessage,
  registrationApprovedMessage,
  registrationCreatedMessage,
  registrationRejectedMessage,
  registrationResubmittedMessage,
} from "./messages";
import type { NotifyInput } from "./types";

// Un déclencheur par ligne de la matrice (spec 24). Chacun est appelé APRÈS l'action,
// ne lève jamais et ne fait rien si les données ne sont plus là.

const REGISTRATION_SELECT = {
  id: true,
  userId: true,
  snapshotFirstName: true,
  snapshotLastName: true,
  rejectionReason: true,
  event: { select: { id: true, title: true, orgId: true } },
  category: { select: { name: true } },
} as const;

function participantName(r: { snapshotFirstName: string; snapshotLastName: string }): string {
  return `${r.snapshotFirstName} ${r.snapshotLastName}`;
}

export async function notifyRegistrationCreated(registrationId: string, actorId: string): Promise<void> {
  await withNotificationGuard("registration-created", async () => {
    const r = await prisma.registration.findUnique({ where: { id: registrationId }, select: REGISTRATION_SELECT });
    if (!r) return;
    await notifyAll([
      {
        type: "REGISTRATION_CREATED",
        scope: "EVENT",
        recipients: { eventRoles: { eventId: r.event.id, roles: ["ADMIN", "OPERATOR"] } },
        actorId,
        orgId: r.event.orgId,
        eventId: r.event.id,
        content: registrationCreatedMessage({
          eventId: r.event.id,
          eventTitle: r.event.title,
          registrationId: r.id,
          participantName: participantName(r),
          categoryName: r.category.name,
        }),
      },
    ]);
  });
}

export async function notifyRegistrationResubmitted(
  registrationId: string,
  actorId: string,
  opts?: { categoryChanged?: { from: string; to: string } },
): Promise<void> {
  await withNotificationGuard("registration-resubmitted", async () => {
    const r = await prisma.registration.findUnique({ where: { id: registrationId }, select: REGISTRATION_SELECT });
    if (!r) return;
    await notifyAll([
      {
        type: "REGISTRATION_RESUBMITTED",
        scope: "EVENT",
        recipients: { eventRoles: { eventId: r.event.id, roles: ["ADMIN", "OPERATOR"] } },
        actorId,
        orgId: r.event.orgId,
        eventId: r.event.id,
        content: registrationResubmittedMessage({
          eventId: r.event.id,
          eventTitle: r.event.title,
          registrationId: r.id,
          participantName: participantName(r),
          categoryChanged: opts?.categoryChanged,
        }),
      },
    ]);
  });
}

export async function notifyRegistrationDecision(
  registrationId: string,
  actorId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<void> {
  await withNotificationGuard("registration-decision", async () => {
    const r = await prisma.registration.findUnique({ where: { id: registrationId }, select: REGISTRATION_SELECT });
    if (!r) return;
    const approved = decision === "APPROVED";
    await notifyAll([
      {
        type: approved ? "REGISTRATION_APPROVED" : "REGISTRATION_REJECTED",
        scope: "PARTICIPANT",
        recipients: { users: [r.userId] },
        actorId,
        orgId: r.event.orgId,
        eventId: r.event.id,
        content: approved
          ? registrationApprovedMessage({ eventTitle: r.event.title, registrationId: r.id })
          : registrationRejectedMessage({
              eventTitle: r.event.title,
              registrationId: r.id,
              reason: r.rejectionReason,
            }),
      },
    ]);
  });
}

export async function notifyBadgePrinted(registrationIds: string[], actorId: string): Promise<void> {
  await withNotificationGuard("badge-printed", async () => {
    const regs = await prisma.registration.findMany({
      where: { id: { in: registrationIds } },
      select: REGISTRATION_SELECT,
    });
    const inputs: NotifyInput[] = regs.map((r) => ({
      type: "BADGE_PRINTED",
      scope: "PARTICIPANT",
      recipients: { users: [r.userId] },
      actorId,
      orgId: r.event.orgId,
      eventId: r.event.id,
      content: badgePrintedMessage({ eventTitle: r.event.title, registrationId: r.id }),
    }));
    await notifyAll(inputs);
  });
}

// Profils : le participant dépose ses pièces, le staff plateforme les valide.

export async function notifyProfileSubmitted(userId: string): Promise<void> {
  await withNotificationGuard("profile-submitted", async () => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!user) return;
    await notifyAll([
      {
        type: "PROFILE_SUBMITTED",
        scope: "PLATFORM",
        recipients: { staffMinRole: "STAFF_SUPPORT" },
        actorId: user.id,
        content: profileSubmittedMessage({ userId: user.id, userName: user.name }),
      },
    ]);
  });
}

export async function notifyProfileDecision(
  userId: string,
  actorId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string | null,
): Promise<void> {
  await withNotificationGuard("profile-decision", async () => {
    const approved = decision === "APPROVED";
    await notifyAll([
      {
        type: approved ? "PROFILE_APPROVED" : "PROFILE_REJECTED",
        scope: "PARTICIPANT",
        recipients: { users: [userId] },
        actorId,
        content: approved ? profileApprovedMessage() : profileRejectedMessage({ reason: reason ?? null }),
      },
    ]);
  });
}

// Membres et rôles : la personne concernée est notifiée ; l'email est omis quand une
// invitation part déjà (elle porte le même message).

export async function notifyOrgMembershipAdded(a: {
  userId: string;
  orgId: string;
  role: OrgRole;
  actorId: string;
  invitationSent: boolean;
}): Promise<void> {
  await withNotificationGuard("org-membership-added", async () => {
    const org = await prisma.organization.findUnique({ where: { id: a.orgId }, select: { name: true } });
    if (!org) return;
    await notifyAll([
      {
        type: "ORG_MEMBERSHIP_ADDED",
        scope: "ORG",
        recipients: { users: [a.userId] },
        actorId: a.actorId,
        orgId: a.orgId,
        email: !a.invitationSent,
        content: orgMembershipAddedMessage({ orgId: a.orgId, orgName: org.name, role: a.role }),
      },
    ]);
  });
}

export async function notifyEventMembershipAdded(a: {
  userId: string;
  eventId: string;
  role: EventRole;
  actorId: string;
  invitationSent: boolean;
}): Promise<void> {
  await withNotificationGuard("event-membership-added", async () => {
    const event = await prisma.event.findUnique({ where: { id: a.eventId }, select: { title: true } });
    if (!event) return;
    await notifyAll([
      {
        type: "EVENT_MEMBERSHIP_ADDED",
        scope: "EVENT",
        recipients: { users: [a.userId] },
        actorId: a.actorId,
        eventId: a.eventId,
        email: !a.invitationSent,
        content: eventMembershipAddedMessage({ eventId: a.eventId, eventTitle: event.title, role: a.role }),
      },
    ]);
  });
}

export async function notifyMembershipRoleChanged(
  a: { userId: string; actorId: string; from: OrgRole | EventRole; to: OrgRole | EventRole } & (
    | { orgId: string }
    | { eventId: string }
  ),
): Promise<void> {
  if (a.from === a.to) return;
  await withNotificationGuard("membership-role-changed", async () => {
    if ("orgId" in a) {
      const org = await prisma.organization.findUnique({ where: { id: a.orgId }, select: { name: true } });
      if (!org) return;
      await notifyAll([
        {
          type: "MEMBERSHIP_ROLE_CHANGED",
          scope: "ORG",
          recipients: { users: [a.userId] },
          actorId: a.actorId,
          orgId: a.orgId,
          content: membershipRoleChangedMessage({
            target: { kind: "org", orgId: a.orgId, name: org.name },
            from: a.from,
            to: a.to,
          }),
        },
      ]);
      return;
    }
    const event = await prisma.event.findUnique({ where: { id: a.eventId }, select: { title: true } });
    if (!event) return;
    await notifyAll([
      {
        type: "MEMBERSHIP_ROLE_CHANGED",
        scope: "EVENT",
        recipients: { users: [a.userId] },
        actorId: a.actorId,
        eventId: a.eventId,
        content: membershipRoleChangedMessage({
          target: { kind: "event", eventId: a.eventId, name: event.title },
          from: a.from,
          to: a.to,
        }),
      },
    ]);
  });
}

// Évènement, organisation, abonnement, quota.

export async function notifyEventRegistrationToggled(
  eventId: string,
  open: boolean,
  actorId: string,
): Promise<void> {
  await withNotificationGuard("event-registration-toggled", async () => {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, slug: true, orgId: true },
    });
    if (!event) return;
    await notifyAll([
      {
        type: open ? "EVENT_REGISTRATION_OPENED" : "EVENT_REGISTRATION_CLOSED",
        scope: "EVENT",
        recipients: { eventRoles: { eventId, roles: ["ADMIN", "OPERATOR", "PRINTER", "VIEWER"] } },
        actorId,
        orgId: event.orgId,
        eventId,
        content: eventRegistrationToggledMessage({
          eventId,
          eventTitle: event.title,
          eventSlug: event.slug,
          open,
        }),
      },
    ]);
  });
}

export async function notifyOrgCreated(orgId: string, actorId: string): Promise<void> {
  await withNotificationGuard("org-created", async () => {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    if (!org) return;
    await notifyAll([
      {
        type: "ORG_CREATED",
        scope: "PLATFORM",
        recipients: { staffMinRole: "STAFF_ADMIN" },
        actorId,
        content: orgCreatedMessage({ orgId, orgName: org.name }),
      },
    ]);
  });
}

// OWNER de l'org d'abord (portée ORG), puis staff plateforme (portée PLATFORM) :
// notifyAll dédoublonne un staff qui est aussi OWNER.
export async function notifySubscriptionChanged(orgId: string, actorId: string | null): Promise<void> {
  await withNotificationGuard("subscription-changed", async () => {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, subscription: { select: { status: true, plan: { select: { name: true } } } } },
    });
    if (!org?.subscription) return;
    const args = {
      orgId,
      orgName: org.name,
      planName: org.subscription.plan.name,
      status: org.subscription.status,
    };
    await notifyAll([
      {
        type: "SUBSCRIPTION_CHANGED",
        scope: "ORG",
        recipients: { orgRoles: { orgId, roles: ["OWNER"] } },
        actorId,
        orgId,
        content: subscriptionChangedMessage({ ...args, audience: "org" }),
      },
      {
        type: "SUBSCRIPTION_CHANGED",
        scope: "PLATFORM",
        recipients: { staffMinRole: "STAFF_ADMIN" },
        actorId,
        content: subscriptionChangedMessage({ ...args, audience: "platform" }),
      },
    ]);
  });
}

export async function notifySubscriptionExpiring(orgId: string, daysBefore: number, endDate: Date): Promise<void> {
  await withNotificationGuard("subscription-expiring", async () => {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, subscription: { select: { plan: { select: { name: true } } } } },
    });
    if (!org?.subscription) return;
    await notifyAll([
      {
        type: "SUBSCRIPTION_EXPIRING",
        scope: "ORG",
        recipients: { orgRoles: { orgId, roles: ["OWNER"] } },
        actorId: null,
        orgId,
        content: subscriptionExpiringMessage({
          orgId,
          orgName: org.name,
          planName: org.subscription.plan.name,
          daysBefore,
          endDate,
        }),
      },
    ]);
  });
}

export async function notifyQuotaExceeded(orgId: string, eventId: string, actorId: string): Promise<void> {
  await withNotificationGuard("quota-exceeded", async () => {
    const event = await prisma.event.findFirst({
      where: { id: eventId, orgId },
      select: { organization: { select: { name: true } } },
    });
    if (!event) return;
    const args = { orgId, orgName: event.organization.name, eventId };
    await notifyAll([
      {
        type: "QUOTA_EXCEEDED",
        scope: "ORG",
        recipients: { orgRoles: { orgId, roles: ["OWNER"] } },
        actorId,
        orgId,
        content: quotaExceededMessage({ ...args, audience: "org" }),
      },
      {
        type: "QUOTA_EXCEEDED",
        scope: "PLATFORM",
        recipients: { staffMinRole: "STAFF_ADMIN" },
        actorId,
        content: quotaExceededMessage({ ...args, audience: "platform" }),
      },
    ]);
  });
}

// Appelé par le worker quand un job email passe en FAILED. Pas d'email : éviter la boucle.
export async function notifyEmailFailed(job: {
  id: string;
  kind: string;
  recipient: string | null;
  attempts: number;
}): Promise<void> {
  await withNotificationGuard("email-failed", async () => {
    await notifyAll([
      {
        type: "EMAIL_FAILED",
        scope: "PLATFORM",
        recipients: { staffMinRole: "STAFF_ADMIN" },
        actorId: null,
        email: false,
        content: emailFailedMessage({
          jobId: job.id,
          kind: job.kind,
          recipient: job.recipient,
          attempts: job.attempts,
        }),
      },
    ]);
  });
}

// --- Demandes d'impression (spec 33) ---

const PRINT_REQUEST_SELECT = {
  id: true,
  reference: true,
  type: true,
  status: true,
  orgId: true,
  eventId: true,
  quoteVersion: true,
  total: true,
  acceptedTotal: true,
  estimatedQuantity: true,
  event: { select: { title: true } },
  org: { select: { name: true } },
  _count: { select: { items: true } },
} as const;

export async function notifyPrintRequestSubmitted(requestId: string, actorId: string): Promise<void> {
  await withNotificationGuard("print-request-submitted", async () => {
    const r = await prisma.printRequest.findUnique({ where: { id: requestId }, select: PRINT_REQUEST_SELECT });
    if (!r) return;
    await notifyAll([
      {
        type: "PRINT_REQUEST_SUBMITTED",
        scope: "PLATFORM",
        recipients: { staffMinRole: "STAFF_ADMIN" },
        actorId,
        orgId: r.orgId,
        eventId: r.eventId,
        content: printRequestSubmittedMessage({
          requestId: r.id,
          reference: r.reference,
          eventTitle: r.event.title,
          orgName: r.org.name,
          type: r.type,
          // Une demande sur place n'a pas d'items : on retombe sur la quantité estimée.
          badgeCount: r._count.items || r.estimatedQuantity || 0,
        }),
      },
    ]);
  });
}

// Le propriétaire (seul à pouvoir accepter) est couvert : OWNER et MANAGER valent ADMIN.
export async function notifyPrintRequestQuoted(requestId: string, actorId: string): Promise<void> {
  await withNotificationGuard("print-request-quoted", async () => {
    const r = await prisma.printRequest.findUnique({ where: { id: requestId }, select: PRINT_REQUEST_SELECT });
    if (!r) return;
    await notifyAll([
      {
        type: "PRINT_REQUEST_QUOTED",
        scope: "EVENT",
        recipients: { eventRoles: { eventId: r.eventId, roles: ["ADMIN"] } },
        actorId,
        orgId: r.orgId,
        eventId: r.eventId,
        content: printRequestQuotedMessage({
          requestId: r.id,
          eventId: r.eventId,
          reference: r.reference,
          eventTitle: r.event.title,
          version: r.quoteVersion,
          total: r.total,
        }),
      },
    ]);
  });
}

export async function notifyPrintRequestMessage(messageId: string, actorId: string): Promise<void> {
  await withNotificationGuard("print-request-message", async () => {
    const m = await prisma.printRequestMessage.findUnique({
      where: { id: messageId },
      select: {
        body: true,
        side: true,
        internal: true,
        author: { select: { name: true } },
        request: { select: PRINT_REQUEST_SELECT },
      },
    });
    // Les messages SYSTEM (journal) ne notifient pas, ni les notes internes (jamais vues de l'organisateur).
    if (!m || m.side === "SYSTEM" || m.internal) return;
    const r = m.request;
    const toStaff = m.side === "ORGANIZER";
    await notifyAll([
      {
        type: "PRINT_REQUEST_MESSAGE",
        scope: toStaff ? "PLATFORM" : "EVENT",
        recipients: toStaff
          ? { staffMinRole: "STAFF_SUPPORT" }
          : { eventRoles: { eventId: r.eventId, roles: ["ADMIN"] } },
        actorId,
        orgId: r.orgId,
        eventId: r.eventId,
        content: printRequestMessageMessage({
          requestId: r.id,
          eventId: r.eventId,
          reference: r.reference,
          authorName: m.author?.name ?? (toStaff ? "L'organisateur" : "Le staff"),
          body: m.body,
          toStaff,
        }),
      },
    ]);
  });
}

export async function notifyPrintRequestStatusChanged(
  requestId: string,
  actorId: string | null,
  to: { organizer: boolean; staff: boolean },
): Promise<void> {
  await withNotificationGuard("print-request-status-changed", async () => {
    const r = await prisma.printRequest.findUnique({ where: { id: requestId }, select: PRINT_REQUEST_SELECT });
    if (!r) return;
    const base = { type: "PRINT_REQUEST_STATUS_CHANGED", actorId, orgId: r.orgId, eventId: r.eventId } as const;
    const args = {
      requestId: r.id,
      eventId: r.eventId,
      reference: r.reference,
      eventTitle: r.event.title,
      status: r.status,
    };
    const inputs: NotifyInput[] = [];
    if (to.organizer) {
      inputs.push({
        ...base,
        scope: "EVENT",
        recipients: { eventRoles: { eventId: r.eventId, roles: ["ADMIN"] } },
        content: printRequestStatusChangedMessage({ ...args, toStaff: false }),
      });
    }
    if (to.staff) {
      inputs.push({
        ...base,
        scope: "PLATFORM",
        recipients: { staffMinRole: "STAFF_ADMIN" },
        content: printRequestStatusChangedMessage({ ...args, toStaff: true }),
      });
    }
    await notifyAll(inputs);
  });
}

// Passage en PAID : remplace notifyPrintRequestStatusChanged pour cette transition.
// Organisateur (ADMIN de l'évènement) et staff (STAFF_ADMIN) ; `manual` pour un marquage hors ligne.
export async function notifyPrintRequestPaid(
  requestId: string,
  actorId: string | null,
  opts: { manual?: boolean } = {},
): Promise<void> {
  await withNotificationGuard("print-request-paid", async () => {
    const r = await prisma.printRequest.findUnique({ where: { id: requestId }, select: PRINT_REQUEST_SELECT });
    if (!r) return;
    const base = { type: "PRINT_REQUEST_STATUS_CHANGED", actorId, orgId: r.orgId, eventId: r.eventId } as const;
    const args = {
      requestId: r.id,
      eventId: r.eventId,
      reference: r.reference,
      eventTitle: r.event.title,
      amount: r.acceptedTotal ?? r.total,
      manual: opts.manual ?? false,
    };
    await notifyAll([
      {
        ...base,
        scope: "EVENT",
        recipients: { eventRoles: { eventId: r.eventId, roles: ["ADMIN"] } },
        content: printRequestPaidMessage({ ...args, audience: "event" }),
      },
      {
        ...base,
        scope: "PLATFORM",
        recipients: { staffMinRole: "STAFF_ADMIN" },
        content: printRequestPaidMessage({ ...args, audience: "platform" }),
      },
    ]);
  });
}

// Paiement approuvé que la demande n'attendait plus : le staff vérifie (montant lu sur le Payment).
export async function notifyPrintPaymentUnmatched(requestId: string, paymentId: string): Promise<void> {
  await withNotificationGuard("print-payment-unmatched", async () => {
    const [r, payment] = await Promise.all([
      prisma.printRequest.findUnique({ where: { id: requestId }, select: PRINT_REQUEST_SELECT }),
      prisma.payment.findUnique({ where: { id: paymentId }, select: { amount: true } }),
    ]);
    if (!r || !payment) return;
    await notifyAll([
      {
        type: "PRINT_REQUEST_STATUS_CHANGED",
        scope: "PLATFORM",
        recipients: { staffMinRole: "STAFF_ADMIN" },
        actorId: null,
        orgId: r.orgId,
        eventId: r.eventId,
        content: printPaymentUnmatchedMessage({ requestId: r.id, reference: r.reference, amount: payment.amount }),
      },
    ]);
  });
}
