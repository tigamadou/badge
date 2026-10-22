import { prisma } from "@/lib/prisma";
import type { SubscriptionPeriod } from "@prisma/client";

// Duree d'un abonnement selon sa periode (jours calendaires).
export const PERIOD_DAYS: Record<SubscriptionPeriod, number> = {
  MONTHLY: 30,
  ANNUAL: 365,
};

// Plan attribue automatiquement a toute nouvelle organisation (cree par le seed).
export const DEFAULT_PLAN_NAME = "free";

// Calcule les bornes d'un abonnement a partir de sa periode. `startDate` par
// defaut = maintenant ; `endDate` = startDate + duree de la periode.
export function computeSubscriptionDates(
  period: SubscriptionPeriod,
  from: Date = new Date(),
): { startDate: Date; endDate: Date } {
  const startDate = new Date(from);
  const endDate = new Date(from);
  endDate.setUTCDate(endDate.getUTCDate() + PERIOD_DAYS[period]);
  return { startDate, endDate };
}

export type SubscriptionErrorCode =
  | "NO_SUBSCRIPTION"
  | "SUBSCRIPTION_INACTIVE"
  | "EVENT_LIMIT"
  | "PARTICIPANT_LIMIT";

const HTTP_STATUS: Record<SubscriptionErrorCode, number> = {
  NO_SUBSCRIPTION: 403,
  SUBSCRIPTION_INACTIVE: 403,
  EVENT_LIMIT: 409,
  PARTICIPANT_LIMIT: 429,
};

export class SubscriptionError extends Error {
  readonly code: SubscriptionErrorCode;
  readonly httpStatus: number;

  constructor(code: SubscriptionErrorCode, message?: string) {
    super(message ?? code);
    this.name = "SubscriptionError";
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}

export interface OrgLimits {
  maxEvents: number | null;
  maxParticipantsPerEvent: number | null;
  active: boolean;
}

export async function resolveOrgLimits(orgId: string): Promise<OrgLimits> {
  const subscription = await prisma.subscription.findUnique({
    where: { orgId },
    include: { plan: true },
  });

  if (!subscription) {
    return { maxEvents: null, maxParticipantsPerEvent: null, active: false };
  }

  const maxEvents =
    subscription.overrideMaxEvents ?? subscription.plan.maxEvents;
  const maxParticipantsPerEvent =
    subscription.overrideMaxParticipantsPerEvent ??
    subscription.plan.maxParticipantsPerEvent;

  const active =
    subscription.status === "ACTIVE" &&
    (subscription.endDate == null || subscription.endDate > new Date());

  return { maxEvents, maxParticipantsPerEvent, active };
}

// Seules les inscriptions PENDING + APPROVED comptent dans le quota.
// Les REJECTED sont exclues (decision spec ll. 244-245).
export async function countCountableRegistrations(eventId: string): Promise<number> {
  return prisma.registration.count({
    where: { eventId, status: { in: ["PENDING", "APPROVED"] } },
  });
}

export async function assertCanCreateEvent(orgId: string): Promise<void> {
  const { maxEvents, active } = await resolveOrgLimits(orgId);
  if (!active) {
    throw new SubscriptionError("SUBSCRIPTION_INACTIVE");
  }
  if (maxEvents == null) return;
  const count = await prisma.event.count({ where: { orgId, archived: false } });
  if (count >= maxEvents) {
    throw new SubscriptionError("EVENT_LIMIT");
  }
}

export async function assertCanRegister(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) return;
  const { maxParticipantsPerEvent, active } = await resolveOrgLimits(event.orgId);
  if (!active) {
    throw new SubscriptionError("SUBSCRIPTION_INACTIVE");
  }
  if (maxParticipantsPerEvent == null) return;
  const current = await countCountableRegistrations(eventId);
  if (current >= maxParticipantsPerEvent) {
    throw new SubscriptionError("PARTICIPANT_LIMIT");
  }
}
