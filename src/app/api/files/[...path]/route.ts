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
// Les archives ZIP d'export (`badge-exports/{eventId}/...`) contiennent des badges nominatifs :
// lisibles par le staff et par les titulaires de `badge.print` sur l'evenement.
// Union discriminee : un fichier sensible est TOUJOURS soit un document de profil
// (profileUserId), soit un document d'evenement (eventId). Le type garantit qu'un
// des deux est present quand sensitive vaut true.
type SensitiveFile =
  | { sensitive: true; profileUserId: string; eventId?: undefined }
  | { sensitive: true; eventId: string; profileUserId?: undefined }
  | { sensitive: true; staffOnly: true; eventId?: undefined; profileUserId?: undefined }
  | { sensitive: true; printEventId: string; eventId?: undefined; profileUserId?: undefined };
type FileClass = { sensitive: false } | SensitiveFile;

function classify(key: string): FileClass {
  if (key.startsWith("print-sheets/")) return { sensitive: true, staffOnly: true };
  const exportFile = key.match(/^badge-exports\/([^/]+)\//);
  if (exportFile) return { sensitive: true, printEventId: exportFile[1] };
  const profileDoc = key.match(/^profile\/([^/]+)\/documents\//);
  if (profileDoc) return { sensitive: true, profileUserId: profileDoc[1] };
  const eventDoc = key.match(/^events\/([^/]+)\/idDocuments\//);
  if (eventDoc) return { sensitive: true, eventId: eventDoc[1] };
  return { sensitive: false };
}

async function canRead(userId: string, c: SensitiveFile): Promise<boolean> {
  const ctx = await loadUserContext(userId);
  if (!ctx) return false;
  if ("staffOnly" in c) {
    return ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_SUPPORT");
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
  const key = path.join("/");
  const cls = classify(key);

  if (cls.sensitive) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !(await canRead(session.user.id, cls))) {
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
