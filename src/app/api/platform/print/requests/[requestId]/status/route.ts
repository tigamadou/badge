import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestQuoted, notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { advanceStatus } from "@/lib/print-requests/quote";
import { loadUserContext } from "@/lib/user-context";
import { guarded, json, loadStaffRequest, parseBody, requestDTO } from "@/lib/print-requests/staff-api";

const bodySchema = z.object({ to: z.enum(["IN_PRODUCTION", "READY", "COMPLETED"]) });

// Les suites d'une action déjà validée (journal, notification) ne doivent jamais la transformer en
// erreur : chacune a son propre try/catch, un échec n'empêche pas les suivantes.
async function afterCommit(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (e) {
    console.error(`[print-request] ${label} failed`, e);
  }
}

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const target = await loadStaffRequest(requestId);
      const { to } = await parseBody(req, bodySchema);
      const userId = session.user.id;
      // Clore une demande sur place verse un crédit ou crée une facture : STAFF_ADMIN au moins.
      // `withStaffAuth` garantit un compte staff : le contexte et son rôle existent.
      if (to === "COMPLETED" && target.type === "ONSITE") {
        const ctx = (await loadUserContext(userId))!;
        if (!staffRoleAtLeast(ctx.staffRole!, "STAFF_ADMIN")) throw new PrintRequestError("STAFF_FORBIDDEN", 403);
      }
      const { previousStatus, closure, ...request } = await advanceStatus({ requestId, userId, to });
      await afterCommit("PRINT_REQUEST_STATUS_CHANGED log", () =>
        logActivity({
          type: "PRINT_REQUEST_STATUS_CHANGED",
          userId,
          orgId: request.orgId,
          eventId: request.eventId,
          targetId: requestId,
          details: { from: previousStatus, to },
          req,
        }),
      );
      await afterCommit("status notification", () =>
        notifyPrintRequestStatusChanged(requestId, userId, { organizer: true, staff: false }),
      );
      // La clôture d'une demande sur place a eu lieu dans la transaction : on journalise et on
      // notifie ici, après elle (un échec de notification ne doit pas la défaire).
      if (closure?.outcome === "CREDIT") {
        await afterCommit("PRINT_CREDIT_EARNED log", () =>
          logActivity({
            type: "PRINT_CREDIT_EARNED",
            userId,
            orgId: request.orgId,
            eventId: request.eventId,
            targetId: requestId,
            details: { amount: closure.amount, unusedBadges: closure.unusedBadges },
            req,
          }),
        );
      }
      if (closure?.outcome === "SUPPLEMENT") {
        await afterCommit("PRINT_REQUEST_SUPPLEMENT_CREATED log", () =>
          logActivity({
            type: "PRINT_REQUEST_SUPPLEMENT_CREATED",
            userId,
            orgId: request.orgId,
            eventId: request.eventId,
            targetId: closure.supplementRequestId,
            details: { parentRequestId: requestId, extraBadges: closure.extraBadges, total: closure.total },
            req,
          }),
        );
        await afterCommit("supplement quote notification", () =>
          notifyPrintRequestQuoted(closure.supplementRequestId, userId),
        );
      }
      return json({ request: requestDTO(request), closure });
    }),
  { minRole: "STAFF_SUPPORT" },
);
