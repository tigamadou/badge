import { prisma } from "@/lib/prisma";
import { CategoryTable } from "@/components/event/CategoryTable";
import { getEventOrgId } from "@/lib/event-org";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  const categories = await prisma.category.findMany({
    where: { eventId },
    orderBy: [{ number: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      number: true,
      neutralBadge: true,
      anonymous: true,
      _count: { select: { registrations: true } },
    },
  });
  return <CategoryTable orgId={orgId} eventId={eventId} initial={categories} />;
}
