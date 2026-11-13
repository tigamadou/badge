import { withStaffAuth } from "@/lib/with-staff-auth";
import { listPrintItemsPage } from "@/lib/print-items-page";
import { guarded, json, loadStaffRequest } from "@/lib/print-requests/staff-api";

type Params = { requestId: string };

export const GET = withStaffAuth<Params>(async (req, _ctx, { params }) =>
  guarded(async () => {
    const { requestId } = await params;
    await loadStaffRequest(requestId);
    return json(await listPrintItemsPage(requestId, req.nextUrl.searchParams));
  }), { permission: "print.requests.read" });
