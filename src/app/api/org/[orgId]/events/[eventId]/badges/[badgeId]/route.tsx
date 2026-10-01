import { NextResponse } from "next/server";
import { withEventAuth } from "@/lib/with-event-auth";
import { loadBadgeRegistration, renderBadgePdf } from "@/lib/badge-templates/render-badge";
import { badgeFileName } from "@/lib/badge-batch";

export const runtime = "nodejs";

type Params = { orgId: string; eventId: string; badgeId: string };

// Garde par la permission atomique `badge.print` (cf. matrice multi-tenancy-rbac.md) :
// la hierarchie minRole ne satisfait jamais un PRINTER pur. Aucun controle de statut :
// l'apercu reste permis pour toute inscription de l'evenement (seul le marquage
// "imprime" exige une inscription approuvee).
export const GET = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (req, { eventId }, extra) => {
    const { badgeId } = (await extra.params) as Params;

    const registration = await loadBadgeRegistration(badgeId);
    if (!registration || registration.eventId !== eventId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    let rendered: Awaited<ReturnType<typeof renderBadgePdf>>;
    try {
      rendered = await renderBadgePdf(registration);
    } catch (err) {
      console.error(`[badges/[badgeId]] rendu en echec pour ${registration.id}`, err);
      return NextResponse.json({ error: "RENDER_FAILED", id: registration.id }, { status: 500 });
    }
    const { pdf, templateId } = rendered;
    const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${disposition}; filename="${badgeFileName(registration)}"`,
        "x-template-id": templateId,
      },
    });
  },
);
