import { processBatch, type BatchSummary } from "@/lib/jobs/process-batch";
import type { Job, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { __mailTesting, type ResolvedTransport, type TransportContext } from "@/lib/mail";

export type SentMail = { from: string; to: string; subject: string; html: string; replyTo?: string };

export const FAKE_FROM = "Badge <noreply@badge.test>";

// Transporteur factice : enregistre les envois, peut echouer ou ne jamais repondre.
export function fakeTransport(
  opts: {
    fail?: Error | ((n: number) => Error | null);
    hang?: boolean;
    onSend?: (mail: SentMail) => Promise<void>;
    onResolve?: (ctx: TransportContext) => void;
  } = {},
) {
  const sent: SentMail[] = [];
  let calls = 0;
  return {
    sent,
    install() {
      __mailTesting.setResolveTransporter(async (ctx) => {
        opts.onResolve?.(ctx);
        return {
          from: FAKE_FROM,
          transporter: {
            sendMail: async (mail: SentMail) => {
              calls += 1;
              if (opts.hang) return new Promise(() => {});
              await opts.onSend?.(mail);
              const failure = typeof opts.fail === "function" ? opts.fail(calls) : opts.fail;
              if (failure) throw failure;
              sent.push(mail);
              return { messageId: `m${calls}` };
            },
          },
        } as unknown as ResolvedTransport;
      });
    },
  };
}

export async function createEmailJob(
  overrides: Partial<Prisma.JobUncheckedCreateInput> & { html?: string; to?: string } = {},
): Promise<Job> {
  const { html = "<p>Bonjour</p>", to = "dest@x.test", ...rest } = overrides;
  const kind = (rest.kind as string | undefined) ?? "registration.approved";
  return prisma.job.create({
    data: {
      type: "EMAIL",
      kind,
      recipient: to,
      payload: { to, subject: "Sujet", html, kind },
      ...rest,
    },
  });
}

export async function drainEmailQueue(opts: { now?: Date } = {}): Promise<BatchSummary> {
  return processBatch({ workerId: "test", limit: 100, now: opts.now });
}
