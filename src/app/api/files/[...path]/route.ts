import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { hasEventPermission } from "@/lib/auth-helpers";
import { getFile } from "@/lib/storage";

// v4 Task 5.3 : les documents d'identite ne doivent JAMAIS etre servis publiquement.
// Cles sensibles : `profile/{userId}/documents/...` (compte participant) et
// `events/{eventId}/idDocuments/...` (piece jointe a une inscription). Les photos et
// logos restent publics (ils apparaissent sur les badges / pages publiques).
type FileClass = { sensitive: boolean; profileUserId?: string; eventId?: string };

function classify(key: string): FileClass {
  const profileDoc = key.match(/^profile\/([^/]+)\/documents\//);
  if (profileDoc) return { sensitive: true, profileUserId: profileDoc[1] };
  const eventDoc = key.match(/^events\/([^/]+)\/idDocuments\//);
  if (eventDoc) return { sensitive: true, eventId: eventDoc[1] };
  return { sensitive: false };
}

async function canRead(userId: string, c: FileClass): Promise<boolean> {
  const ctx = await loadUserContext(userId);
  if (!ctx) return false;
  if (ctx.isStaff) return true;
  if (c.profileUserId) return c.profileUserId === userId;
  if (c.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: c.eventId },
      select: { orgId: true },
    });
    if (!event) return false;
    return hasEventPermission(ctx, c.eventId, event.orgId, "event.read.detailed");
  }
  return false;
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
