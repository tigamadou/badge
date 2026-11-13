import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listAvailableTemplates } from "@/lib/badge-templates/resolve";
import { resolveBadgeTemplateId } from "@/lib/settings";
import BadgeTemplatePicker, {
  type EffectiveLevel,
  type TemplateSummary,
} from "@/components/admin/BadgeTemplatePicker";
import { requireEventPagePermission } from "../../_lib/page-access";
import { findTemplateLock } from "@/lib/print-requests/template-lock-core";
import { EVENT_IMAGE_SELECT, evaluateEventImages } from "@/lib/event-image-compliance";
import { EventImageAlert } from "@/components/event/EventImageAlert";

export const dynamic = "force-dynamic";

export default async function EventBadgeSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { orgId } = await requireEventPagePermission(
    eventId,
    "event.settings.update",
    `/event/${eventId}/settings/badge`,
  );

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, ...EVENT_IMAGE_SELECT },
  });
  if (!event || event.orgId !== orgId) notFound();

  const [organization, platform] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { badgeTemplateId: true },
    }),
    prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: { badgeTemplateId: true },
    }),
  ]);

  const effectiveId = resolveBadgeTemplateId(
    { badgeTemplateId: event.badgeTemplateId },
    organization,
    platform ?? { badgeTemplateId: "" },
  );
  const effectiveLevel: EffectiveLevel = event.badgeTemplateId
    ? "event"
    : organization?.badgeTemplateId
      ? "org"
      : "platform";

  const templates: TemplateSummary[] = await listAvailableTemplates();
  const lock = await findTemplateLock(eventId);
  const imageIssues = await evaluateEventImages(event, { lenient: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Modèle de badge</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Modèle utilisé pour {event.title}. Vous pouvez aussi hériter du modèle de l&apos;organisation ou de la
          plateforme.
        </p>
      </div>

      <EventImageAlert eventId={eventId} issues={imageIssues} />

      <BadgeTemplatePicker
        templates={templates}
        currentValue={event.badgeTemplateId}
        effectiveId={effectiveId}
        effectiveLevel={effectiveLevel}
        patchUrl={`/api/org/${orgId}/events/${eventId}/settings/badge`}
        canClearToInherit
        lockedReason={
          lock
            ? `Le template est verrouillé : la commande d'impression ${lock.reference} a été payée. Il redeviendra modifiable quand elle sera terminée.`
            : undefined
        }
      />
    </div>
  );
}
