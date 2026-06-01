import { randomBytes } from "crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { resolveSettings, getPlatformSmtp, type ResolvedSettings } from "@/lib/settings";
import {
  buildBaseUrl,
  formatFromAddress,
  formatFrenchDate,
} from "@/lib/mail-helpers";

export type TransportContext = {
  eventId?: string;
  orgId?: string;
};

export type ResolvedTransport = {
  transporter: Transporter;
  from: string;
  contactEmail: string;
  contactPhone: string;
  eventTitle?: string;
  orgName?: string;
  // ADR 2026-06-01 (v2-14 Task 13) : `orgWebsite` ajoute pour affichage footer email.
  orgWebsite?: string;
  logoUrl?: string;
  settings: ResolvedSettings;
};

// Branding contextuel uniquement (logo + nom event/org). En v2 le SMTP est plateforme
// uniquement : on ne lit plus `smtpFrom` sur OrgSettings/EventSettings (champs supprimes).
// Le `fromLabel` sert a habiller l'expediteur affiche avec le nom de l'event ou de l'org.
async function loadBrandingContext(ctx: TransportContext): Promise<{
  eventTitle?: string;
  orgName?: string;
  orgWebsite?: string;
  logoUrl?: string;
  resolvedOrgId?: string;
  fromLabel: string | null;
}> {
  const baseUrl = buildBaseUrl({
    BASE_URL: process.env.BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  });

  if (ctx.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: ctx.eventId },
      select: {
        title: true,
        logo: true,
        orgId: true,
        organization: { select: { name: true, logo: true, website: true } },
      },
    });
    if (event) {
      // Fallback logo email : Event.logo -> Organization.logo (cascade 2026-05-31).
      const logoKey = event.logo ?? event.organization.logo ?? null;
      return {
        eventTitle: event.title,
        orgName: event.organization.name,
        orgWebsite: event.organization.website ?? undefined,
        logoUrl: logoKey ? `${baseUrl}/api/files/${logoKey}` : undefined,
        resolvedOrgId: event.orgId,
        fromLabel: event.title,
      };
    }
  }

  if (ctx.orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { name: true, logo: true, website: true },
    });
    if (org) {
      return {
        orgName: org.name,
        orgWebsite: org.website ?? undefined,
        logoUrl: org.logo ? `${baseUrl}/api/files/${org.logo}` : undefined,
        fromLabel: org.name,
        resolvedOrgId: ctx.orgId,
      };
    }
  }

  return { fromLabel: null };
}

async function resolveTransporterImpl(ctx: TransportContext): Promise<ResolvedTransport> {
  // SMTP plateforme uniquement (pas de cascade) - voir spec notifications-email.md (2026-05-31).
  const smtp = await getPlatformSmtp();
  // Branding (logo, contactEmail, contactPhone) reste cascade Event -> Org -> Platform.
  const settings = await resolveSettings(ctx.eventId, ctx.orgId);
  const branding = await loadBrandingContext(ctx);

  const transporter = nodemailer.createTransport({
    host: smtp.smtpHost || "localhost",
    port: smtp.smtpPort || 587,
    secure: smtp.smtpSecure,
    ...(smtp.smtpUser && smtp.smtpPassword
      ? { auth: { user: smtp.smtpUser, pass: smtp.smtpPassword } }
      : {}),
  });

  const from = formatFromAddress(smtp.smtpFrom || "noreply@badge.local", branding.fromLabel);

  return {
    transporter,
    from,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    eventTitle: branding.eventTitle,
    orgName: branding.orgName,
    orgWebsite: branding.orgWebsite,
    logoUrl: branding.logoUrl,
    settings,
  };
}

// Indirection mutable utilisee par les fonctions d'envoi internes. En ESM,
// vi.spyOn sur l'export public de resolveTransporter ne peut pas intercepter les
// appels intra-module (binding local) — d'ou ce wrapper qui peut etre remplace
// dans les tests via `__mailTesting.setResolveTransporter()`.
const mailDeps: {
  resolveTransporter: (ctx: TransportContext) => Promise<ResolvedTransport>;
} = {
  resolveTransporter: resolveTransporterImpl,
};

export function resolveTransporter(ctx: TransportContext): Promise<ResolvedTransport> {
  return mailDeps.resolveTransporter(ctx);
}

