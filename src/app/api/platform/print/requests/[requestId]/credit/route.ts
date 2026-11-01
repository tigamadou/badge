import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
import { applyCreditSchema, applyOrgCredit, getAvailableOrgPrintCredit } from "@/lib/print-requests/org-credit";
import { guarded, json, lineDTO, loadStaffRequest, parseBody } from "@/lib/print-requests/staff-api";

// Applique du crédit d'impression de l'organisation au devis (remplace l'application précédente).
export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const request = await loadStaffRequest(requestId);
      const { amount } = await parseBody(req, applyCreditSchema);
      const userId = session.user.id;
      const { line, revised } = await applyOrgCredit({ requestId, amount, userId });
      await logActivity({
        type: "PRINT_CREDIT_APPLIED",
        userId,
        orgId: request.orgId,
        eventId: request.eventId,
        targetId: requestId,
        details: { amount },
        req,
      });
      if (revised) await notifyPrintRequestStatusChanged(requestId, userId, { organizer: true, staff: false });
      return json({ line: lineDTO(line), available: await getAvailableOrgPrintCredit(request.orgId) }, 201);
    }),
  { minRole: "STAFF_ADMIN" },
);
