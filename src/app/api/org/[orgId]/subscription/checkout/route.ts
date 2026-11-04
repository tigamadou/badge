import { NextResponse } from "next/server";
import { z } from "zod";
import { withOrgAuth } from "@/lib/with-org-auth";
import { PaymentError, startCheckout } from "@/lib/payments";

const schema = z.object({ planId: z.string().min(1) });

export const POST = withOrgAuth("OWNER", async (req, { orgId, session }) => {
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