// API privee reservee aux tests : remplace l'implementation de resolveTransporter
// utilisee par les fonctions d'envoi (sendRegistrationConfirmation, etc.). Toujours
// appeler `reset()` apres usage (afterEach).
export const __mailTesting = {
  setResolveTransporter(
    fn: (ctx: TransportContext) => Promise<ResolvedTransport>,
  ): void {
    mailDeps.resolveTransporter = fn;
  },
  reset(): void {
    mailDeps.resolveTransporter = resolveTransporterImpl;
  },
};

export type BuildEmailArgs = {
  title: string;
  body: string;
  ctx: ResolvedTransport;
};

export function buildEmail({ title, body, ctx }: BuildEmailArgs): string {
  const headerLabel = ctx.eventTitle || ctx.orgName || "Badge";

  const logoBlock = ctx.logoUrl
    ? `<img src="${ctx.logoUrl}" alt="${escapeAttr(headerLabel)}" style="max-height:64px;max-width:200px;margin-bottom:16px;" />`
    : "";

  const footerLines: string[] = [];
  if (ctx.contactEmail) {
    footerLines.push(
      `<p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">
  <a href="mailto:${escapeAttr(ctx.contactEmail)}" style="color:#94a3b8;text-decoration:none;">${escapeText(ctx.contactEmail)}</a>
</p>`,
    );
  }
  if (ctx.contactPhone) {
    footerLines.push(
      `<p style="margin:0;color:#94a3b8;font-size:12px;">${escapeText(ctx.contactPhone)}</p>`,
    );
  }
  // ADR 2026-06-01 (v2-14 Task 13) : lien orgWebsite si defini.
  if (ctx.orgWebsite) {
    footerLines.push(
      `<p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">
  <a href="${escapeAttr(ctx.orgWebsite)}" style="color:#94a3b8;text-decoration:none;">${escapeText(ctx.orgWebsite)}</a>
</p>`,
    );
  }
  if (footerLines.length === 0) {
    footerLines.push(
      `<p style="margin:0;color:#94a3b8;font-size:12px;">${escapeText(headerLabel)}</p>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeText(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td align="center" style="background-color:#0f172a;padding:28px 24px;">
              ${logoBlock}
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;letter-spacing:0.02em;">${escapeText(headerLabel)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;color:#334155;font-size:15px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 28px;border-top:1px solid #e2e8f0;">
              ${footerLines.join("\n")}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeText(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch] ?? ch,
  );
}

function escapeAttr(s: string): string {
  return escapeText(s);
}

async function safeSend(args: {
  to: string;
  subject: string;
  html: string;
  ctx: ResolvedTransport;
}): Promise<void> {
  try {
    await args.ctx.transporter.sendMail({
      from: args.ctx.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
  } catch (err) {
    console.error("[mail] sendMail failed", {
      to: args.to,
      subject: args.subject,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendRegistrationConfirmation(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      snapshotEmail: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      eventId: true,
      event: { select: { title: true, date: true, location: true } },
    },
  });
  if (!reg) {
    console.error("[mail] sendRegistrationConfirmation: registration not found", {
      registrationId,
    });
    return;
  }

  const ctx = await resolveTransporter({ eventId: reg.eventId });
  const fullName = escapeText(`${reg.snapshotFirstName} ${reg.snapshotLastName}`);
  const eventTitle = escapeText(reg.event.title);
  const eventDate = formatFrenchDate(reg.event.date);
  const eventLocation = escapeText(reg.event.location);

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Votre inscription à <strong>${eventTitle}</strong> (${escapeText(eventDate)}, ${eventLocation}) a bien été reçue. Elle est en attente de validation.</p>
    <p style="margin:0;">Vous recevrez un email dès que votre inscription sera traitée.</p>
  `;

  await safeSend({
    to: reg.snapshotEmail,
    subject: `Confirmation d'inscription — ${reg.event.title}`,
    html: buildEmail({ title: `Confirmation d'inscription`, body, ctx }),
    ctx,
  });
}

export async function sendStatusNotification(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      snapshotEmail: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      status: true,
      rejectionReason: true,
      rejectionDetails: true,
      eventId: true,
      event: { select: { title: true } },
    },
  });

  if (!reg) {
    console.error("[mail] sendStatusNotification: registration not found", { registrationId });
    return;
  }

  if (reg.status !== "APPROVED" && reg.status !== "REJECTED") {
    console.error("[mail] sendStatusNotification: status not eligible", {
      registrationId,
      status: reg.status,
    });
    return;
  }

  const ctx = await resolveTransporter({ eventId: reg.eventId });
  const fullName = escapeText(`${reg.snapshotFirstName} ${reg.snapshotLastName}`);
  const eventTitle = escapeText(reg.event.title);

  if (reg.status === "APPROVED") {
    const body = `
      <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
      <p style="margin:0 0 16px;">Votre inscription à <strong>${eventTitle}</strong> a été <span style="color:#059669;font-weight:600;">approuvée</span>.</p>
      <p style="margin:0;">Votre badge sera disponible le jour de l'événement.</p>
    `;
    await safeSend({
      to: reg.snapshotEmail,
      subject: `Votre inscription à ${reg.event.title} est approuvée`,
      html: buildEmail({ title: "Inscription approuvée", body, ctx }),
      ctx,
    });
    return;
  }

  // REJECTED -- v2-11 : lien vers /account/registrations/[id] (login requis)
  // au lieu de /edit-registration/[editToken] (token public legacy supprime).
  const baseUrl = buildBaseUrl({
    BASE_URL: process.env.BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  });
  const reasonBlock = reg.rejectionReason
    ? `<p style="margin:0 0 8px;"><strong>Motif :</strong> ${escapeText(reg.rejectionReason)}</p>`
    : "";
  const detailsBlock = reg.rejectionDetails
    ? `<p style="margin:0 0 16px;color:#64748b;font-size:14px;">${escapeText(reg.rejectionDetails)}</p>`
    : "";
  const editBlock = `<p style="margin:0 0 24px;text-align:center;">
        <a href="${baseUrl}/account/registrations/${encodeURIComponent(reg.id)}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Consulter et resoumettre mon inscription</a>
      </p>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Connectez-vous à votre compte Badge pour modifier votre profil et resoumettre votre inscription.</p>`;

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Nous sommes désolés, votre inscription à <strong>${eventTitle}</strong> a été <span style="color:#e11d48;font-weight:600;">rejetée</span>.</p>
    ${reasonBlock}
    ${detailsBlock}
    ${editBlock}
    <p style="margin:0;">Pour plus d'informations, veuillez contacter l'organisation.</p>
  `;

  await safeSend({
    to: reg.snapshotEmail,
    subject: `Inscription rejetée — ${reg.event.title}`,
    html: buildEmail({ title: "Inscription rejetée", body, ctx }),
    ctx,
  });
}

export async function sendBadgePrintedNotification(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      snapshotEmail: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      badgePrinted: true,
      eventId: true,
      event: { select: { title: true } },
    },
  });
  if (!reg) {
    console.error("[mail] sendBadgePrintedNotification: registration not found", {
      registrationId,
    });
    return;
  }
  if (!reg.badgePrinted) {
    console.error("[mail] sendBadgePrintedNotification: badge not yet printed", {
      registrationId,
    });
    return;
  }

  const ctx = await resolveTransporter({ eventId: reg.eventId });
  const fullName = escapeText(`${reg.snapshotFirstName} ${reg.snapshotLastName}`);

  const contactBlock =
    ctx.contactEmail || ctx.contactPhone
      ? `
      <p style="margin:16px 0 8px;">Pour toute question concernant le retrait :</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
        ${ctx.contactEmail ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Email :</td><td style="padding:4px 0 4px 8px;"><a href="mailto:${escapeAttr(ctx.contactEmail)}" style="color:#4f46e5;text-decoration:none;">${escapeText(ctx.contactEmail)}</a></td></tr>` : ""}
        ${ctx.contactPhone ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Tél :</td><td style="padding:4px 0 4px 8px;color:#334155;">${escapeText(ctx.contactPhone)}</td></tr>` : ""}
      </table>
    `
      : "";

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Votre badge pour <strong>${escapeText(reg.event.title)}</strong> a été imprimé et est prêt à être retiré.</p>
    <p style="margin:0 0 16px;">Pour le retrait, veuillez vous présenter <strong>muni(e) de votre pièce d'identité</strong> (celle fournie lors de votre inscription).</p>
    ${contactBlock}
  `;

  await safeSend({
    to: reg.snapshotEmail,
    subject: `Badge prêt — ${reg.event.title}`,
    html: buildEmail({ title: "Votre badge est prêt", body, ctx }),
    ctx,
  });
}

