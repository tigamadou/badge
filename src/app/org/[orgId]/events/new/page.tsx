import { prisma } from "@/lib/prisma";
import { EventCreationWizard } from "@/components/admin/EventCreationWizard";
import { listAvailableTemplates } from "@/lib/badge-templates/resolve";
import { resolveBadgeTemplateId } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const [templates, badgeTemplates, organization, platform] = await Promise.all([
    prisma.categoryTemplate.findMany({
      where: { orgId },
      orderBy: [{ number: "asc" }],
      select: { id: true, name: true, color: true, number: true },
    }),
    listAvailableTemplates(),
    prisma.organization.findUnique({ where: { id: orgId }, select: { badgeTemplateId: true } }),
    prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { badgeTemplateId: true } }),
  ]);

  // Template que l'evenement recevra s'il n'en choisit pas : organisation, sinon plateforme.
  const inheritedId = resolveBadgeTemplateId(null, organization, platform ?? { badgeTemplateId: "" });
  const inherited =
    badgeTemplates.find((t) => t.id === inheritedId) ??
    (inheritedId
      ? await prisma.installedBadgeTemplate.findUnique({ where: { id: inheritedId }, select: { label: true } })
      : null);

  return (
    <EventCreationWizard
      orgId={orgId}
      templates={templates}
      badgeTemplates={badgeTemplates}
      inheritedBadgeLabel={inherited?.label ?? "modèle par défaut"}
    />
  );
}
