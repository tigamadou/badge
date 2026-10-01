import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { badgeRegistrationInclude, renderBadgePdf } from "@/lib/badge-templates/render-badge";
import { badgeFileName, parseBadgeIds, MAX_BADGES_PER_BATCH } from "@/lib/badge-batch";

export const runtime = "nodejs";

// Lot pour imprimante a badges : un PDF par badge, au format du template, dans un ZIP.
// Meme garde que le badge seul (badge.print, evenement archive permis). Tout est
// verifie avant le premier rendu ; un rendu en echec fait echouer toute l'archive
// (une archive incomplete passerait inapercue a l'impression).
export const GET = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (req, { eventId }) => {
    const ids = parseBadgeIds(req.nextUrl.searchParams.get("ids"));
    if (ids.length === 0 || ids.length > MAX_BADGES_PER_BATCH) {
      return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
    }

    const found = await prisma.registration.findMany({
      where: { id: { in: ids }, eventId },
      include: badgeRegistrationInclude,
    });
    const byId = new Map(found.map((r) => [r.id, r]));

    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return NextResponse.json({ error: "NOT_FOUND", ids: missing }, { status: 404 });
    }
    const registrations = ids.map((id) => byId.get(id)!);
    const notApproved = registrations.filter((r) => r.status !== "APPROVED").map((r) => r.id);
    if (notApproved.length > 0) {
      return NextResponse.json({ error: "NOT_APPROVED", ids: notApproved }, { status: 409 });
    }

    // Lu avant les rendus : un echec de lecture ne gaspille pas le travail de rendu.
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { slug: true } });
    const zip = new JSZip();
    for (const registration of registrations) {
      try {
        const { pdf } = await renderBadgePdf(registration);
        zip.file(badgeFileName(registration), pdf);
      } catch (err) {
        console.error(`[badges/print-zip] rendu en echec pour ${registration.id}`, err);
        return NextResponse.json({ error: "RENDER_FAILED", id: registration.id }, { status: 500 });
      }
    }
    const archive = await zip.generateAsync({ type: "uint8array" });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(archive), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="badges-${event.slug}-${day}.zip"`,
      },
    });
  },
);