// v2-11 : nouveau template -- envoye apres /api/auth/register pour confirmer l'email.
// Le `plainToken` est genere par l'appelant (la route) qui en a deja stocke le hash en BDD.
export async function sendAccountVerifyEmail(userId: string, plainToken: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) {
    console.error("[mail] sendAccountVerifyEmail: user not found", { userId });
    return;
  }

  const ctx = await resolveTransporter({});
  const baseUrl = buildBaseUrl({
    BASE_URL: process.env.BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  });
  const safeName = escapeText(user.name);

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${safeName}</strong>,</p>
    <p style="margin:0 0 16px;">Bienvenue sur Badge. Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${baseUrl}/verify-email/${plainToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Confirmer mon email</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 24 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.</p>
  `;

  await safeSend({
    to: user.email,
    subject: "Confirmez votre adresse email — Badge",
    html: buildEmail({ title: "Confirmez votre email", body, ctx }),
    ctx,
  });
}

// v2-11 : nouveau template -- envoye apres /api/auth/forgot-password (self-service).
// Distinct de sendPasswordResetEmail (staff-initiated, utilise inviteToken).
export async function sendAccountPasswordReset(userId: string, plainToken: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) {
    console.error("[mail] sendAccountPasswordReset: user not found", { userId });
    return;
  }

  const ctx = await resolveTransporter({});
  const baseUrl = buildBaseUrl({
    BASE_URL: process.env.BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  });
  const safeName = escapeText(user.name);

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${safeName}</strong>,</p>
    <p style="margin:0 0 16px;">Vous avez demandé à réinitialiser le mot de passe de votre compte Badge.</p>
    <p style="margin:0 0 24px;">Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${baseUrl}/reset-password/${plainToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Réinitialiser mon mot de passe</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
  `;

  await safeSend({
    to: user.email,
    subject: "Réinitialisation de votre mot de passe — Badge",
    html: buildEmail({ title: "Réinitialisation du mot de passe", body, ctx }),
    ctx,
  });
}

