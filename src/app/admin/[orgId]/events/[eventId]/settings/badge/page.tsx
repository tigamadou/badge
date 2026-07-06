import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasEventPermission } from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";
import { listTemplates } from "@/lib/badge-templates";
import { resolveBadgeTemplateId } from "@/lib/settings";
import BadgeTemplatePicker, {
  type EffectiveLevel,
  type TemplateSummary,
} from "@/components/admin/BadgeTemplatePicker";

export const dynamic = "force-dynamic";

export default async function EventBadgeSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/admin/${orgId}/events/${eventId}/settings/badge`);
  }
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, orgId: true, title: true, badgeTemplateId: true },
  });
  if (!event || event.orgId !== orgId) notFound();
  if (!hasEventPermission(ctx, eventId, orgId, "event.settings.update")) {
    redirect(`/admin/${orgId}/events/${eventId}`);
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

  const templates: TemplateSummary[] = listTemplates().map((t) => ({
    id: t.meta.id,
    label: t.meta.label,
    description: t.meta.description,
    pages: t.meta.pages,
    pageSize: t.meta.pageSize,
    previewSrc: t.meta.previewSrc,
  }));

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
        patchUrl={`/api/admin/${orgId}/events/${eventId}/settings/badge`}
        canClearToInherit
      />
    </div>
  );
}
