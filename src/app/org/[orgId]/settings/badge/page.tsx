import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrgPagePermission } from "@/app/org/[orgId]/_lib/page-access";
import { listAvailableTemplates } from "@/lib/badge-templates/resolve";
import { resolveBadgeTemplateId } from "@/lib/settings";
import BadgeTemplatePicker, {
  type EffectiveLevel,
  type TemplateSummary,
} from "@/components/admin/BadgeTemplatePicker";

export const dynamic = "force-dynamic";

export default async function OrgBadgeSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgPagePermission(orgId, "org.badge_settings.update", `/org/${orgId}/settings/badge`);

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, badgeTemplateId: true },
  });
  if (!organization) notFound();

  const platform = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { badgeTemplateId: true },
  });

  const effectiveId = resolveBadgeTemplateId(
    null,
    { badgeTemplateId: organization.badgeTemplateId },
    platform ?? { badgeTemplateId: "" },
  );
  const effectiveLevel: EffectiveLevel = organization.badgeTemplateId
    ? "org"
    : "platform";

  const templates: TemplateSummary[] = await listAvailableTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Modèle de badge</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Modèle appliqué par défaut aux événements de {organization.name}. Chaque événement peut le surcharger.
        </p>
      </div>

      <BadgeTemplatePicker
        templates={templates}
        currentValue={organization.badgeTemplateId}
        effectiveId={effectiveId}
        effectiveLevel={effectiveLevel}
        patchUrl={`/api/org/${orgId}/settings/badge`}
        canClearToInherit
      />
    </div>
  );
}
