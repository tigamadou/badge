import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { pxToMm } from "@/lib/print-sheets/units";
import { LayoutManager, type LayoutRow, type TemplateOption } from "@/components/staff/print/LayoutManager";

export default async function PrintLayoutsPage() {
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const canWrite =
    !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN");

  const [layouts, templates] = await Promise.all([
    prisma.printSheetLayout.findMany({ where: { archived: false }, orderBy: { createdAt: "asc" } }),
    prisma.installedBadgeTemplate.findMany({
      where: { archived: false },
      orderBy: [{ label: "asc" }, { version: "desc" }],
      select: { id: true, label: true, pageWidthPx: true, pageHeightPx: true },
    }),
  ]);

  const rows: LayoutRow[] = layouts.map((l) => ({
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
  }));
  const options: TemplateOption[] = templates.map((t) => ({
    id: t.id,
    label: t.label,
    widthMm: pxToMm(t.pageWidthPx),
    heightMm: pxToMm(t.pageHeightPx),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Gabarits d&apos;impression</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Formats de planche, marges et espacements utilisés pour imprimer les badges
        </p>
      </div>
      <LayoutManager layouts={rows} templates={options} canWrite={canWrite} />
    </div>
  );
}
