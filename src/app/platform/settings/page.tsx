import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listAvailableTemplates, templateImageUrl } from "@/lib/badge-templates/resolve";
import { getOnsitePrintSettings } from "@/lib/settings";
import { pxToMm } from "@/lib/print-sheets/units";
import { parseRights } from "@/lib/subscription-rights";
import { resolveSettingsTab, visibleSettingsTabs } from "@/lib/platform-settings-tabs";
import { PlatformSettingsForm } from "@/components/staff/PlatformSettingsForm";
import { TestSmtpForm } from "@/components/staff/TestSmtpForm";
import { RejectionReasonsManager } from "@/components/staff/RejectionReasonsManager";
import { OnsitePrintSettingsForm } from "@/components/staff/OnsitePrintSettingsForm";
import { SubscriptionRightsForm } from "@/components/staff/SubscriptionRightsForm";
import BadgeTemplatePicker from "@/components/admin/BadgeTemplatePicker";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { TabLinks } from "@/components/ui/TabLinks";

export const dynamic = "force-dynamic";

export default async function StaffSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  let s = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!s) {
    s = await prisma.platformSettings.create({ data: { id: "singleton" } });
  }

  const session = await getServerSession(authOptions);
  const me = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { staffRole: true } })
    : null;
  // Garde-fou ADR 2026-06-01 : les secrets (smtpPassword, recaptchaSecretKey) sont reserves SUPER_ADMIN.
  const canEditSecrets = me?.staffRole === "SUPER_ADMIN";
  // v4 (plan 08) : motifs de rejet, droits d'abonnement et template de badge sont reserves STAFF_ADMIN+.
  const isStaffAdmin = canEditSecrets || me?.staffRole === "STAFF_ADMIN";

  const tab = resolveSettingsTab((await searchParams).tab, isStaffAdmin);

  // Construction de la vue publique : on ne passe JAMAIS les valeurs secretes au
  // composant client. Les booleans *Set indiquent simplement leur presence.
  const safe = {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpFrom: s.smtpFrom,
    smtpUser: s.smtpUser,
    smtpSecure: s.smtpSecure,
    smtpPasswordSet: !!s.smtpPassword,
    recaptchaEnabled: s.recaptchaEnabled,
    recaptchaSiteKey: s.recaptchaSiteKey,
    recaptchaSecretKeySet: !!s.recaptchaSecretKey,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Paramètres plateforme</h1>
        <p className="mt-0.5 text-sm text-slate-400">Configuration globale de la plateforme</p>
      </div>
      <Alert tone="info">
        <Icon name="shield" size={16} /> Ces paramètres s&apos;appliquent à toute la plateforme et sont réservés au
        staff.
      </Alert>

      <TabLinks
        label="Sections des paramètres"
        value={tab}
        tabs={visibleSettingsTabs(isStaffAdmin).map((t) => ({
          value: t.value,
          label: t.label,
          href: `/platform/settings?tab=${t.value}`,
        }))}
      />

      {tab === "email" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="col-span-1">
            <PlatformSettingsForm section="smtp" initial={safe} canEditSecrets={canEditSecrets} />
          </div>
          <div className="col-span-1">
            <TestSmtpForm defaultEmail={session?.user?.email ?? undefined} />
          </div>
        </div>
      )}

      {tab === "security" && (
        <PlatformSettingsForm section="recaptcha" initial={safe} canEditSecrets={canEditSecrets} />
      )}

      {tab === "subscriptions" && (
        <Card>
          <CardHead
            title="Droits selon l'abonnement"
            subtitle="Ce qu'une organisation peut faire selon que son abonnement est actif ou non. Les quotas du plan s'appliquent en plus."
          />
          <CardBody>
            <SubscriptionRightsForm initial={parseRights(s.subscriptionRights)} canManage={isStaffAdmin} />
          </CardBody>
        </Card>
      )}

      {tab === "reasons" && (
        <Card>
          <CardHead
            title="Motifs de rejet"
            subtitle="Catalogue partagé par la validation des profils et le rejet des inscriptions"
          />
          <CardBody>
            <RejectionReasonsManager
              initial={await prisma.rejectionReason.findMany({
                where: { archived: false },
                orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
                select: { id: true, label: true, scope: true, sortOrder: true },
              })}
              canManage={isStaffAdmin}
            />
          </CardBody>
        </Card>
      )}

      {tab === "badge" && (
        <Card>
          <CardHead
            title="Template de badge par défaut"
            subtitle="Racine de la cascade : les organisations et les événements peuvent surcharger ce choix."
          />
          <CardBody>
            <BadgeTemplatePicker
              templates={await listAvailableTemplates()}
              currentValue={s.badgeTemplateId}
              effectiveId={s.badgeTemplateId}
              effectiveLevel="platform"
              patchUrl="/api/platform/settings/badge"
              canClearToInherit={false}
            />
          </CardBody>
        </Card>
      )}

      {tab === "onsite-print" && (
        <Card>
          <CardHead
            title="Impression sur place"
            subtitle="Templates que les organisations peuvent choisir pour imprimer leurs badges pendant l'évènement, et réglages par défaut du poste d'impression."
          />
          <CardBody>
            <OnsitePrintSettingsForm
              templates={(
                await prisma.installedBadgeTemplate.findMany({
                  where: { archived: false },
                  orderBy: [{ family: "asc" }, { version: "desc" }],
                })
              ).map((t) => ({
                id: t.id,
                label: t.label,
                version: t.version,
                widthMm: Math.round(pxToMm(t.pageWidthPx)),
                heightMm: Math.round(pxToMm(t.pageHeightPx)),
                previewSrc: templateImageUrl(t, "preview"),
              }))}
              initial={await getOnsitePrintSettings()}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
