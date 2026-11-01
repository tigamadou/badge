import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SubscriptionForm } from "@/components/staff/SubscriptionForm";
import { Icon } from "@/components/ui/Icon";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { PaymentHistory } from "@/components/admin/PaymentHistory";

export default async function OrgSubscriptionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, subscription: true },
  });
  if (!org) notFound();

  const [plans, payments, scheduledPlan] = await Promise.all([
    prisma.plan.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, period: true },
    }),
    prisma.payment.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        amount: true,
        status: true,
        fedapayReference: true,
        plan: { select: { name: true } },
      },
    }),
    org.subscription?.scheduledPlanId
      ? prisma.plan.findUnique({
          where: { id: org.subscription.scheduledPlanId },
          select: { name: true },
        })
      : null,
  ]);

  const sub = org.subscription;
  const current = sub
    ? {
        planId: sub.planId,
        status: sub.status,
        overrideMaxEvents: sub.overrideMaxEvents == null ? "" : String(sub.overrideMaxEvents),
        overrideMaxParticipantsPerEvent:
          sub.overrideMaxParticipantsPerEvent == null
            ? ""
            : String(sub.overrideMaxParticipantsPerEvent),
        endDate: sub.endDate?.toISOString() ?? null,
      }
    : null;

  return (
    <div className="space-y-4">
      <Link
        href="/platform/organizations"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <Icon name="arrow-left" size={16} /> Organisations
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Abonnement — {org.name}</h1>
        <p className="mt-0.5 text-sm text-slate-400">Assigner un plan et gérer le statut de l&apos;abonnement</p>
      </div>
      <SubscriptionForm
        orgId={org.id}
        plans={plans}
        current={current}
        scheduledPlanName={sub?.scheduledPlanId ? (scheduledPlan?.name ?? "—") : null}
      />
      <Card>
        <CardHead title="Historique des paiements" />
        <CardBody>
          <PaymentHistory payments={payments.map(({ plan, ...p }) => ({ ...p, planName: plan?.name ?? "—" }))} />
        </CardBody>
      </Card>
    </div>
  );
}
