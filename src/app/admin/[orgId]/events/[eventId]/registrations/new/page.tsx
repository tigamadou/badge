import { prisma } from "@/lib/prisma";
import { RegistrationForm } from "@/components/event/RegistrationForm";

export default async function NewRegistrationPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const categories = await prisma.category.findMany({
    where: { eventId },
    orderBy: { number: "asc" },
    select: { id: true, name: true, number: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvelle inscription</h1>
      <RegistrationForm orgId={orgId} eventId={eventId} categories={categories} />
    </div>
  );
}
