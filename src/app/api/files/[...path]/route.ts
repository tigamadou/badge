import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { eventTargetOf, hasPermission, type Permission } from "@/lib/permissions";
import { getFile } from "@/lib/storage";

// v4 Task 5.3 : les documents d'identite ne doivent JAMAIS etre servis publiquement.
// Cles sensibles : `profile/{userId}/documents/...` (compte participant) et
// `events/{eventId}/idDocuments/...` (piece jointe a une inscription). Les photos et
// logos restent publics (ils apparaissent sur les badges / pages publiques).
// Chaque classe de cle exige une permission du catalogue (spec 37, « Fichiers sensibles »), sans
// passe-droit `isStaff` :
// - `print-sheets/...` : `print.sheets.read` (plateforme) ;
// - `print-requests/{eventId}/...` et `print-requests/staff/{requestId}/...` : `print.requests.read`
//   (plateforme) ou `print.request` sur l'evenement de la cle, ou de la commande nommee par la cle
//   (le message qui la porte est verifie a l'ecriture : il ne peut citer que le prefixe de sa propre
//   commande) ; autre forme `print-requests/...` : `print.requests.read` seulement ;
// - `badge-exports/{eventId}/...` : `badge.print` sur l'evenement ;
// - `events/{eventId}/idDocuments/...` : `event.read.detailed` sur l'evenement ;
// - `profile/{userId}/documents/...` : le proprietaire, ou `profiles.read` (plateforme).
type SensitiveFile =
  | { kind: "profile"; userId: string }
  | { kind: "idDocument"; eventId: string }
  | { kind: "sheets" }
  | { kind: "printRequest"; scope: string }
  | { kind: "printRequestOther" }
  | { kind: "export"; eventId: string };
type FileClass = { sensitive: false } | ({ sensitive: true } & SensitiveFile);

function classify(key: string): FileClass {
  if (key.startsWith("print-sheets/")) return { sensitive: true, kind: "sheets" };
  const printRequest = key.match(/^print-requests\/([^/]+)\//);
  if (printRequest) return { sensitive: true, kind: "printRequest", scope: printRequest[1] };
  if (key.startsWith("print-requests/")) return { sensitive: true, kind: "printRequestOther" };
  const exportFile = key.match(/^badge-exports\/([^/]+)\//);
  if (exportFile) return { sensitive: true, kind: "export", eventId: exportFile[1] };
  const profileDoc = key.match(/^profile\/([^/]+)\/documents\//);
  if (profileDoc) return { sensitive: true, kind: "profile", userId: profileDoc[1] };
  const eventDoc = key.match(/^events\/([^/]+)\/idDocuments\//);
  if (eventDoc) return { sensitive: true, kind: "idDocument", eventId: eventDoc[1] };
  return { sensitive: false };
}

const PLATFORM = { kind: "platform" } as const;
type Ctx = NonNullable<Awaited<ReturnType<typeof loadUserContext>>>;

async function hasEventFilePermission(ctx: Ctx, eventId: string, permission: Permission): Promise<boolean> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { orgId: true } });
  return !!event && hasPermission(ctx, permission, eventTargetOf({ eventId, orgId: event.orgId }));
}

async function canReadPrintRequestFile(ctx: Ctx, scope: string, key: string): Promise<boolean> {
  if (hasPermission(ctx, "print.requests.read", PLATFORM)) return true;
  let eventId = scope;
  if (scope === "staff") {
    // Cle staff `print-requests/staff/{requestId}/{fichier}` : l'evenement est celui de la commande.
    const [, , requestId, file] = key.split("/");
    if (!requestId || !file) return false;
    const request = await prisma.printRequest.findUnique({ where: { id: requestId }, select: { eventId: true } });
    if (!request) return false;
    eventId = request.eventId;
  }
  return hasEventFilePermission(ctx, eventId, "print.request");
}

async function canRead(userId: string, c: SensitiveFile, key: string): Promise<boolean> {
  const ctx = await loadUserContext(userId);
  if (!ctx) return false;
  switch (c.kind) {
    case "sheets":
      return hasPermission(ctx, "print.sheets.read", PLATFORM);
    case "printRequestOther":
      return hasPermission(ctx, "print.requests.read", PLATFORM);
    case "printRequest":
      return canReadPrintRequestFile(ctx, c.scope, key);
    case "export":
      return hasEventFilePermission(ctx, c.eventId, "badge.print");
    case "idDocument":
      return hasEventFilePermission(ctx, c.eventId, "event.read.detailed");
    case "profile":
      return c.userId === userId || hasPermission(ctx, "profiles.read", PLATFORM);
  }
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
