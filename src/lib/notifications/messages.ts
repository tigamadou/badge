import type {
  EventRole,
  OrgRole,
  PrintRequestStatus,
  PrintRequestType,
  SubscriptionStatus,
} from "@prisma/client";
import {
  PRINT_REQUEST_STATUS_LABELS,
  PRINT_REQUEST_TYPE_LABELS,
  formatFcfa,
} from "@/lib/print-requests/labels";
import type { NotificationContent } from "./types";

export const ROLE_LABELS: Record<OrgRole | EventRole, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Gérant",
  AUDITOR: "Auditeur",
  ADMIN: "Administrateur",
  OPERATOR: "Opérateur",
  PRINTER: "Impression",
  VIEWER: "Lecteur",
};

const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "actif",
  EXPIRED: "expiré",
  CANCELLED: "annulé",
};

const enc = encodeURIComponent;

function withReason(sentence: string, reason: string | null): string {
  return reason ? `${sentence} Motif : ${reason}` : sentence;
}

export function registrationCreatedMessage(a: {
  eventId: string;
  eventTitle: string;
  registrationId: string;
  participantName: string;
  categoryName: string;
}): NotificationContent {
  return {
    title: "Nouvelle inscription",
    body: `${a.participantName} s'est inscrit(e) à ${a.eventTitle} (catégorie ${a.categoryName}).`,
    href: `/event/${enc(a.eventId)}/registrations/${enc(a.registrationId)}`,
    primaryLabel: "Voir l'inscription",
    links: [{ label: "Voir l'évènement", href: `/event/${enc(a.eventId)}` }],
  };
}

export function registrationResubmittedMessage(a: {
  eventId: string;
  eventTitle: string;
  registrationId: string;
  participantName: string;
  categoryChanged?: { from: string; to: string };
}): NotificationContent {
  const change = a.categoryChanged
    ? ` Changement de catégorie : ${a.categoryChanged.from} vers ${a.categoryChanged.to}.`
    : "";
  return {
    title: "Inscription resoumise",
    body: `${a.participantName} a resoumis son inscription à ${a.eventTitle}.${change}`,
    href: `/event/${enc(a.eventId)}/registrations/${enc(a.registrationId)}`,
    primaryLabel: "Voir l'inscription",
    links: [{ label: "Voir l'évènement", href: `/event/${enc(a.eventId)}` }],
  };
}

function myRegistration(registrationId: string) {
  return {
    href: `/account/registrations/${enc(registrationId)}`,
    primaryLabel: "Voir mon inscription",
    links: [],
  };
}

export function registrationApprovedMessage(a: {
  eventTitle: string;
  registrationId: string;
}): NotificationContent {
  return {
    title: "Inscription approuvée",
    body: `Votre inscription à ${a.eventTitle} a été approuvée.`,
    ...myRegistration(a.registrationId),
  };
}

export function registrationRejectedMessage(a: {
  eventTitle: string;
  registrationId: string;
  reason: string | null;
}): NotificationContent {
  return {
    title: "Inscription rejetée",
    body: withReason(`Votre inscription à ${a.eventTitle} a été rejetée.`, a.reason),
    ...myRegistration(a.registrationId),
  };
}

export function badgePrintedMessage(a: {
  eventTitle: string;
  registrationId: string;
}): NotificationContent {
  return {
    title: "Badge imprimé",
    body: `Votre badge pour ${a.eventTitle} a été imprimé.`,
    ...myRegistration(a.registrationId),
  };
}

export function profileSubmittedMessage(a: {
  userId: string;
  userName: string;
}): NotificationContent {
  return {
    title: "Profil à valider",
    body: `${a.userName} a déposé un profil en attente de validation.`,
    href: `/platform/profiles/${enc(a.userId)}`,
    primaryLabel: "Voir le profil",
    links: [],
  };
}

export function profileApprovedMessage(): NotificationContent {
  return {
    title: "Profil validé",
    body: "Votre profil a été validé.",
    href: "/account/profile",
    primaryLabel: "Voir mon profil",
    links: [],
  };
}

export function profileRejectedMessage(a: { reason: string | null }): NotificationContent {
  return {
    title: "Documents refusés",
    body: withReason("Les documents de votre profil ont été refusés.", a.reason),
    href: "/account/profile",
    primaryLabel: "Voir mon profil",
    links: [],
  };
}

export function orgMembershipAddedMessage(a: {
  orgId: string;
  orgName: string;
  role: OrgRole;
}): NotificationContent {
  return {
    title: "Ajout à une organisation",
    body: `Vous avez été ajouté(e) à l'organisation ${a.orgName} avec le rôle ${ROLE_LABELS[a.role]}.`,
    href: `/org/${enc(a.orgId)}`,
    primaryLabel: "Ouvrir l'organisation",
    links: [],
  };
}

