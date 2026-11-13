// Généré par scripts/page-docs — ne pas modifier à la main (make docs-stamp).
import type { PageDocIndexEntry } from "./types";

export const PAGE_DOC_INDEX: PageDocIndexEntry[] = [
  {
    "id": "account/index",
    "route": "/account",
    "space": "account",
    "title": "Mes inscriptions",
    "audience": "participant",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "account/notifications",
    "route": "/account/notifications",
    "space": "account",
    "title": "Notifications",
    "audience": "participant",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "account/profile",
    "route": "/account/profile",
    "space": "account",
    "title": "Mon profil",
    "audience": "participant",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "account/profile/complete",
    "route": "/account/profile/complete",
    "space": "account",
    "title": "Compléter votre profil",
    "audience": "participant",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "account/registrations/detail",
    "route": "/account/registrations/[id]",
    "space": "account",
    "title": "Détail d'une inscription",
    "audience": "participant",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/activity",
    "route": "/event/[eventId]/activity",
    "space": "event",
    "title": "Journal d'activité",
    "audience": "staff",
    "access": "event.activity.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/activity/detail",
    "route": "/event/[eventId]/activity/[logId]",
    "space": "event",
    "title": "Détail d'une entrée du journal",
    "audience": "staff",
    "access": "event.activity.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/badges",
    "route": "/event/[eventId]/badges",
    "space": "event",
    "title": "Badges",
    "audience": "staff",
    "access": "badge.print",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/badges/detail",
    "route": "/event/[eventId]/badges/[badgeId]",
    "space": "event",
    "title": "Fiche d'un badge",
    "audience": "staff",
    "access": "badge.print",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/badges/print",
    "route": "/event/[eventId]/badges/print",
    "space": "event",
    "title": "Impression par lot",
    "audience": "staff",
    "access": "badge.print",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/blocked-documents",
    "route": "/event/[eventId]/blocked-documents",
    "space": "event",
    "title": "Documents bloqués",
    "audience": "staff",
    "access": "registration.block",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/blocked-emails",
    "route": "/event/[eventId]/blocked-emails",
    "space": "event",
    "title": "Listes de blocage",
    "audience": "staff",
    "access": "registration.block",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/categories",
    "route": "/event/[eventId]/categories",
    "space": "event",
    "title": "Catégories",
    "audience": "organisateur",
    "access": "event.read.detailed",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/index",
    "route": "/event/[eventId]",
    "space": "event",
    "title": "Tableau de bord",
    "audience": "organisateur",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/members",
    "route": "/event/[eventId]/members",
    "space": "event",
    "title": "Membres",
    "audience": "organisateur",
    "access": "event.members.manage",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/notifications",
    "route": "/event/[eventId]/notifications",
    "space": "event",
    "title": "Notifications",
    "audience": "staff",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/print",
    "route": "/event/[eventId]/print",
    "space": "event",
    "title": "Impression",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/print/detail",
    "route": "/event/[eventId]/print/[requestId]",
    "space": "event",
    "title": "Commande d'impression",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/print/edit",
    "route": "/event/[eventId]/print/[requestId]/edit",
    "space": "event",
    "title": "Modifier une commande d'impression",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/print/new",
    "route": "/event/[eventId]/print/new",
    "space": "event",
    "title": "Nouvelle commande d'impression",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/print/onsite",
    "route": "/event/[eventId]/print/onsite",
    "space": "event",
    "title": "Poste sur place",
    "audience": "staff",
    "access": "print.onsite.operate",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/print/requestId/onsite",
    "route": "/event/[eventId]/print/[requestId]/onsite",
    "space": "event",
    "title": "Poste d'impression",
    "audience": "staff",
    "access": "print.onsite.operate",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/print/return",
    "route": "/event/[eventId]/print/[requestId]/return",
    "space": "event",
    "title": "Retour de paiement",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/registrations",
    "route": "/event/[eventId]/registrations",
    "space": "event",
    "title": "Inscriptions",
    "audience": "organisateur",
    "access": "event.read.detailed",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/registrations/detail",
    "route": "/event/[eventId]/registrations/[regId]",
    "space": "event",
    "title": "Fiche d'une inscription",
    "audience": "organisateur",
    "access": "event.read.detailed",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/registrations/new",
    "route": "/event/[eventId]/registrations/new",
    "space": "event",
    "title": "Inscription manuelle",
    "audience": "organisateur",
    "access": "registration.create",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/registrations/overview",
    "route": "/event/[eventId]/registrations/overview",
    "space": "event",
    "title": "Vue d'ensemble des inscriptions",
    "audience": "staff",
    "access": "event.read.aggregated",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/scan",
    "route": "/event/[eventId]/scan",
    "space": "event",
    "title": "Scanner",
    "audience": "staff",
    "access": "scan.check-in",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/settings",
    "route": "/event/[eventId]/settings",
    "space": "event",
    "title": "Paramètres de l'évènement",
    "audience": "organisateur",
    "access": "event.settings.update",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "event/settings/badge",
    "route": "/event/[eventId]/settings/badge",
    "space": "event",
    "title": "Modèle de badge",
    "audience": "organisateur",
    "access": "event.settings.update",
    "updatedAt": "2026-11-13"
  },
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
  {
    "id": "platform/activity",
    "route": "/platform/activity",
    "space": "platform",
    "title": "Journal d'activité de la plateforme",
    "audience": "staff",
    "access": "activity.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/activity/detail",
    "route": "/platform/activity/[logId]",
    "space": "platform",
    "title": "Détail d'une entrée du journal",
    "audience": "staff",
    "access": "activity.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/badge-templates",
    "route": "/platform/badge-templates",
    "space": "platform",
    "title": "Templates de badge",
    "audience": "staff",
    "access": "badge_templates.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/badge-templates/detail",
    "route": "/platform/badge-templates/[id]",
    "space": "platform",
    "title": "Détail d'un template de badge",
    "audience": "staff",
    "access": "badge_templates.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/index",
    "route": "/platform",
    "space": "platform",
    "title": "Tableau de bord de la plateforme",
    "audience": "staff",
    "access": "platform.access",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/jobs",
    "route": "/platform/jobs",
    "space": "platform",
    "title": "Emails",
    "audience": "staff",
    "access": "email_jobs.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/jobs/detail",
    "route": "/platform/jobs/[jobId]",
    "space": "platform",
    "title": "Détail d'un envoi d'e-mail",
    "audience": "staff",
    "access": "email_jobs.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/notifications",
    "route": "/platform/notifications",
    "space": "platform",
    "title": "Notifications",
    "audience": "staff",
    "access": "platform.access",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/organizations",
    "route": "/platform/organizations",
    "space": "platform",
    "title": "Organisations",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/organizations/activity",
    "route": "/platform/organizations/[orgId]/activity",
    "space": "platform",
    "title": "Journal d'une organisation",
    "audience": "staff",
    "access": "activity.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/organizations/detail",
    "route": "/platform/organizations/[orgId]",
    "space": "platform",
    "title": "Fiche d'une organisation",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/organizations/events",
    "route": "/platform/organizations/[orgId]/events",
    "space": "platform",
    "title": "Événements d'une organisation",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/organizations/members",
    "route": "/platform/organizations/[orgId]/members",
    "space": "platform",
    "title": "Membres d'une organisation",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/organizations/new",
    "route": "/platform/organizations/new",
    "space": "platform",
    "title": "Nouvelle organisation",
    "audience": "staff",
    "access": "organizations.create",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/organizations/subscription",
    "route": "/platform/organizations/[orgId]/subscription",
    "space": "platform",
    "title": "Abonnement d'une organisation",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/payments",
    "route": "/platform/payments",
    "space": "platform",
    "title": "Paiements",
    "audience": "staff",
    "access": "payments.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/payments/detail",
    "route": "/platform/payments/[paymentId]",
    "space": "platform",
    "title": "Détail d'un paiement",
    "audience": "staff",
    "access": "payments.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/plans",
    "route": "/platform/plans",
    "space": "platform",
    "title": "Plans",
    "audience": "staff",
    "access": "plans.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/catalog",
    "route": "/platform/print/catalog",
    "space": "platform",
    "title": "Catalogue d'impression",
    "audience": "staff",
    "access": "print.catalog.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/catalog/detail",
    "route": "/platform/print/catalog/[productId]",
    "space": "platform",
    "title": "Fiche produit du catalogue",
    "audience": "staff",
    "access": "print.catalog.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/layouts",
    "route": "/platform/print/layouts",
    "space": "platform",
    "title": "Gabarits d'impression",
    "audience": "staff",
    "access": "print.layouts.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/layouts/detail",
    "route": "/platform/print/layouts/[layoutId]",
    "space": "platform",
    "title": "Gabarit d'impression",
    "audience": "staff",
    "access": "print.layouts.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/layouts/new",
    "route": "/platform/print/layouts/new",
    "space": "platform",
    "title": "Nouveau gabarit d'impression",
    "audience": "staff",
    "access": "print.layouts.manage",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/orders",
    "route": "/platform/print/orders",
    "space": "platform",
    "title": "Commandes d'impression",
    "audience": "staff",
    "access": "print.requests.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/orders/detail",
    "route": "/platform/print/orders/[requestId]",
    "space": "platform",
    "title": "Commande d'impression",
    "audience": "staff",
    "access": "print.requests.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/orders/onsite",
    "route": "/platform/print/orders/[requestId]/onsite",
    "space": "platform",
    "title": "Poste d'impression sur place",
    "audience": "staff",
    "access": "platform.access",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/sheets",
    "route": "/platform/print/sheets",
    "space": "platform",
    "title": "Planches d'impression (commande ciblée)",
    "audience": "staff",
    "access": "print.sheets.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/sheets/free",
    "route": "/platform/print/sheets/free",
    "space": "platform",
    "title": "Génération libre de planches",
    "audience": "staff",
    "access": "print.sheets.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/sheets/generated",
    "route": "/platform/print/sheets/generated",
    "space": "platform",
    "title": "Planches générées",
    "audience": "staff",
    "access": "print.sheets.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/print/sheets/pending",
    "route": "/platform/print/sheets/pending",
    "space": "platform",
    "title": "Planches à traiter",
    "audience": "staff",
    "access": "print.sheets.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/profiles",
    "route": "/platform/profiles",
    "space": "platform",
    "title": "Profils participants",
    "audience": "staff",
    "access": "profiles.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/profiles/detail",
    "route": "/platform/profiles/[userId]",
    "space": "platform",
    "title": "Validation d'un profil",
    "audience": "staff",
    "access": "profiles.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/roles",
    "route": "/platform/roles",
    "space": "platform",
    "title": "Rôles de la plateforme",
    "audience": "staff",
    "access": "platform.roles.manage",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/roles/detail",
    "route": "/platform/roles/[roleId]",
    "space": "platform",
    "title": "Détail d'un rôle de la plateforme",
    "audience": "staff",
    "access": "platform.roles.manage",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/roles/new",
    "route": "/platform/roles/new",
    "space": "platform",
    "title": "Nouveau rôle de la plateforme",
    "audience": "staff",
    "access": "platform.roles.manage",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/settings",
    "route": "/platform/settings",
    "space": "platform",
    "title": "Paramètres de la plateforme",
    "audience": "staff",
    "access": "platform.access",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/settings/badge",
    "route": "/platform/settings/badge",
    "space": "platform",
    "title": "Template de badge par défaut",
    "audience": "staff",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/users",
    "route": "/platform/users",
    "space": "platform",
    "title": "Utilisateurs",
    "audience": "staff",
    "access": "users.read",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/users/detail",
    "route": "/platform/users/[userId]",
    "space": "platform",
    "title": "Fiche d'un utilisateur",
    "audience": "staff",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/users/new",
    "route": "/platform/users/new",
    "space": "platform",
    "title": "Nouvel utilisateur",
    "audience": "staff",
    "updatedAt": "2026-11-13"
  },
  {
    "id": "platform/users/permissions",
    "route": "/platform/users/[userId]/permissions",
    "space": "platform",
    "title": "Permissions d'un utilisateur",
    "audience": "staff",
    "access": "users.permissions.manage",
    "updatedAt": "2026-11-13"
  },
];
