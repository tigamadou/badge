import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TransportContext } from "@/lib/mail";
import { EMAIL_PRIORITY_VALUE } from "./constants";

export type EmailPriority = "high" | "normal";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  kind: string;
  replyTo?: string;
  priority?: EmailPriority;
  ctx?: TransportContext;
}

// Liste unique des `kind` existants (filtres et masquage des kind sensibles : spec 23).
export const EMAIL_KIND = {
  REGISTRATION_RECEIVED: "registration.received",
  REGISTRATION_APPROVED: "registration.approved",
  REGISTRATION_REJECTED: "registration.rejected",
  REGISTRATION_RESUBMITTED: "registration.resubmitted",
  BADGE_PRINTED: "badge.printed",
  ACCOUNT_VERIFY_EMAIL: "account.verify-email",
  ACCOUNT_PASSWORD_RESET: "account.password-reset",
  USER_INVITATION: "user.invitation",
  USER_PASSWORD_RESET: "user.password-reset",
  PROFILE_APPROVED: "profile.approved",
  PROFILE_REJECTED: "profile.rejected",
  CONTACT_MESSAGE: "contact.message",
} as const;

// Insere un Job EMAIL ; avec tx, l'insertion fait partie de la transaction de l'appelant.
export async function enqueueEmail(
  message: EmailMessage,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const { to, subject, html, kind, replyTo, ctx, priority } = message;
  const client = tx ?? prisma;
  await client.job.create({
    data: {
      type: "EMAIL",
      kind,
      recipient: to,
      priority: EMAIL_PRIORITY_VALUE[priority ?? "normal"],
      payload: {
        to,
        subject,
        html,
        kind,
        ...(replyTo ? { replyTo } : {}),
        ...(ctx ? { ctx } : {}),
      },
    },
  });
}
