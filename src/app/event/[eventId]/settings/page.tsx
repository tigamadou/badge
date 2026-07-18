import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import { EventSettingsForm } from "@/components/event/EventSettingsForm";
import { getEventOrgId } from "@/lib/event-org";

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, location: true, date: true, slug: true, logo: true, registrationOpen: true },
  });
  if (!event) throw new Error("Event not found");
  const settings = await prisma.eventSettings.findUnique({ where: { eventId } });
  const resolved = await resolvePublicSettings(eventId);
  return (
    <EventSettingsForm
      orgId={orgId}
      eventId={eventId}
      initial={{
        event: { ...event, date: event.date.toISOString() },
        settings: {
          contactEmail: settings?.contactEmail ?? null,
          contactPhone: settings?.contactPhone ?? null,
        },
        resolved: {
          contactEmail: resolved.contactEmail,
          contactPhone: resolved.contactPhone,
        },
      }}
    />
  );
}
