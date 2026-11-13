import { NextResponse } from "next/server";
import { withEventAuth } from "@/lib/with-event-auth";
import {
  badgeRenderFailure,
  loadBadgeRegistration,
  renderBadgeHtml,
  renderBadgePdf,
} from "@/lib/badge-templates/render-badge";
import { badgeFileName } from "@/lib/badge-batch";
import { evaluateEventImages } from "@/lib/event-image-compliance";

export const runtime = "nodejs";

type Params = { orgId: string; eventId: string; badgeId: string };

// Garde par la permission `badge.print`. Aucun controle de statut :
// l'apercu reste permis pour toute inscription de l'evenement (seul le marquage
// "imprime" exige une inscription approuvee).
//
// PDF par defaut ; `?format=html` renvoie le document FIGE en JSON, pour <page-view>
// (jamais un document vivant : il executerait son script dans la page).
export const GET = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (req, { eventId }, extra) => {
    const { badgeId } = (await extra.params) as Params;

    const format = req.nextUrl.searchParams.get("format");
    if (format !== null && format !== "html") {
      return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
    }

    const registration = await loadBadgeRegistration(badgeId);
    if (!registration || registration.eventId !== eventId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    try {
      if (format === "html") {
        const { document, templateId } = await renderBadgeHtml(registration);
        const headers: Record<string, string> = { "cache-control": "private, no-store", "x-template-id": templateId };
        // L'apercu n'est jamais bloque, mais signale les images a recadrer.
        const issues = await evaluateEventImages(registration.event, { lenient: true });
        if (issues.length > 0) {
          headers["x-event-images"] = "noncompliant";
          headers["x-event-images-slots"] = issues.map((i) => i.slot).join(",");
        }
        return NextResponse.json(document, { headers });
      }
      const { pdf, templateId } = await renderBadgePdf(registration);
      const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `${disposition}; filename="${badgeFileName(registration)}"`,
          "x-template-id": templateId,
        },
      });
    } catch (err) {
      return badgeRenderFailure(err, registration.id, "badges/[badgeId]");
    }
  },
);
