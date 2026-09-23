import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireStaff, AuthError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { MAX_ARCHIVE_BYTES, readTemplatePackage } from "@/lib/badge-templates/engine/package-reader";
import { installTemplate } from "@/lib/badge-templates/install";
import { validateBindings, type Bindings } from "@/lib/badge-templates/bindings";

export const runtime = "nodejs";

function badRequest(errors: string[]) {
  return NextResponse.json({ error: "INVALID_PACKAGE", errors }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  try {
    await requireStaff(session.user.id, "STAFF_ADMIN");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    }
    throw err;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("archive");
  if (!(file instanceof File)) {
    return badRequest(["archive : fichier manquant."]);
  }
  if (file.size > MAX_ARCHIVE_BYTES) {
    return badRequest([`archive : taille superieure a ${MAX_ARCHIVE_BYTES} octets.`]);
  }

  const archive = Buffer.from(await file.arrayBuffer());
  const read = await readTemplatePackage(archive);
  if (!read.ok) return badRequest(read.errors);

  const { manifest, assets } = read;

  const raw = form?.get("bindings");
  if (typeof raw !== "string") {
    return badRequest(["liaisons : champ manquant."]);
  }
  let bindings: Bindings;
  try {
    bindings = JSON.parse(raw) as Bindings;
  } catch {
    return badRequest(["liaisons : JSON illisible."]);
  }
  // `null` ou un tableau sont du JSON valide, mais validateBindings les parcourt
  // comme un objet : on les refuse ici plutot que de laisser la route lever.
  if (typeof bindings !== "object" || bindings === null || Array.isArray(bindings)) {
    return badRequest(["liaisons : objet attendu."]);
  }
  // Refus avec la liste COMPLETE des erreurs : l'ecran de liaison les affiche
  // toutes d'un coup, plutot qu'une par tentative.
  const bindingErrors = validateBindings(manifest.variables, bindings);
  if (bindingErrors.length > 0) return badRequest(bindingErrors);

  // v4 (plan 12) : plus de registre compile, donc plus de collision possible.
  // Reinstaller une famille livree (`default`) en cree simplement une nouvelle
  // version, ce qui est le comportement voulu.
  let created;
  try {
    created = await installTemplate({
      manifest,
      assets,
      bindings,
      installedById: session.user.id as string,
    });
  } catch (err) {
    // Un paquet qui ne s'imprime pas n'entre pas au catalogue. installTemplate a
    // deja nettoye les ressources ; il reste a traduire l'echec pour l'installateur.
    return badRequest([
      `rendu d'epreuve : le paquet n'a pas pu etre imprime (${(err as Error).message}).`,
    ]);
  }

  await logActivity({
    type: "BADGE_TEMPLATE_INSTALLED",
    userId: session.user.id as string,
    targetId: created.id,
    details: { family: created.family, version: created.version },
    req,
  });

  return NextResponse.json(created, { status: 201 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  try {
    await requireStaff(session.user.id, "STAFF_OBSERVER");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    }
    throw err;
  }

  const templates = await prisma.installedBadgeTemplate.findMany({
    orderBy: [{ family: "asc" }, { version: "desc" }],
    select: {
      id: true,
      family: true,
      version: true,
      label: true,
      description: true,
      pages: true,
      previewPath: true,
      archived: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ templates });
}
