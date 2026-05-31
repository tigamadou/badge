import { NextResponse } from "next/server";
import { z } from "zod";

import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { sendSmtpTest } from "@/lib/mail";

const bodySchema = z
  .object({
    to: z.string().email().optional(),
  })
  .strict();

export const POST = withStaffAuth(
  async (req, { session }) => {
    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    // Si le body ne specifie pas `to`, on envoie au staff connecte.
    const to = parsed.data.to ?? session.user.email;
    if (!to) {
      return NextResponse.json({ error: "NO_EMAIL_PROVIDED" }, { status: 400 });
    }

    try {
      await sendSmtpTest({ to });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown";
      await logActivity({
        type: "PLATFORM_SETTINGS_UPDATED",
        userId: session.user.id,
        details: { action: "test-smtp", to, ok: false, message },
        req,
      });
      // Email invalide -> 400, autre erreur SMTP -> 500.
      if (message.toLowerCase().includes("invalid email")) {
        return NextResponse.json(
          { error: "INVALID_EMAIL", message },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "SMTP_TEST_FAILED", message },
        { status: 500 },
      );
    }

    await logActivity({
      type: "PLATFORM_SETTINGS_UPDATED",
      userId: session.user.id,
      details: { action: "test-smtp", to, ok: true },
      req,
    });
    return NextResponse.json({ ok: true, to });
  },
  { minRole: "STAFF_ADMIN" },
);
