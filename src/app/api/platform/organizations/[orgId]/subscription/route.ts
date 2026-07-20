import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { computeSubscriptionDates } from "@/lib/subscription";

// La periode est portee par le PLAN : elle pilote les dates de l'abonnement
// (startDate = maintenant, endDate = +30j / +365j selon plan.period). Le staff
// choisit un plan (donc une periode) ; il ne saisit ni periode ni dates ici.
const upsertSchema = z.object({
  planId: z.string().min(1),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]),
  overrideMaxEvents: z.number().int().min(0).nullable().optional(),
  overrideMaxParticipantsPerEvent: z.number().int().min(0).nullable().optional(),
});

export const PUT = withStaffAuth<{ orgId: string }>(
  async (req, { session }, { params }) => {
    const { orgId } = await params;
    const body = await req.json().catch(() => null);
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) {
      return NextResponse.json({ error: "ORG_NOT_FOUND" }, { status: 404 });
    }
    const plan = await prisma.plan.findUnique({
      where: { id: data.planId },
      select: { id: true, period: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });
    }

    const existing = await prisma.subscription.findUnique({ where: { orgId } });
    // Les dates derivent de la periode du plan choisi.
    const { startDate, endDate } = computeSubscriptionDates(plan.period);
    const values = {
      planId: data.planId,
      status: data.status,
      startDate,
      endDate,
      overrideMaxEvents: data.overrideMaxEvents ?? null,
      overrideMaxParticipantsPerEvent: data.overrideMaxParticipantsPerEvent ?? null,
    };

    const subscription = await prisma.subscription.upsert({
      where: { orgId },
      create: { orgId, ...values },
      update: values,
    });

    await logActivity({
      type: existing ? "SUBSCRIPTION_UPDATED" : "SUBSCRIPTION_CREATED",
      userId: session.user.id,
      orgId,
      targetId: subscription.id,
      details: { planId: subscription.planId, status: subscription.status },
      req,
    });

    return NextResponse.json({ subscription });
  },
  { minRole: "STAFF_ADMIN" },
);