// v2-11 : nouveau template -- confirme une resoumission d'inscription apres
// rejet (route POST /api/account/registrations/[id]/resubmit).
export async function sendRegistrationResubmitted(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      snapshotEmail: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      eventId: true,
      event: { select: { title: true } },
    },
  });
  if (!reg) {
    console.error("[mail] sendRegistrationResubmitted: registration not found", {
      registrationId,
    });
    return;
  }

  const ctx = await resolveTransporter({ eventId: reg.eventId });
  const fullName = escapeText(`${reg.snapshotFirstName} ${reg.snapshotLastName}`);
  const eventTitle = escapeText(reg.event.title);
  const baseUrl = buildBaseUrl({
    BASE_URL: process.env.BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  });

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Votre inscription à <strong>${eventTitle}</strong> a bien été resoumise et est de nouveau en attente de validation.</p>
    <p style="margin:0 0 16px;">Vous recevrez un email dès que votre inscription sera traitée.</p>
    <p style="margin:0;text-align:center;">
      <a href="${baseUrl}/account/registrations/${encodeURIComponent(reg.id)}" style="color:#4f46e5;text-decoration:none;font-size:14px;">Voir le détail de mon inscription</a>
    </p>
  `;

  await safeSend({
    to: reg.snapshotEmail,
    subject: `Inscription resoumise — ${reg.event.title}`,
    html: buildEmail({ title: "Inscription resoumise", body, ctx }),
    ctx,
  });
}

// ADR 2026-06-01 (v2-14 Task 13) : libelles FR par role injectes dans le body
// du mail USER_INVITATION. Source de verite UI -> mail.
const ROLE_LABELS_FR: Record<string, string> = {
  OWNER: "Proprietaire",
  MANAGER: "Gerant",
  AUDITOR: "Auditeur",
  ADMIN: "Administrateur d'evenement",
  OPERATOR: "Operateur",
  PRINTER: "Responsable impression",
  VIEWER: "Lecteur",
  SUPER_ADMIN: "Super administrateur",
  STAFF_ADMIN: "Administrateur staff",
  STAFF_SUPPORT: "Support staff",
  STAFF_OBSERVER: "Observateur staff",
};

export async function sendUserInvitation(
  userId: string,
  options?: { orgId?: string; eventId?: string; role?: string },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) {
    console.error("[mail] sendUserInvitation: user not found", { userId });
    return;
  }

  const inviteToken = randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 24 * 3600 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { inviteToken, inviteTokenExpiry },
  });

  const ctx = await resolveTransporter({
    eventId: options?.eventId,
    orgId: options?.orgId,
  });
  const baseUrl = buildBaseUrl({
    BASE_URL: process.env.BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  });
  const safeName = escapeText(user.name);
  const orgClause = ctx.orgName
    ? ` pour l'organisation <strong>${escapeText(ctx.orgName)}</strong>`
    : "";

  // ADR 2026-06-01 (v2-14 Task 13) : libelle FR du role injecte dans le body
  // si fourni par l'appelant.
  const roleLabel = options?.role ? ROLE_LABELS_FR[options.role] : undefined;
  const roleClause = roleLabel
    ? `<p style="margin:0 0 16px;">Role attribue : <strong>${escapeText(roleLabel)}</strong>.</p>`
    : "";

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${safeName}</strong>,</p>
    <p style="margin:0 0 16px;">Un compte vient d'être créé pour vous sur Badge${orgClause}.</p>
    ${roleClause}
    <p style="margin:0 0 24px;">Cliquez sur le bouton ci-dessous pour définir votre mot de passe et activer votre compte :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${baseUrl}/setup-password?token=${inviteToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Définir mon mot de passe</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 24 heures.</p>
  `;

  await safeSend({
    to: user.email,
    subject: "Bienvenue sur Badge",
    html: buildEmail({ title: "Bienvenue sur Badge", body, ctx }),
    ctx,
  });
}

export async function sendPasswordResetEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) {
    console.error("[mail] sendPasswordResetEmail: user not found", { userId });
    return;
  }

  const inviteToken = randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 24 * 3600 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { inviteToken, inviteTokenExpiry },
  });

  const ctx = await resolveTransporter({});
  const baseUrl = buildBaseUrl({
    BASE_URL: process.env.BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  });
  const safeName = escapeText(user.name);

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${safeName}</strong>,</p>
    <p style="margin:0 0 16px;">Une réinitialisation de votre mot de passe a été déclenchée pour votre compte Badge.</p>
    <p style="margin:0 0 24px;">Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${baseUrl}/setup-password?token=${inviteToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Réinitialiser mon mot de passe</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
  `;

  await safeSend({
    to: user.email,
    subject: "Réinitialisation de votre mot de passe",
    html: buildEmail({ title: "Réinitialisation du mot de passe", body, ctx }),
    ctx,
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendSmtpTest(args: {
  to: string;
  orgId?: string;
  eventId?: string;
}): Promise<void> {
  if (!EMAIL_REGEX.test(args.to)) {
    throw new Error(`Invalid email address: ${args.to}`);
  }

  const ctx = await resolveTransporter({ orgId: args.orgId, eventId: args.eventId });

  const scopeLabel = ctx.eventTitle
    ? `événement <strong>${escapeText(ctx.eventTitle)}</strong>`
    : ctx.orgName
      ? `organisation <strong>${escapeText(ctx.orgName)}</strong>`
      : "plateforme <strong>Badge</strong>";

  const body = `
    <p style="margin:0 0 16px;">Ceci est un email de test envoyé depuis Badge.</p>
    <p style="margin:0 0 16px;">Configuration testée : ${scopeLabel}.</p>
    <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Si vous recevez ce message, votre configuration SMTP est opérationnelle.</p>
    <p style="margin:0;color:#94a3b8;font-size:12px;">Expéditeur : ${escapeText(ctx.from)}</p>
  `;

  // sendSmtpTest est appele depuis les UI : on veut propager les erreurs au lieu de les avaler.
  await ctx.transporter.sendMail({
    from: ctx.from,
    to: args.to,
    subject: "Test SMTP — Badge",
    html: buildEmail({ title: "Test SMTP", body, ctx }),
  });
}
