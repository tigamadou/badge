import { prisma } from "@/lib/prisma";
import { EventCreationWizard } from "@/components/admin/EventCreationWizard";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const templates = await prisma.categoryTemplate.findMany({
    where: { orgId },
    orderBy: [{ number: "asc" }],
    select: { id: true, name: true, color: true, number: true },
  });
  return <EventCreationWizard orgId={orgId} templates={templates} />;
}
