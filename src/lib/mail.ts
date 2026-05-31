// ============================================================
//  STUBS Plan 6 (notifications email) - temporaires
//  A REMPLACER par la vraie implementation lors du Plan v2-06.
//  Ces stubs permettent au Plan v2-02 (espace staff) d'avancer
//  sans depender du merge complet de v2-06.
//
//  Cassant pour les routes v1 qui appelaient sendRegistrationConfirmation,
//  sendStatusNotification, sendEditLinkEmail, sendBadgePrintedNotification.
//  Mais ces routes etaient deja cassees par le Lot A (checkRole v1 supprime).
// ============================================================

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Genere un inviteToken (48h), persiste sur le User, ne fait pas d'envoi reel.
// Plan 6 remplacera par un nodemailer.sendMail avec branding contextuel.
export async function sendUserInvitation(
  userId: string,
  _options?: { orgId?: string; eventId?: string; role?: string },
): Promise<void> {
  const inviteToken = randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 24 * 3600 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { inviteToken, inviteTokenExpiry },
  });
  console.warn("[stub Plan 6] sendUserInvitation: token genere, email NON envoye", {
    userId,
    inviteToken,
  });
}

// Reset password = meme mecanique qu'invitation (token + lien setup-password).
// Plan 6 enverra un template specifique avec un libelle "reset" plutot
// qu'"invitation".
export async function sendPasswordResetEmail(userId: string): Promise<void> {
  await sendUserInvitation(userId);
  console.warn("[stub Plan 6] sendPasswordResetEmail: alias sur sendUserInvitation", { userId });
}

// Test SMTP : Plan 6 verifiera reellement la connexion SMTP. Ici on valide
// juste le format de l'email destinataire pour permettre aux tests d'API
// /api/staff/settings/test-smtp de passer.
export async function sendSmtpTest(args: {
  to: string;
  orgId?: string;
  eventId?: string;
}): Promise<void> {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(args.to)) {
    throw new Error(`Invalid email address: ${args.to}`);
  }
  console.warn("[stub Plan 6] sendSmtpTest: validation OK, email NON envoye", args);
}

// Notification de creation d'inscription (statut PENDING).
// Plan 6 enverra un template avec libelle "registration-received".
export async function sendRegistrationConfirmation(registrationId: string): Promise<void> {
  console.warn("[stub Plan 6] sendRegistrationConfirmation: email NON envoye", { registrationId });
}

// Notification de changement de statut d'inscription (APPROVED/REJECTED).
// Plan 6 enverra le template "registration-approved" ou "registration-rejected"
// avec le branding contextuel et le motif de rejet le cas echeant.
export async function sendStatusNotification(registrationId: string): Promise<void> {
  console.warn("[stub Plan 6] sendStatusNotification: email NON envoye", { registrationId });
}

// Notification d'impression de badge. Plan 6 enverra un template avec lien
// vers /verify/[id] et coordonnees de retrait.
export async function sendBadgePrintedNotification(registrationId: string): Promise<void> {
  console.warn("[stub Plan 6] sendBadgePrintedNotification: email NON envoye", { registrationId });
}

// Renvoi du lien d'edition d'inscription. Plan 6 regenerera l'editToken
// (hash + expiry) avant envoi. Le stub ne touche pas a l'editToken pour
// rester sans effet de bord sur les tests qui n'attendent pas de mutation.
export async function sendEditLinkEmail(registrationId: string): Promise<void> {
  console.warn("[stub Plan 6] sendEditLinkEmail: email NON envoye", { registrationId });
}
