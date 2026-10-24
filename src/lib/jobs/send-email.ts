import { resolveTransporter } from "@/lib/mail";
import { SEND_TIMEOUT_MS } from "./constants";
import type { EmailJobPayload } from "./email-payload";

// Contrairement a safeSend de mail.ts, l'erreur est propagee : le worker decide du retry.
export async function sendEmailPayload(
  payload: EmailJobPayload,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? SEND_TIMEOUT_MS;
  const t = await resolveTransporter(payload.ctx ?? {});
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`SEND_TIMEOUT after ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    await Promise.race([
      t.transporter.sendMail({
        from: t.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
