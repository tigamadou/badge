import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { getJobDetail } from "@/lib/jobs/admin";

export const GET = withStaffAuth<{ jobId: string }>(async (_req, _ctx, { params }) => {
  const { jobId } = await params;
  const job = await getJobDetail(jobId);
  if (!job) return NextResponse.json({ code: "NOT_FOUND", error: "Job introuvable." }, { status: 404 });
  return NextResponse.json({ job });
}, { permission: "email_jobs.read" });
