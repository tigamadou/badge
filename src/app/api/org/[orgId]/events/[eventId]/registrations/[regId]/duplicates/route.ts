import { NextResponse } from "next/server";
import { withEventAuth } from "@/lib/with-event-auth";
import { findDuplicatesForRegistration } from "@/lib/duplicates";

type Params = { orgId: string; eventId: string; regId: string };

export const GET = withEventAuth({ permission: "registration.block", allowArchived: true }, async (_req, _ctx, extra) => {
  const { regId } = (await extra.params) as Params;
  const duplicates = await findDuplicatesForRegistration(regId);
  return NextResponse.json({ duplicates });
});
