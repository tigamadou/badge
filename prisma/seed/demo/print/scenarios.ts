import type { PaymentStatus, PrintDelivery, PrintRequestStatus, PrintRequestType } from "@prisma/client";
import type { EventPhase } from "../context";

export type Extra = "SERVICE" | "DISCOUNT" | "CUSTOM" | "REMOVED" | "CREDIT" | "CREDIT_FULL";
export type PayMode = "ONLINE" | "OFFLINE" | "CREDIT";
export type SheetState = "DONE" | "FAILED" | "PENDING" | "RUNNING";
/** Etat de lecture du fil apres la creation (voir seedReadStates). */
export type ReadPlan = "all" | "staffBehind" | "orgBehind" | "orgBehindInternal" | "neverOpened";
export type ConversationPlan = "none" | "short" | "full";

export type Scenario = {
  key: string;
  type: PrintRequestType;
  target: PrintRequestStatus;
  /** Slug complet de l'organisation (repli sur une autre si elle n'a pas d'evenement exploitable). */
  org: string;
  /** Phases d'evenement acceptees, par ordre de preference. */
  phases: EventPhase[];
  delivery?: PrintDelivery;
  /** Nombre de devis envoyes avant la fin du cycle (QUOTE_SENT). */
  quoteVersions: 1 | 2 | 3;
  badgeCount: number;
  extras: Extra[];
  /** Duree de vie de la commande, en jours. */
  span: number;
  /** Jours entre la derniere etape du cycle et ctx.now (evenement en cours ou a venir). */
  endDaysAgo: number;
  pay?: PayMode;
  /** Tentatives de paiement en ligne echouees avant l'issue (dans l'ordre). */
  failedPayments?: PaymentStatus[];
  /** Un paiement PENDING recent reste ouvert (la commande reste ACCEPTED). */
  pendingPayment?: boolean;
  sheet?: SheetState;
  conversation: ConversationPlan;
  reads: ReadPlan;
  /** Refus ou annulation : etape du cycle ou l'issue arrive. */
  endsFrom?: "SUBMITTED" | "QUOTED" | "ACCEPTED";
  onsite?: {
    /** Badges commandes ; sinon calcule depuis les inscriptions disponibles. */
    ordered?: number;
    /** Part des badges commandes imprimee (0-1) ; > 1 : depasse la commande jusqu'au plafond. */
    printedRatio?: number;
    reprints?: number;
  };
};

const base = {
  quoteVersions: 1 as const,
  extras: [] as Extra[],
  span: 14,
  endDaysAgo: 1,
  conversation: "short" as ConversationPlan,
  reads: "all" as ReadPlan,
};

/**
 * Ordre significatif : une commande sur place cloturee (credit gagne) precede celles qui le depensent,
 * et les reservations d'inscriptions sont attribuees dans l'ordre.
 */
