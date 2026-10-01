import { NextResponse } from "next/server";
import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { rejectProfile, ProfileReviewError } from "@/lib/profile-review";
import { sendProfileRejected } from "@/lib/mail";

type Params = { userId: string };

const rejectSchema = z.object({
  reasonId: z.string().min(1),
  details: z.string().max(2000).optional(),
});

export const POST = withStaffAuth<Params>(
  async (req, { session }, extra) => {
    const { userId } = await extra.params;
    const parsed = rejectSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    try {
      const submission = await rejectProfile({
        userId,
        reviewerId: session.user.id,
        reasonId: parsed.data.reasonId,
        details: parsed.data.details,
      });
      await logActivity({
        type: "PROFILE_REJECTED",
        userId: session.user.id,
        targetId: userId,
        details: { reason: submission.rejectionReasonLabel, submissionId: submission.id },
        req,
      });
      sendProfileRejected(userId).catch((err) =>
        console.error("[mail] sendProfileRejected failed", err),
      );
      return NextResponse.json({ submission });
    } catch (err) {
      if (err instanceof ProfileReviewError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }
  },
  { minRole: "STAFF_SUPPORT" },
);
