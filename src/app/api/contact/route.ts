import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { resolveTransporter, buildEmail } from "@/lib/mail";
import { enqueueEmail, EMAIL_KIND } from "@/lib/jobs/enqueue-email";

export const runtime = "nodejs";

const schema = z.object({
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  email: z.string().trim().email(),
  organization: z.string().trim().max(200).optional(),
  subject: z.enum([
    "Demander une démo",
    "Question sur les tarifs",
    "Support technique",
    "Partenariat",
    "Autre",
  ]),
  message: z.string().trim().max(5000).optional(),
  consent: z.literal(true),
});

function escape(v: string): string {
  return v.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
}

export async function POST(req: Request) {
  const ip = extractClientIp(req.headers);
  const rl = checkRateLimit(ip, "contact", { max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans un instant." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Formulaire invalide.", code: "VALIDATION" }, { status: 400 });
  }
  const d = parsed.data;

  const name = [d.firstName, d.lastName].filter(Boolean).join(" ") || "—";
  const body = `
    <p style="margin:0 0 16px;">Nouvelle demande depuis le formulaire de contact public.</p>
    <table style="border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Sujet</td><td style="padding:4px 0;">${escape(d.subject)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Nom</td><td style="padding:4px 0;">${escape(name)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">E-mail</td><td style="padding:4px 0;">${escape(d.email)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Organisation</td><td style="padding:4px 0;">${escape(d.organization ?? "—")}</td></tr>
    </table>
    <p style="margin:16px 0 4px;color:#64748b;font-size:13px;">Message</p>
    <p style="margin:0;white-space:pre-wrap;">${escape(d.message ?? "—")}</p>
  `;

  // Résolu pour le branding et le destinataire (l'expéditeur plateforme) ; l'envoi passe par la file.
  const ctx = await resolveTransporter({});
  await enqueueEmail({
    to: ctx.from,
    replyTo: d.email,
    subject: `Contact — ${d.subject}`,
    html: buildEmail({ title: "Demande de contact", body, ctx }),
    kind: EMAIL_KIND.CONTACT_MESSAGE,
    ctx: {},
  });

  return NextResponse.json({ ok: true });
}