export function eventMembershipAddedMessage(a: {
  eventId: string;
  eventTitle: string;
  role: EventRole;
}): NotificationContent {
  return {
    title: "Ajout à un évènement",
    body: `Vous avez été ajouté(e) à l'évènement ${a.eventTitle} avec le rôle ${ROLE_LABELS[a.role]}.`,
    href: `/event/${enc(a.eventId)}`,
    primaryLabel: "Ouvrir l'évènement",
    links: [],
  };
}

export function membershipRoleChangedMessage(a: {
  target:
    | { kind: "org"; orgId: string; name: string }
    | { kind: "event"; eventId: string; name: string };
  from: OrgRole | EventRole;
  to: OrgRole | EventRole;
}): NotificationContent {
  const isOrg = a.target.kind === "org";
  const where = isOrg ? `l'organisation ${a.target.name}` : `l'évènement ${a.target.name}`;
  return {
    title: "Rôle modifié",
    body: `Votre rôle dans ${where} est passé de ${ROLE_LABELS[a.from]} à ${ROLE_LABELS[a.to]}.`,
    href: a.target.kind === "org" ? `/org/${enc(a.target.orgId)}` : `/event/${enc(a.target.eventId)}`,
    primaryLabel: isOrg ? "Ouvrir l'organisation" : "Ouvrir l'évènement",
    links: [],
  };
}

export function eventRegistrationToggledMessage(a: {
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  open: boolean;
}): NotificationContent {
  return {
    title: a.open ? "Inscriptions ouvertes" : "Inscriptions fermées",
    body: a.open
      ? `Les inscriptions à ${a.eventTitle} sont ouvertes.`
      : `Les inscriptions à ${a.eventTitle} sont fermées.`,
    href: `/event/${enc(a.eventId)}`,
    primaryLabel: "Ouvrir l'évènement",
    links: [{ label: "Page publique", href: `/e/${enc(a.eventSlug)}` }],
  };
}

export function orgCreatedMessage(a: { orgId: string; orgName: string }): NotificationContent {
  return {
    title: "Nouvelle organisation",
    body: `L'organisation ${a.orgName} vient d'être créée.`,
    href: `/platform/organizations/${enc(a.orgId)}`,
    primaryLabel: "Voir l'organisation",
    links: [],
  };
}

function subscriptionHref(orgId: string, audience: "org" | "platform"): string {
  return audience === "org"
    ? `/org/${enc(orgId)}/subscription`
    : `/platform/organizations/${enc(orgId)}/subscription`;
}

export function subscriptionChangedMessage(a: {
  orgId: string;
  orgName: string;
  planName: string;
  status: SubscriptionStatus;
  audience: "org" | "platform";
}): NotificationContent {
  return {
    title: "Abonnement modifié",
    body: `L'abonnement de ${a.orgName} est maintenant le plan ${a.planName} (${SUBSCRIPTION_STATUS_LABELS[a.status]}).`,
    href: subscriptionHref(a.orgId, a.audience),
    primaryLabel: "Voir l'abonnement",
    links: [],
  };
}

export function subscriptionExpiringMessage(a: {
  orgId: string;
  orgName: string;
  planName: string;
  daysBefore: number;
  endDate: Date;
}): NotificationContent {
  const delay = a.daysBefore === 1 ? "demain" : `dans ${a.daysBefore} jours`;
  return {
    title: `Votre abonnement ${a.planName} expire ${delay}`,
    body: `L'abonnement ${a.planName} de ${a.orgName} arrive à échéance le ${a.endDate.toLocaleDateString("fr-FR", { timeZone: "UTC" })}. À l'échéance, l'abonnement expire et il n'est plus possible de créer de nouvel évènement. Pour le renouveler, rendez-vous dans l'onglet Abonnement.`,
    href: subscriptionHref(a.orgId, "org"),
    primaryLabel: "Renouveler",
    links: [],
  };
}

export function quotaExceededMessage(a: {
  orgId: string;
  orgName: string;
  eventId: string;
  audience: "org" | "platform";
}): NotificationContent {
  return {
    title: "Quota dépassé",
    body: `Un évènement a été créé pour ${a.orgName} au-delà du quota de son abonnement.`,
    href: subscriptionHref(a.orgId, a.audience),
    primaryLabel: "Voir l'abonnement",
    links: [
      a.audience === "org"
        ? { label: "Voir l'évènement", href: `/event/${enc(a.eventId)}` }
        : { label: "Voir l'évènement", href: `/platform/organizations/${enc(a.orgId)}/events` },
    ],
  };
}

