import { prisma } from "@/lib/prisma";
import { BadgeVerifyView } from "@/components/public/BadgeVerifyView";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VerifyPage(
  { params }: { params: Promise<{ badgeId: string }> },
) {
  const { badgeId } = await params;
  const reg = await prisma.registration.findUnique({
    where: { id: badgeId },
    include: {
      category: { select: { name: true, color: true, anonymous: true } },
      event: { select: { title: true, date: true } },
    },
  });

  if (!reg) notFound();

  const valid = reg.status === "APPROVED" && reg.badgePrinted;
  const data = valid
    ? {
        valid: true as const,
        event: reg.event,
        category: reg.category,
        participant: reg.category.anonymous
          ? undefined
          : { firstName: reg.firstName, lastName: reg.lastName, structure: reg.structure },
      }
    : { valid: false as const, event: reg.event };

  return (
    <main className="mx-auto max-w-md p-6">
      <BadgeVerifyView data={data} />
    </main>
  );
}
