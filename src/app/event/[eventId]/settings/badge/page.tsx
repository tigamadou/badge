import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasEventPermission } from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";
import { listAvailableTemplates } from "@/lib/badge-templates/resolve";
import { resolveBadgeTemplateId } from "@/lib/settings";
import BadgeTemplatePicker, {
  type EffectiveLevel,
  type TemplateSummary,
} from "@/components/admin/BadgeTemplatePicker";
import { getEventOrgId } from "@/lib/event-org";

export const dynamic = "force-dynamic";

export default async function EventBadgeSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/event/${eventId}/settings/badge`);
  }
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, orgId: true, title: true, badgeTemplateId: true },
  });
  if (!event || event.orgId !== orgId) notFound();
  if (!hasEventPermission(ctx, eventId, orgId, "event.settings.update")) {
    redirect(`/event/${eventId}`);
  }

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
    platform ?? { badgeTemplateId: "default-v1" },
  );
  const effectiveLevel: EffectiveLevel = event.badgeTemplateId
    ? "event"
    : organization?.badgeTemplateId
      ? "org"
      : "platform";

  const templates: TemplateSummary[] = await listAvailableTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Modèle de badge</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Modèle utilisé pour {event.title}. Vous pouvez aussi hériter du modèle de l&apos;organisation ou de la
          plateforme.
        </p>
      </div>

      <BadgeTemplatePicker
        templates={templates}
        currentValue={event.badgeTemplateId}
        effectiveId={effectiveId}
        effectiveLevel={effectiveLevel}
        patchUrl={`/api/org/${orgId}/events/${eventId}/settings/badge`}
        canClearToInherit
      />
    </div>
  );
}
