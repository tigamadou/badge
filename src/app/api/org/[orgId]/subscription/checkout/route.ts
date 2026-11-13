import { NextResponse } from "next/server";
import { z } from "zod";
import { withOrgAuth } from "@/lib/with-org-auth";
import { loadMemberPermissions } from "@/lib/auth-guards";
import { PaymentError, startCheckout } from "@/lib/payments";

const schema = z.object({ planId: z.string().min(1) });

export const POST = withOrgAuth("billing.subscription.pay", async (req, { orgId, session }) => {
  // Côté organisateur uniquement : le rôle plateforme d'un staff ne paie pas l'abonnement.
  const memberPermissions = await loadMemberPermissions(session.user.id, { kind: "org", orgId });
  if (!memberPermissions.has("billing.subscription.pay")) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const { url } = await startCheckout({
      orgId,
      planId: parsed.data.planId,
      userId: session.user.id,
      req,
    });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json(
        {
          error: err.code,
          ...(err.detail && {
            activeUntil: err.detail.activeUntil?.toISOString() ?? null,
            renewableFrom: err.detail.renewableFrom?.toISOString() ?? null,
          }),
        },
        { status: err.httpStatus },
      );
    }
    throw err;
  }
});
