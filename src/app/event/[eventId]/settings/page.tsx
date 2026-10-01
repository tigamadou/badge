import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import { EventSettingsForm } from "@/components/event/EventSettingsForm";
import { getEventOrgId } from "@/lib/event-org";
import { readSecurityInstructions } from "@/lib/security-instructions";
import { resolveEventTemplateVariables } from "@/lib/badge-templates/event-template-variables";
import { optionVariables, readTemplateOptions, effectiveOption } from "@/lib/badge-templates/template-options";

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      location: true,
      date: true,
      endDate: true,
      description: true,
      slug: true,
      logo: true,
      banner: true,
      templateOptions: true,
      badgeTemplateId: true,
      orgId: true,
      securityInstructions: true,
      registrationOpen: true,
    },
  });
  if (!event) throw new Error("Event not found");
  const settings = await prisma.eventSettings.findUnique({ where: { eventId } });
  const resolved = await resolvePublicSettings(eventId);
  const template = await resolveEventTemplateVariables(event);
  const variables = optionVariables(template.variables, template.bindings);
  const options = variables.map(({ name, kind, label, sample }) => ({ name, kind, label, sample }));
  const stored = readTemplateOptions(event.templateOptions);
  const optionValues = Object.fromEntries(
    variables.map((variable) => [variable.name, effectiveOption(variable, stored) ?? null]),
  );
  return (
    <EventSettingsForm
      orgId={orgId}
      eventId={eventId}
      initial={{
        event: {
          id: event.id,
          title: event.title,
          location: event.location,
          description: event.description,
          slug: event.slug,
          logo: event.logo,
          banner: event.banner,
          registrationOpen: event.registrationOpen,
          securityInstructions: readSecurityInstructions(event.securityInstructions),
          date: event.date.toISOString(),
          endDate: event.endDate ? event.endDate.toISOString() : null,
        },
        settings: {
          contactEmail: settings?.contactEmail ?? null,
          contactPhone: settings?.contactPhone ?? null,
        },
        resolved: {
          contactEmail: resolved.contactEmail,
          contactPhone: resolved.contactPhone,
        },
        options,
        optionValues,
        storedOptions: stored,
      }}
    />
  );
}
