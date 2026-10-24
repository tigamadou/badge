import type { Prisma } from "@prisma/client";
import type { TransportContext } from "@/lib/mail";

export type EmailJobPayload = {
  to: string;
  subject: string;
  html: string;
  kind: string;
  replyTo?: string;
  ctx?: TransportContext;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// null = payload illisible (le job part directement en FAILED). `html` vide est valide : payload purge.
export function parseEmailPayload(value: Prisma.JsonValue): EmailJobPayload | null {
  if (!isObject(value)) return null;
  const { to, subject, html, kind, replyTo, ctx } = value;
  if (typeof to !== "string" || typeof subject !== "string" || typeof html !== "string") {
    return null;
  }
  return {
    to,
    subject,
    html,
    kind: typeof kind === "string" ? kind : "",
    ...(typeof replyTo === "string" ? { replyTo } : {}),
    ...(isObject(ctx) ? { ctx: ctx as TransportContext } : {}),
  };
}
