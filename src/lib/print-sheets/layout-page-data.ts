import type { PrintSheetLayout } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { pxToMm } from "@/lib/print-sheets/units";
import type { LayoutRow, TemplateOption } from "@/components/staff/print/layout-form";

// Donnees communes aux pages des gabarits d'impression (liste, creation, edition).
export async function canWriteLayouts(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  return !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN");
}

export async function loadTemplateOptions(): Promise<TemplateOption[]> {
  const templates = await prisma.installedBadgeTemplate.findMany({
    where: { archived: false },
    orderBy: [{ label: "asc" }, { version: "desc" }],
    select: { id: true, label: true, pages: true, pageWidthPx: true, pageHeightPx: true },
  });
  return templates.map((t) => ({
    id: t.id,
    label: t.label,
    pages: t.pages,
    widthMm: pxToMm(t.pageWidthPx),
    heightMm: pxToMm(t.pageHeightPx),
  }));
}

export function toLayoutRow(l: PrintSheetLayout): LayoutRow {
  return {
    id: l.id,
    name: l.name,
    sheetWidth: l.sheetWidth,
    sheetHeight: l.sheetHeight,
    sheetOrientation: l.sheetOrientation,
    marginTop: l.marginTop,
    marginRight: l.marginRight,
    marginBottom: l.marginBottom,
    marginLeft: l.marginLeft,
    gapHorizontal: l.gapHorizontal,
    gapVertical: l.gapVertical,
    badgeOrientation: l.badgeOrientation,
    duplexFlip: l.duplexFlip,
    cropMarks: l.cropMarks,
  };
}
