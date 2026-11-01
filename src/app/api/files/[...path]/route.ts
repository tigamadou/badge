import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { hasEventPermission, staffRoleAtLeast } from "@/lib/auth-helpers";
import { getFile } from "@/lib/storage";

// v4 Task 5.3 : les documents d'identite ne doivent JAMAIS etre servis publiquement.
// Cles sensibles : `profile/{userId}/documents/...` (compte participant) et
// `events/{eventId}/idDocuments/...` (piece jointe a une inscription). Les photos et
// logos restent publics (ils apparaissent sur les badges / pages publiques).
// Les planches d'impression (`print-sheets/...`) contiennent des donnees de
// participants : lisibles par le staff STAFF_SUPPORT minimum uniquement.
// Les pieces jointes de demandes d'impression (`print-requests/...`) sont lisibles par tout le
// staff, STAFF_OBSERVER compris. Les detenteurs de `print.request` lisent les fichiers de leur
// evenement : `print-requests/{eventId}/...` directement, `print-requests/staff/...` via l'evenement
// du message qui porte la piece jointe (classe `printRequest`). Aucune ligne : staff seulement.
// Les archives ZIP d'export (`badge-exports/{eventId}/...`) contiennent des badges nominatifs :
// lisibles par le staff et par les titulaires de `badge.print` sur l'evenement.
// Union discriminee : un fichier sensible est TOUJOURS soit un document de profil
// (profileUserId), soit un document d'evenement (eventId). Le type garantit qu'un
// des deux est present quand sensitive vaut true.
type SensitiveFile =
  | { sensitive: true; profileUserId: string; eventId?: undefined }
  | { sensitive: true; eventId: string; profileUserId?: undefined }
  | { sensitive: true; staffOnly: true; eventId?: undefined; profileUserId?: undefined }
  | { sensitive: true; printRequestScope: string; eventId?: undefined; profileUserId?: undefined }
  | { sensitive: true; staffAny: true; eventId?: undefined; profileUserId?: undefined }
  | { sensitive: true; printEventId: string; eventId?: undefined; profileUserId?: undefined };
type FileClass = { sensitive: false } | SensitiveFile;

function classify(key: string): FileClass {
  if (key.startsWith("print-sheets/")) return { sensitive: true, staffOnly: true };
  const printRequest = key.match(/^print-requests\/([^/]+)\//);
  if (printRequest) return { sensitive: true, printRequestScope: printRequest[1] };
  if (key.startsWith("print-requests/")) return { sensitive: true, staffAny: true };
  const exportFile = key.match(/^badge-exports\/([^/]+)\//);
  if (exportFile) return { sensitive: true, printEventId: exportFile[1] };
  const profileDoc = key.match(/^profile\/([^/]+)\/documents\//);
  if (profileDoc) return { sensitive: true, profileUserId: profileDoc[1] };
  const eventDoc = key.match(/^events\/([^/]+)\/idDocuments\//);
  if (eventDoc) return { sensitive: true, eventId: eventDoc[1] };
  return { sensitive: false };
}

async function canReadPrintRequestFile(
  ctx: NonNullable<Awaited<ReturnType<typeof loadUserContext>>>,
  scope: string,
  key: string,
): Promise<boolean> {
  let eventId = scope;
  if (scope === "staff") {
    // Cle staff : l'evenement est celui de la demande dont un message porte la piece jointe.
    const msg = await prisma.printRequestMessage.findFirst({
      where: { attachmentKey: key },
      select: { request: { select: { eventId: true } } },
    });
    if (!msg) return false;
    eventId = msg.request.eventId;
  }
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { orgId: true } });
  return !!event && hasEventPermission(ctx, eventId, event.orgId, "print.request");
}

async function canRead(userId: string, c: SensitiveFile, key: string): Promise<boolean> {
  const ctx = await loadUserContext(userId);
  if (!ctx) return false;
  if ("staffOnly" in c) {
    return ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_SUPPORT");
  }
  if ("staffAny" in c) return ctx.isStaff && !!ctx.staffRole;
  if ("printRequestScope" in c) {
    // Tout le staff lit ; sinon il faut `print.request` sur l'evenement de la cle.
    if (ctx.isStaff && !!ctx.staffRole) return true;
    return canReadPrintRequestFile(ctx, c.printRequestScope, key);
  }
  if (ctx.isStaff) return true;
  if ("printEventId" in c) {
    const event = await prisma.event.findUnique({ where: { id: c.printEventId }, select: { orgId: true } });
    return !!event && hasEventPermission(ctx, c.printEventId, event.orgId, "badge.print");
  }
  if (c.eventId === undefined) return c.profileUserId === userId;
  // Sinon c'est un document d'evenement : eventId est garanti par le type.
  const event = await prisma.event.findUnique({
    where: { id: c.eventId },
    select: { orgId: true },
  });
  if (!event) return false;
  return hasEventPermission(ctx, c.eventId, event.orgId, "event.read.detailed");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  // Durcissement : aucun segment `..` (la classification se fait sur le prefixe de la cle).
  if (path.includes("..")) return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  const key = path.join("/");
  const cls = classify(key);

  if (cls.sensitive) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !(await canRead(session.user.id, cls, key))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  try {
    const { body, contentType } = await getFile(key);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cls.sensitive ? "private, no-store" : "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }
}
