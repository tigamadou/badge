import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { retryJob } from "@/lib/jobs/admin";

const ERRORS = {
  NOT_FOUND: { status: 404, error: "Job introuvable." },
  JOB_NOT_RETRYABLE: {
    status: 409,
    error: "Seul un email en échec ou annulé peut être relancé.",
  },
  JOB_PAYLOAD_PURGED: {
    status: 409,
    error: "Le contenu de cet email a été purgé : relance impossible.",
  },
} as const;

export const POST = withStaffAuth<{ jobId: string }>(
  async (req, { session }, { params }) => {
    const { jobId } = await params;
    const result = await retryJob(jobId);
    if (!result.ok) {
      const { status, error } = ERRORS[result.code as keyof typeof ERRORS];
      return NextResponse.json({ code: result.code, error }, { status });
    }
    await logActivity({
      type: "JOB_RETRIED",
      userId: session.user.id,
      targetId: jobId,
      details: { kind: result.job.kind },
      req,
    });
    return NextResponse.json({ job: result.job });
  },
  { minRole: "STAFF_ADMIN" },
);
