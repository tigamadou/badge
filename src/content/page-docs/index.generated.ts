// Généré par scripts/page-docs — ne pas modifier à la main (make docs-stamp).
import type { PageDocIndexEntry } from "./types";

export const PAGE_DOC_INDEX: PageDocIndexEntry[] = [
  {
    "id": "org/activity",
    "route": "/org/[orgId]/activity",
    "space": "org",
    "title": "Journal d'activité",
    "audience": "organisateur",
    "access": "org.activity.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/activity/detail",
    "route": "/org/[orgId]/activity/[logId]",
    "space": "org",
    "title": "Détail d'une entrée du journal",
    "audience": "organisateur",
    "access": "org.activity.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/events",
    "route": "/org/[orgId]/events",
    "space": "org",
    "title": "Événements",
    "audience": "organisateur",
    "access": "org.events.list",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/events/new",
    "route": "/org/[orgId]/events/new",
    "space": "org",
    "title": "Nouvel événement",
    "audience": "organisateur",
    "access": "org.events.create",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/index",
    "route": "/org/[orgId]",
    "space": "org",
    "title": "Tableau de bord",
    "audience": "organisateur",
    "access": "org.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/members",
    "route": "/org/[orgId]/members",
    "space": "org",
    "title": "Membres",
    "audience": "organisateur",
    "access": "org.members.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/members/permissions",
    "route": "/org/[orgId]/members/[userId]/permissions",
    "space": "org",
    "title": "Permissions d'un membre",
    "audience": "organisateur",
    "access": "org.members.permissions.manage",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/notifications",
    "route": "/org/[orgId]/notifications",
    "space": "org",
    "title": "Notifications",
    "audience": "organisateur",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/payments",
    "route": "/org/[orgId]/payments",
    "space": "org",
    "title": "Paiements",
    "audience": "organisateur",
    "access": "billing.payments.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/payments/detail",
    "route": "/org/[orgId]/payments/[paymentId]",
    "space": "org",
    "title": "Détail d'un paiement",
    "audience": "organisateur",
    "access": "billing.payments.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/roles",
    "route": "/org/[orgId]/roles",
    "space": "org",
    "title": "Rôles",
    "audience": "organisateur",
    "access": "org.roles.manage",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/roles/detail",
    "route": "/org/[orgId]/roles/[roleId]",
    "space": "org",
    "title": "Détail d'un rôle",
    "audience": "organisateur",
    "access": "org.roles.manage",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/roles/new",
    "route": "/org/[orgId]/roles/new",
    "space": "org",
    "title": "Nouveau rôle",
    "audience": "organisateur",
    "access": "org.roles.manage",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/settings",
    "route": "/org/[orgId]/settings",
    "space": "org",
    "title": "Paramètres de l'organisation",
    "audience": "organisateur",
    "access": "org.update",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/settings/badge",
    "route": "/org/[orgId]/settings/badge",
    "space": "org",
    "title": "Modèle de badge",
    "audience": "organisateur",
    "access": "org.badge_settings.update",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/subscription",
    "route": "/org/[orgId]/subscription",
    "space": "org",
    "title": "Abonnement",
    "audience": "organisateur",
    "access": "billing.subscription.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/subscription/return",
    "route": "/org/[orgId]/subscription/return",
    "space": "org",
    "title": "Retour de paiement",
    "audience": "organisateur",
    "access": "billing.subscription.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "org/templates",
    "route": "/org/[orgId]/templates",
    "space": "org",
    "title": "Modèles de catégories",
    "audience": "organisateur",
    "access": "org.templates.read",
    "updatedAt": "2026-11-13"
  },
];