export const SCENARIOS: Scenario[] = [
  // Impression sur place
  { ...base, key: "o-completed-credit", type: "ONSITE", target: "COMPLETED", org: "demo-moyenne-1", phases: ["past", "ongoing"],
    badgeCount: 30, span: 20, pay: "ONLINE", conversation: "full", reads: "orgBehind",
    onsite: { ordered: 30, printedRatio: 0.1, reprints: 1 } },
  { ...base, key: "o-completed-supplement", type: "ONSITE", target: "COMPLETED", org: "demo-grosse-org", phases: ["past", "ongoing"],
    badgeCount: 20, span: 20, pay: "OFFLINE", conversation: "full", reads: "orgBehindInternal",
    onsite: { printedRatio: 2, reprints: 2 } },
  { ...base, key: "o-submitted", type: "ONSITE", target: "SUBMITTED", org: "demo-grosse-org", phases: ["ongoing", "past"],
    badgeCount: 150, span: 6, endDaysAgo: 0.4, conversation: "short", reads: "staffBehind" },
  { ...base, key: "o-quoted", type: "ONSITE", target: "QUOTED", org: "demo-moyenne-3", phases: ["ongoing"],
    badgeCount: 60, span: 6, endDaysAgo: 0.5, extras: ["SERVICE"], conversation: "short", reads: "orgBehind" },
  { ...base, key: "o-paid", type: "ONSITE", target: "PAID", org: "demo-moyenne-4", phases: ["ongoing"],
    badgeCount: 80, span: 8, endDaysAgo: 0.6, pay: "ONLINE", conversation: "short", reads: "all" },
  { ...base, key: "o-in-production", type: "ONSITE", target: "IN_PRODUCTION", org: "demo-petite-2", phases: ["ongoing", "past"],
    badgeCount: 40, span: 8, endDaysAgo: 0.3, pay: "OFFLINE", conversation: "full", reads: "staffBehind",
    onsite: { ordered: 40, printedRatio: 0.55, reprints: 2 } },
  { ...base, key: "o-ready", type: "ONSITE", target: "READY", org: "demo-petite-6", phases: ["ongoing", "past"],
    badgeCount: 25, span: 8, endDaysAgo: 0.25, pay: "ONLINE", conversation: "short", reads: "all",
    onsite: { ordered: 25, printedRatio: 0.9 } },

  // Commandes a l'avance
  { ...base, key: "a-draft", type: "ADVANCE", target: "DRAFT", org: "demo-moyenne-1", phases: ["upcoming", "ongoing"],
    badgeCount: 3, delivery: "PICKUP", span: 3, endDaysAgo: 1, conversation: "none", reads: "all" },
  { ...base, key: "a-submitted", type: "ADVANCE", target: "SUBMITTED", org: "demo-grosse-org", phases: ["upcoming", "ongoing"],
    badgeCount: 4, delivery: "DELIVERY", span: 4, endDaysAgo: 0.5, conversation: "short", reads: "staffBehind" },
  { ...base, key: "a-quoted-v3", type: "ADVANCE", target: "QUOTED", org: "demo-grosse-org", phases: ["upcoming", "ongoing"],
    badgeCount: 5, delivery: "DELIVERY", quoteVersions: 3, span: 12, endDaysAgo: 0.7,
    extras: ["SERVICE", "DISCOUNT", "CUSTOM", "REMOVED"], conversation: "full", reads: "orgBehindInternal" },
  { ...base, key: "a-quoted-pickup", type: "ADVANCE", target: "QUOTED", org: "demo-moyenne-2", phases: ["upcoming", "ongoing"],
    badgeCount: 3, delivery: "PICKUP", span: 6, endDaysAgo: 1.5, extras: ["SERVICE"], conversation: "short", reads: "neverOpened" },
  { ...base, key: "a-accepted", type: "ADVANCE", target: "ACCEPTED", org: "demo-moyenne-2", phases: ["upcoming", "ongoing"],
    badgeCount: 3, delivery: "PICKUP", quoteVersions: 2, span: 9, endDaysAgo: 1, extras: ["CUSTOM"], conversation: "full", reads: "all" },
  { ...base, key: "a-accepted-failed", type: "ADVANCE", target: "ACCEPTED", org: "demo-moyenne-3", phases: ["upcoming", "ongoing"],
    badgeCount: 2, delivery: "DELIVERY", span: 9, endDaysAgo: 0.8, failedPayments: ["EXPIRED", "CANCELED", "DECLINED"],
    conversation: "short", reads: "staffBehind" },
  { ...base, key: "a-accepted-pending", type: "ADVANCE", target: "ACCEPTED", org: "demo-moyenne-4", phases: ["upcoming", "ongoing"],
    badgeCount: 2, delivery: "PICKUP", span: 7, endDaysAgo: 0.05, pendingPayment: true, conversation: "short", reads: "all" },
  { ...base, key: "a-paid-online", type: "ADVANCE", target: "PAID", org: "demo-grosse-org", phases: ["upcoming", "ongoing"],
    badgeCount: 4, delivery: "DELIVERY", quoteVersions: 2, span: 14, endDaysAgo: 2, pay: "ONLINE", failedPayments: ["DECLINED"],
    extras: ["SERVICE", "DISCOUNT"], sheet: "DONE", conversation: "full", reads: "all" },
  { ...base, key: "a-paid-offline", type: "ADVANCE", target: "PAID", org: "demo-moyenne-2", phases: ["upcoming", "ongoing"],
    badgeCount: 2, delivery: "PICKUP", span: 8, endDaysAgo: 0.9, pay: "OFFLINE", conversation: "short", reads: "staffBehind" },
  { ...base, key: "a-credit-partial", type: "ADVANCE", target: "PAID", org: "demo-moyenne-1", phases: ["upcoming", "ongoing"],
    badgeCount: 3, delivery: "PICKUP", span: 8, endDaysAgo: 0.04, pay: "ONLINE", extras: ["CREDIT"], sheet: "PENDING",
    conversation: "short", reads: "all" },
  { ...base, key: "a-credit-full", type: "ADVANCE", target: "PAID", org: "demo-moyenne-1", phases: ["ongoing", "upcoming"],
    badgeCount: 1, delivery: "PICKUP", span: 6, endDaysAgo: 0.03, pay: "CREDIT", extras: ["CREDIT_FULL"], sheet: "FAILED",
    conversation: "short", reads: "orgBehind" },
  { ...base, key: "a-in-production", type: "ADVANCE", target: "IN_PRODUCTION", org: "demo-grosse-org", phases: ["ongoing", "upcoming"],
    badgeCount: 6, delivery: "DELIVERY", span: 12, endDaysAgo: 0.03, pay: "ONLINE", sheet: "RUNNING", conversation: "full", reads: "all" },
  { ...base, key: "a-in-production-todo", type: "ADVANCE", target: "IN_PRODUCTION", org: "demo-petite-1", phases: ["upcoming", "ongoing"],
    badgeCount: 2, delivery: "PICKUP", span: 10, endDaysAgo: 0.6, pay: "OFFLINE", conversation: "short", reads: "all" },
  { ...base, key: "a-ready", type: "ADVANCE", target: "READY", org: "demo-grosse-org", phases: ["ongoing", "upcoming"],
    badgeCount: 5, delivery: "PICKUP", span: 14, endDaysAgo: 0.5, pay: "ONLINE", sheet: "DONE", conversation: "short", reads: "all" },
  { ...base, key: "a-completed", type: "ADVANCE", target: "COMPLETED", org: "demo-grosse-org", phases: ["past", "ongoing"],
    badgeCount: 6, delivery: "DELIVERY", quoteVersions: 2, span: 20, pay: "ONLINE", extras: ["SERVICE"],
    conversation: "full", reads: "all" },
  { ...base, key: "a-rejected", type: "ADVANCE", target: "REJECTED", org: "demo-moyenne-2", phases: ["upcoming", "ongoing"],
    badgeCount: 2, delivery: "DELIVERY", span: 6, endDaysAgo: 2, endsFrom: "QUOTED", extras: ["SERVICE"],
    conversation: "short", reads: "orgBehind" },
  { ...base, key: "a-cancelled", type: "ADVANCE", target: "CANCELLED", org: "demo-petite-3", phases: ["upcoming", "ongoing"],
    badgeCount: 2, delivery: "PICKUP", span: 8, endDaysAgo: 3, endsFrom: "ACCEPTED", conversation: "short", reads: "all" },
];
