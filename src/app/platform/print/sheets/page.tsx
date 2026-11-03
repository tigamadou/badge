import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LinkedOrderSheet } from "@/components/staff/print/sheets/LinkedOrderSheet";
import { loadLayoutOptions, requireSheetsStaff } from "./sheets-data";

export default async function PrintSheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ printRequestId?: string }>;
}) {
  const { printRequestId } = await searchParams;
  // Sans commande ciblée : la file « À traiter » est l'écran d'accueil.
  if (!printRequestId) redirect("/platform/print/sheets/pending");
  await requireSheetsStaff();

  // Lien « Générer les planches » d'une commande : formulaire prérempli avec ses badges.
  const linked = await prisma.printRequest.findFirst({
    where: { id: printRequestId, type: "ADVANCE" },
    select: {
      id: true,
      reference: true,
      status: true,
      orgId: true,
      eventId: true,
      items: { orderBy: { position: "asc" }, select: { registrationId: true } },
    },
  });
  const generable = !!linked && ["PAID", "IN_PRODUCTION", "READY"].includes(linked.status);
  const printRequest =
    linked && generable
      ? {
          id: linked.id,
          reference: linked.reference,
          orgId: linked.orgId,
          eventId: linked.eventId,
          registrationIds: linked.items.map((i) => i.registrationId),
        }
      : undefined;

  return (
    <>
      {!generable && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Les planches ne peuvent être générées que pour une commande payée, en production ou prête.
        </p>
      )}
      {printRequest && <LinkedOrderSheet layouts={await loadLayoutOptions()} printRequest={printRequest} />}
    </>
  );
}
