import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { GenerationsScreen } from "@/components/staff/print/GenerationsScreen";
import type { GenerationRow } from "@/components/staff/print/GenerationList";

export default async function PrintSheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ printRequestId?: string }>;
}) {
  const { printRequestId } = await searchParams;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  // L'observateur n'a pas accès à la génération (STAFF_SUPPORT minimum).
  if (!ctx || !ctx.isStaff || !ctx.staffRole || !staffRoleAtLeast(ctx.staffRole, "STAFF_SUPPORT")) {
    redirect("/platform");
  }

  // Demande à l'avance dont on génère les planches : préremplit le formulaire.
  const linked = printRequestId
    ? await prisma.printRequest.findFirst({
        where: { id: printRequestId, type: "ADVANCE" },
        select: {
          id: true,
          reference: true,
          status: true,
          orgId: true,
          eventId: true,
          items: { orderBy: { position: "asc" }, select: { registrationId: true } },
        },
      })
    : null;
  const generable = !!linked && ["PAID", "IN_PRODUCTION", "READY"].includes(linked.status);
  const printRequest = linked && generable
    ? {
        id: linked.id,
        reference: linked.reference,
        orgId: linked.orgId,
        eventId: linked.eventId,
        registrationIds: linked.items.map((i) => i.registrationId),
      }
    : undefined;

  const [layouts, generations] = await Promise.all([
    prisma.printSheetLayout.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sheetWidth: true,
        sheetHeight: true,
        sheetOrientation: true,
        marginTop: true,
        marginRight: true,
        marginBottom: true,
        marginLeft: true,
        gapHorizontal: true,
        gapVertical: true,
        badgeOrientation: true,
        duplexFlip: true,
        cropMarks: true,
      },
    }),
    prisma.printSheetGeneration.findMany({
      where: { output: "SHEETS" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        duplex: true,
        badgeCount: true,
        sheetCount: true,
        skippedIds: true,
        error: true,
        createdAt: true,
        event: { select: { id: true, title: true } },
        layout: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  const initial = generations.map((g) => ({
    ...g,
    createdAt: g.createdAt.toISOString(),
  })) as GenerationRow[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Planches d&apos;impression</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Génération des badges en planches PDF prêtes à imprimer, et historique
        </p>
      </div>
      {linked && !generable && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Les planches ne peuvent être générées que pour une demande payée, en production ou prête.
        </p>
      )}
      <GenerationsScreen layouts={layouts} initial={initial} printRequest={printRequest} />
    </div>
  );
}
