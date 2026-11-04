import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui/Icon";
import { resolvePublicSettings } from "@/lib/settings";
import { EventSettingsForm } from "@/components/event/EventSettingsForm";
import { getEventOrgId } from "@/lib/event-org";
import { readSecurityInstructions } from "@/lib/security-instructions";
import { resolveEventTemplateVariables } from "@/lib/badge-templates/event-template-variables";
import { optionVariables, readTemplateOptions, effectiveOption } from "@/lib/badge-templates/template-options";
import { evaluateEventImages, getEventImageRequirements } from "@/lib/event-image-compliance";

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
      logoOriginal: true,
      bannerOriginal: true,
      logoWidth: true,
      logoHeight: true,
      bannerWidth: true,
      bannerHeight: true,
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
  const [imageRequirements, issues] = await Promise.all([
    getEventImageRequirements(event),
    evaluateEventImages(event),
  ]);
  const imageIssues = Object.fromEntries(
    issues.map((i) => [i.slot, `À recadrer : ${i.message.charAt(0).toLowerCase()}${i.message.slice(1)}`]),
  );
  return (
    <div className="space-y-4">
      <Link
        href={`/event/${eventId}/settings/badge`}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-green-500 hover:text-green-700"
      >
        <Icon name="id-card" size={16} /> Modèle de badge de l&apos;événement
      </Link>
      <EventSettingsForm
        orgId={orgId}
        eventId={eventId}
        imageRequirements={imageRequirements}
        imageIssues={imageIssues}
        initial={{
          event: {
            id: event.id,
            title: event.title,
            location: event.location,
            description: event.description,
            slug: event.slug,
            logo: event.logo,
            banner: event.banner,
            logoOriginal: event.logoOriginal,
            bannerOriginal: event.bannerOriginal,
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
    </div>
  );
}
