import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { hasOrgRole } from "@/lib/auth-helpers";
import { resolveOrgLimits } from "@/lib/subscription";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { PlanCatalog } from "@/components/admin/PlanCatalog";
import { PaymentHistory } from "@/components/admin/PaymentHistory";

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function fmtLimit(v: number | null): string {
  return v == null ? "Illimité" : String(v);
}

export default async function OrgSubscriptionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/org/${orgId}/subscription`);
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  if (!hasOrgRole(ctx, orgId, "MANAGER")) redirect(`/org/${orgId}`);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      subscription: {
        select: {
          status: true,
          startDate: true,
          endDate: true,
          planId: true,
          scheduledPlanId: true,
          scheduledPlan: { select: { name: true } },
          plan: { select: { name: true, period: true, price: true } },
        },
      },
    },
  });
  if (!org) redirect("/select");

  const limits = await resolveOrgLimits(orgId);
  const sub = org.subscription;
  const canPay = hasOrgRole(ctx, orgId, "OWNER");

  const [catalog, payments] = await Promise.all([
    prisma.plan.findMany({
      where: { archived: false, price: { not: null } },
      orderBy: { price: "asc" },
      select: {
        id: true,
        name: true,
        period: true,
        price: true,
        maxEvents: true,
        maxParticipantsPerEvent: true,
      },
    }),
    prisma.payment.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        amount: true,
        status: true,
        fedapayReference: true,
        plan: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Abonnement</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Plan, limites et paiements de votre organisation
        </p>
      </div>

      {!limits.active && (
        <Alert tone="warn">
          <Icon name="alert-triangle" size={16} /> Votre abonnement n&apos;est pas actif. La création
          d&apos;événements et les inscriptions sont bloquées.{" "}
          <a href="mailto:contact@badge.app" className="font-medium underline">
            Contactez le support
          </a>
          .
        </Alert>
      )}

      <Card>
        <CardHead title="Détails" />
        <CardBody>
          <KeyValue
            items={[
              { label: "Plan", value: sub?.plan.name ?? "Aucun abonnement" },
              { label: "Statut", value: sub?.status ?? "—" },
              {
                label: "Période",
                value:
                  sub?.plan.period === "ANNUAL"
                    ? "Annuel (365 jours)"
                    : sub?.plan.period === "MONTHLY"
                      ? "Mensuel (30 jours)"
                      : "—",
              },
              { label: "Début", value: fmtDate(sub?.startDate ?? null) },
              { label: "Fin", value: sub?.endDate ? fmtDate(sub.endDate) : "Sans échéance" },
              { label: "Actif", value: limits.active ? "Oui" : "Non" },
              ...(sub?.scheduledPlanId
                ? [
                    {
                      label: "Changement programmé",
                      value: `${sub.scheduledPlan?.name ?? "—"} le ${fmtDate(sub.endDate)}`,
                    },
                  ]
                : []),
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Changer de plan" />
        <CardBody>
          <PlanCatalog
            orgId={orgId}
            plans={catalog.map((p) => ({ ...p, price: p.price as number }))}
            currentPlanId={sub?.planId ?? null}
            currentPrice={sub?.plan.price ?? 0}
            scheduledPlanId={sub?.scheduledPlanId ?? null}
            canPay={canPay}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Limites effectives" />
        <CardBody>
          <KeyValue
            items={[
              { label: "Événements", value: fmtLimit(limits.maxEvents) },
              { label: "Participants / événement", value: fmtLimit(limits.maxParticipantsPerEvent) },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Historique des paiements" />
        <CardBody>
          <PaymentHistory payments={payments.map(({ plan, ...p }) => ({ ...p, planName: plan.name }))} />
        </CardBody>
      </Card>
    </div>
  );
}
