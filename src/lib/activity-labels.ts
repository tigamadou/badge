import type { ActivityType } from "@prisma/client";

export type LogKind = "creation" | "modification" | "suppression" | "systeme" | "connexion" | "acces";

// Mappe un ActivityType sur une categorie visuelle de LogType (blocs journal).
export function logKind(t: ActivityType): LogKind {
  const s = String(t);
  if (s === "USER_LOGIN") return "connexion";
  if (
    s.endsWith("_CREATED") ||
    s === "MEMBERSHIP_ADDED" ||
    s === "USER_REGISTERED" ||
    s === "ORG_RESTORED" ||
    s === "EVENT_RESTORED" ||
    s === "PRINT_CREDIT_EARNED"
  )
    return "creation";
  if (s.endsWith("_DELETED") || s.endsWith("_ARCHIVED") || s === "MEMBERSHIP_REMOVED" || s === "USER_BLOCKED")
    return "suppression";
  if (s === "BADGE_SCANNED" || s === "PRINT_SHEETS_GENERATED" || s.endsWith("_PRINTED") || s.endsWith("_EXPORTED")) return "acces";
  if (
    s.endsWith("_UPDATED") ||
    s === "REGISTRATION_SNAPSHOT_REFRESHED" ||
    s === "MEMBERSHIP_ROLE_CHANGED" ||
    s.endsWith("SETTINGS_UPDATED") ||
    s === "USER_PASSWORD_SET" ||
    s === "PRINT_REQUEST_MARGIN_RAISED" ||
    s === "PRINT_CREDIT_APPLIED"
  )
    return "modification";
  return "systeme";
}

const DESCRIPTIONS: Partial<Record<ActivityType, string>> = {
  REGISTRATION_CREATED: "Inscription créée",
  REGISTRATION_APPROVED: "Inscription approuvée",
  REGISTRATION_REJECTED: "Inscription rejetée",
  REGISTRATION_UPDATED: "Inscription modifiée",
  REGISTRATION_DELETED: "Inscription supprimée",
  REGISTRATION_SNAPSHOT_REFRESHED: "Inscription mise a jour depuis le profil",
  BADGE_PRINTED: "Badge imprimé",
  BADGE_BATCH_PRINTED: "Impression de badges par lot",
  BADGE_EXPORTED: "Badge exporté",
  BADGE_SCANNED: "Badge scanné",
  USER_CREATED: "Utilisateur créé",
  USER_UPDATED: "Utilisateur modifié",
  USER_DELETED: "Utilisateur supprimé",
  USER_LOGIN: "Connexion utilisateur",
  ORG_CREATED: "Organisation créée",
  ORG_UPDATED: "Organisation modifiée",
  ORG_ARCHIVED: "Organisation archivée",
  ORG_RESTORED: "Organisation restaurée",
  EVENT_CREATED: "Événement créé",
  EVENT_UPDATED: "Événement modifié",
  EVENT_ARCHIVED: "Événement archivé",
  EVENT_RESTORED: "Événement restauré",
  MEMBERSHIP_ADDED: "Membre ajouté",
  MEMBERSHIP_REMOVED: "Membre retiré",
  MEMBERSHIP_ROLE_CHANGED: "Rôle de membre modifié",
  PLATFORM_SETTINGS_UPDATED: "Paramètres plateforme modifiés",
  EVENT_SETTINGS_UPDATED: "Paramètres d'événement modifiés",
  JOB_RETRIED: "Email relancé",
  JOB_CANCELLED: "Email annulé",
  PAYMENT_INITIATED: "Paiement initié",
  PAYMENT_APPROVED: "Paiement approuvé",
  PAYMENT_FAILED: "Paiement échoué",
  PRINT_LAYOUT_CREATED: "Gabarit d'impression créé",
  PRINT_LAYOUT_UPDATED: "Gabarit d'impression modifié",
  PRINT_LAYOUT_ARCHIVED: "Gabarit d'impression archivé",
  PRINT_SHEETS_GENERATED: "Planches de badges générées",
  PRINT_PRODUCT_CREATED: "Produit d'impression créé",
  PRINT_PRODUCT_UPDATED: "Produit d'impression modifié",
  PRINT_PRODUCT_ARCHIVED: "Produit d'impression archivé",
  PRINT_REQUEST_SUBMITTED: "Commande d'impression envoyée",
  PRINT_REQUEST_UPDATED: "Commande d'impression modifiée",
  PRINT_REQUEST_QUOTED: "Devis d'impression envoyé",
  PRINT_REQUEST_ACCEPTED: "Devis d'impression accepté",
  PRINT_REQUEST_REOPENED: "Devis d'impression rouvert",
  PRINT_REQUEST_STATUS_CHANGED: "Statut de commande d'impression changé",
  PRINT_REQUEST_CANCELLED: "Commande d'impression annulée",
  PRINT_REQUEST_REJECTED: "Commande d'impression refusée",
  PRINT_REQUEST_MARKED_PAID: "Commande d'impression marquée payée",
  PRINT_REQUEST_MARGIN_RAISED: "Marge d'impression sur place modifiée",
  PRINT_CREDIT_APPLIED: "Crédit d'impression appliqué",
  PRINT_CREDIT_EARNED: "Crédit d'impression acquis",
  PRINT_REQUEST_SUPPLEMENT_CREATED: "Commande d'impression complémentaire créée",
};

// Libelle humain (FR) d'un type d'action ; fallback sur le type brut.
export function describeActivity(t: ActivityType): string {
  return DESCRIPTIONS[t] ?? String(t);
}

export type DiffRow = { field: string; from: string; to: string };

// Extrait les differences avant/apres si `details` contient { changes: { <champ>: { from, to } } }.
export function extractDiff(details: unknown): DiffRow[] {
  if (!details || typeof details !== "object") return [];
  const changes = (details as { changes?: unknown }).changes;
  if (!changes || typeof changes !== "object") return [];
  const rows: DiffRow[] = [];
  for (const [field, val] of Object.entries(changes as Record<string, unknown>)) {
    if (val && typeof val === "object" && "from" in val && "to" in val) {
      rows.push({
        field,
        from: String((val as { from: unknown }).from ?? "—"),
        to: String((val as { to: unknown }).to ?? "—"),
      });
    }
  }
  return rows;
}
