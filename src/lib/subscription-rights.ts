// Matrice des droits accordés selon l'état de l'abonnement (actif / inactif).
// Module pur : aucun import Prisma, utilisable côté client comme côté serveur.

export const SUBSCRIPTION_RIGHTS = [
  "CREATE_EVENT",
  "RECEIVE_REGISTRATIONS",
  "MANAGE_ONGOING_EVENTS",
  "ACCESS_ORG_SPACE",
] as const;

export type SubscriptionRight = (typeof SUBSCRIPTION_RIGHTS)[number];

export type RightsMatrix = Record<SubscriptionRight, { active: boolean; inactive: boolean }>;

export const DEFAULT_RIGHTS: RightsMatrix = {
  CREATE_EVENT: { active: true, inactive: false },
  RECEIVE_REGISTRATIONS: { active: true, inactive: true },
  MANAGE_ONGOING_EVENTS: { active: true, inactive: true },
  ACCESS_ORG_SPACE: { active: true, inactive: false },
};

// Fusion champ par champ sur les défauts : clé absente → défaut ; clé inconnue ou
// valeur non booléenne → ignorée. Ne lève jamais.
export function parseRights(raw: unknown): RightsMatrix {
  const result = {} as RightsMatrix;
  const source =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  for (const right of SUBSCRIPTION_RIGHTS) {
    const entry = source[right];
    const fields =
      entry !== null && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};
    result[right] = {
      active: typeof fields.active === "boolean" ? fields.active : DEFAULT_RIGHTS[right].active,
      inactive: typeof fields.inactive === "boolean" ? fields.inactive : DEFAULT_RIGHTS[right].inactive,
    };
  }
  return result;
}

export type EventTiming = { date: Date; endDate: Date | null; archived: boolean };

const DAY_MS = 24 * 60 * 60 * 1000;

// En cours : non archivé et `now` avant le début du jour UTC suivant `endDate ?? date`.
export function isEventOngoing(event: EventTiming, now: Date = new Date()): boolean {
  if (event.archived) return false;
  const end = event.endDate ?? event.date;
  const startOfEndDay = Math.floor(end.getTime() / DAY_MS) * DAY_MS;
  return now.getTime() < startOfEndDay + DAY_MS;
}

export type OrgAccess = {
  active: boolean;
  maxEvents: number | null;
  maxParticipantsPerEvent: number | null;
  rights: RightsMatrix;
};

// Les droits « évènement » ne valent, à l'état inactif, que pour un évènement en cours.
const EVENT_SCOPED: ReadonlySet<SubscriptionRight> = new Set([
  "RECEIVE_REGISTRATIONS",
  "MANAGE_ONGOING_EVENTS",
]);

export function can(
  access: OrgAccess,
  right: SubscriptionRight,
  event?: EventTiming,
  now: Date = new Date(),
): boolean {
  if (access.active) return access.rights[right].active;
  if (!access.rights[right].inactive) return false;
  if (EVENT_SCOPED.has(right)) return event !== undefined && isEventOngoing(event, now);
  return true;
}
