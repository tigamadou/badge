import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

// =====================================================
//  PlatformSettings singleton (id = "singleton")
// =====================================================

type SettingsRecord = {
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
};

async function ensureSingleton(): Promise<SettingsRecord> {
  let s = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!s) {
    s = await prisma.platformSettings.create({ data: { id: "singleton" } });
  }
  return s;
}

// Vue publique : ne renvoie JAMAIS les valeurs secretes
// (smtpPassword, recaptchaSecretKey). Les booleans *Set indiquent simplement
// si une valeur non vide est enregistree.
function publicView(s: SettingsRecord) {
  return {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpFrom: s.smtpFrom,
    smtpUser: s.smtpUser,
    smtpSecure: s.smtpSecure,
    smtpPasswordSet: !!s.smtpPassword,
    recaptchaEnabled: s.recaptchaEnabled,
    recaptchaSiteKey: s.recaptchaSiteKey,
    recaptchaSecretKeySet: !!s.recaptchaSecretKey,
  };
}

export const GET = withStaffAuth(async () => {
  const s = await ensureSingleton();
  return NextResponse.json({ settings: publicView(s) });
});

// Schema strict : refuser tout champ inconnu (id, createdAt, etc.) pour eviter
// qu'un client legacy n'ecrive une cle non prevue.
const patchSchema = z
  .object({
    smtpHost: z.string().max(255).optional(),
    smtpPort: z.number().int().min(1).max(65535).optional(),
    smtpFrom: z.string().max(255).optional(),
    smtpUser: z.string().max(255).optional(),
    smtpPassword: z.string().max(255).optional(),
    smtpSecure: z.boolean().optional(),
    recaptchaEnabled: z.boolean().optional(),
    recaptchaSiteKey: z.string().max(255).optional(),
    recaptchaSecretKey: z.string().max(255).optional(),
  })
  .strict();

export const PATCH = withStaffAuth(
  async (req, { session }) => {
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
    }

    // ADR 2026-06-01 : seul SUPER_ADMIN peut ecrire smtpPassword / recaptchaSecretKey.
    // Une chaine vide est ignoree (preserve la valeur existante) -- pas de restriction.
    const writesSecret =
      (data.smtpPassword !== undefined && data.smtpPassword !== "") ||
      (data.recaptchaSecretKey !== undefined && data.recaptchaSecretKey !== "");
    if (writesSecret) {
      const me = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { staffRole: true },
      });
      if (me?.staffRole !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "FORBIDDEN_SECRET_CHANGE" },
          { status: 403 },
        );
      }
    }

    await ensureSingleton();

    // smtpPassword/recaptchaSecretKey : si non fourni dans le PATCH, on conserve
    // l'ancien (omis du payload prisma). Si fourni vide, on prend la valeur vide.
    const updateData: Prisma.PlatformSettingsUpdateInput = {};
    if (data.smtpHost !== undefined) updateData.smtpHost = data.smtpHost;
    if (data.smtpPort !== undefined) updateData.smtpPort = data.smtpPort;
    if (data.smtpFrom !== undefined) updateData.smtpFrom = data.smtpFrom;
    if (data.smtpUser !== undefined) updateData.smtpUser = data.smtpUser;
    if (data.smtpPassword !== undefined && data.smtpPassword !== "") {
      updateData.smtpPassword = data.smtpPassword;
    }
    if (data.smtpSecure !== undefined) updateData.smtpSecure = data.smtpSecure;
    if (data.recaptchaEnabled !== undefined) {
      updateData.recaptchaEnabled = data.recaptchaEnabled;
    }
    if (data.recaptchaSiteKey !== undefined) {
      updateData.recaptchaSiteKey = data.recaptchaSiteKey;
    }
    if (data.recaptchaSecretKey !== undefined && data.recaptchaSecretKey !== "") {
      updateData.recaptchaSecretKey = data.recaptchaSecretKey;
    }

    const updated = await prisma.platformSettings.update({
      where: { id: "singleton" },
      data: updateData,
    });

    // Audit : booleans *Changed pour les secrets (jamais la valeur en clair).
    const {
      smtpPassword,
      recaptchaSecretKey,
      ...nonSecretValues
    } = data;
    await logActivity({
      type: "PLATFORM_SETTINGS_UPDATED",
      userId: session.user.id,
      details: {
        changedFields: Object.keys(data),
        values: nonSecretValues,
        smtpPasswordChanged:
          smtpPassword !== undefined && smtpPassword !== "",
        recaptchaSecretKeyChanged:
          recaptchaSecretKey !== undefined && recaptchaSecretKey !== "",
      },
      req,
    });

    return NextResponse.json({ settings: publicView(updated) });
  },
  { minRole: "STAFF_ADMIN" },
);
