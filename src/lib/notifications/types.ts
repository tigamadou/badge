import type {
  EventRole,
  NotificationScope,
  NotificationType,
  OrgRole,
  StaffRole,
} from "@prisma/client";

// anchor : sous-chaîne exacte du body à transformer en lien (absente : repli sur le titre).
export type NotificationLink = { label: string; href: string; anchor?: string };

export type NotificationContent = {
  title: string;
  body: string;
  href: string;
  // Libellé du bouton du lien principal (« Voir l'inscription »…), stocké en links[0].
  primaryLabel: string;
  // Ancre du lien principal dans le body.
  anchor?: string;
  // Liens secondaires.
  links: NotificationLink[];
};

export type RecipientSpec =
  | { users: string[] }
  | { eventRoles: { eventId: string; roles: EventRole[] } }
  | { orgRoles: { orgId: string; roles: OrgRole[] } }
  | { staffMinRole: StaffRole };

export type NotifyInput = {
  type: NotificationType;
  scope: NotificationScope;
  recipients: RecipientSpec;
  actorId?: string | null;
  orgId?: string;
  eventId?: string;
  content: NotificationContent;
  // Défaut : EMAIL_BY_TYPE[type].
  email?: boolean;
};

export type NotificationDTO = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  links: NotificationLink[];
  readAt: string | null;
  createdAt: string;
};