export function emailFailedMessage(a: {
  jobId: string;
  kind: string;
  recipient: string | null;
  attempts: number;
}): NotificationContent {
  const to = a.recipient ? ` à ${a.recipient}` : "";
  return {
    title: "Email en échec",
    body: `L'envoi de l'email ${a.kind}${to} a échoué après ${a.attempts} tentative(s).`,
    href: `/platform/jobs/${enc(a.jobId)}`,
    primaryLabel: "Voir l'envoi",
    links: [],
  };
}

const PRINT_EXCERPT_LENGTH = 140;

const staffPrintHref = (requestId: string) => `/platform/print/orders/${enc(requestId)}`;
const organizerPrintHref = (eventId: string, requestId: string) =>
  `/event/${enc(eventId)}/print/${enc(requestId)}`;

export function printRequestSubmittedMessage(a: {
  requestId: string;
  reference: string;
  eventTitle: string;
  orgName: string;
  type: PrintRequestType;
  badgeCount: number;
}): NotificationContent {
  return {
    title: "Nouvelle commande d'impression",
    body: `${a.orgName} a envoyé la commande ${a.reference} (${PRINT_REQUEST_TYPE_LABELS[a.type].toLowerCase()}, ${a.badgeCount} badges) pour ${a.eventTitle}.`,
    href: staffPrintHref(a.requestId),
    primaryLabel: "Voir la commande",
    links: [],
  };
}

export function printRequestQuotedMessage(a: {
  requestId: string;
  eventId: string;
  reference: string;
  eventTitle: string;
  version: number;
  total: number;
}): NotificationContent {
  return {
    title: "Devis d'impression disponible",
    body: `Le devis v${a.version} de la commande ${a.reference} (${a.eventTitle}) s'élève à ${formatFcfa(a.total)}. Le propriétaire de l'organisation peut l'accepter.`,
    href: organizerPrintHref(a.eventId, a.requestId),
    primaryLabel: "Voir le devis",
    links: [],
  };
}

export function printRequestMessageMessage(a: {
  requestId: string;
  eventId: string;
  reference: string;
  authorName: string;
  body: string;
  toStaff: boolean;
}): NotificationContent {
  const excerpt =
    a.body.length > PRINT_EXCERPT_LENGTH ? `${a.body.slice(0, PRINT_EXCERPT_LENGTH)}…` : a.body;
  return {
    title: `Nouveau message — ${a.reference}`,
    body: `${a.authorName} : ${excerpt}`,
    href: a.toStaff ? staffPrintHref(a.requestId) : organizerPrintHref(a.eventId, a.requestId),
    primaryLabel: "Répondre",
    links: [],
  };
}

export function printRequestStatusChangedMessage(a: {
  requestId: string;
  eventId: string;
  reference: string;
  eventTitle: string;
  status: PrintRequestStatus;
  toStaff: boolean;
}): NotificationContent {
  const label = PRINT_REQUEST_STATUS_LABELS[a.status];
  return {
    title: `Commande ${a.reference} : ${label.toLowerCase()}`,
    body: `La commande d'impression ${a.reference} (${a.eventTitle}) est maintenant « ${label} ».`,
    href: a.toStaff ? staffPrintHref(a.requestId) : organizerPrintHref(a.eventId, a.requestId),
    primaryLabel: "Voir la commande",
    links: [],
  };
}

export function printRequestPaidMessage(a: {
  requestId: string;
  eventId: string;
  reference: string;
  eventTitle: string;
  amount: number;
  manual: boolean;
  audience: "event" | "platform";
}): NotificationContent {
  return {
    title: `Commande ${a.reference} payée`,
    body: a.manual
      ? `La commande ${a.reference} (${a.eventTitle}) a été marquée payée par l'équipe Badge.`
      : `Le paiement de ${formatFcfa(a.amount)} de la commande ${a.reference} (${a.eventTitle}) est reçu.`,
    href: a.audience === "platform" ? staffPrintHref(a.requestId) : organizerPrintHref(a.eventId, a.requestId),
    primaryLabel: "Voir la commande",
    links: [],
  };
}

export function printPaymentUnmatchedMessage(a: {
  requestId: string;
  reference: string;
  amount: number;
}): NotificationContent {
  return {
    title: `Paiement à vérifier : ${a.reference}`,
    body: `Un paiement de ${formatFcfa(a.amount)} a été approuvé alors que la commande n'attendait plus ce paiement.`,
    href: staffPrintHref(a.requestId),
    primaryLabel: "Voir la commande",
    links: [],
  };
}
