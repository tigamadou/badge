import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { approveProfile, ProfileReviewError } from "@/lib/profile-review";
import { sendProfileApproved } from "@/lib/mail";
import { notifyProfileDecision } from "@/lib/notifications/triggers";

type Params = { userId: string };

export const POST = withStaffAuth<Params>(
  async (req, { session }, extra) => {
    const { userId } = await extra.params;
    try {
      const submission = await approveProfile({ userId, reviewerId: session.user.id });
      await logActivity({
        type: "PROFILE_APPROVED",
        userId: session.user.id,
        targetId: userId,
        details: { submissionId: submission.id },
        req,
      });
      await notifyProfileDecision(userId, session.user.id, "APPROVED");
      sendProfileApproved(userId).catch((err) =>
        console.error("[mail] sendProfileApproved failed", err),
      );
      return NextResponse.json({ submission });
    } catch (err) {
      if (err instanceof ProfileReviewError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }
  },
  { permission: "profiles.review" },
);
