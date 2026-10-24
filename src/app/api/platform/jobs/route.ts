import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { getJobCounts, listJobs, parseJobListFilters } from "@/lib/jobs/admin";

// Spec 23 : liste des jobs d'email (lecture pour tout le staff). Le payload n'est jamais renvoye.
export const GET = withStaffAuth(async (req) => {
  const parsed = parseJobListFilters(new URL(req.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ code: parsed.code, error: "Statut inconnu." }, { status: 400 });
  }
  const [list, counts] = await Promise.all([listJobs(parsed.filters), getJobCounts()]);
  return NextResponse.json({ ...list, counts });
});
