import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { getOnsitePrintSettings } from "@/lib/settings";

// Plan 35 : templates proposes pour l'impression sur place, note de l'imprimante et
// marge par defaut. Reserve a STAFF_ADMIN.
const bodySchema = z.object({
  templateIds: z.array(z.string().min(1).max(64)).max(100),
  printerNote: z.string().max(500).nullable(),
  defaultMarginPercent: z.number().int().min(0).max(100),
});

export const PATCH = withStaffAuth(
  async (req, { session }) => {
    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    const { defaultMarginPercent } = parsed.data;
    // Note vide ou blanche : aucune note.
    const printerNote = parsed.data.printerNote?.trim() || null;
    const templateIds = [...new Set(parsed.data.templateIds)];

    // Seuls les NOUVEAUX ids doivent être non archivés : un template archivé depuis son ajout reste
    // dans la liste enregistrée et ne doit pas empêcher d'enregistrer le reste des réglages.
    const saved = (await getOnsitePrintSettings()).templateIds;
    const known = await prisma.installedBadgeTemplate.count({
      where: { id: { in: templateIds }, OR: [{ archived: false }, { id: { in: saved } }] },
    });
    if (known !== templateIds.length) {
      return NextResponse.json({ error: "UNKNOWN_TEMPLATE" }, { status: 400 });
    }

    const data = {
      onsitePrintTemplateIds: templateIds,
      onsitePrinterNote: printerNote,
      onsiteDefaultMarginPercent: defaultMarginPercent,
    };
    await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });

    await logActivity({
      type: "PLATFORM_SETTINGS_UPDATED",
      userId: session.user.id,
      details: { section: "onsite-print", templateCount: templateIds.length, defaultMarginPercent },
      req,
    });

    return NextResponse.json({ settings: await getOnsitePrintSettings() });
  },
  { permission: "settings.onsite_print.update" },
);
