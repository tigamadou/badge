import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { cancelJob } from "@/lib/jobs/admin";

const ERRORS = {
  NOT_FOUND: { status: 404, error: "Job introuvable." },
  JOB_NOT_CANCELLABLE: { status: 409, error: "Seul un email en attente peut être annulé." },
} as const;

export const POST = withStaffAuth<{ jobId: string }>(
  async (req, { session }, { params }) => {
    const { jobId } = await params;
    const result = await cancelJob(jobId);
    if (!result.ok) {
      const { status, error } = ERRORS[result.code as keyof typeof ERRORS];
      return NextResponse.json({ code: result.code, error }, { status });
    }
    await logActivity({
      type: "JOB_CANCELLED",
      userId: session.user.id,
      targetId: jobId,
      details: { kind: result.job.kind },
      req,
    });
    return NextResponse.json({ job: result.job });
  },
  { minRole: "STAFF_ADMIN" },
);
