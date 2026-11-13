import { NextRequest, NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { MAX_ARCHIVE_BYTES, readTemplatePackage } from "@tigamadou/pdf-engine/package";
import { isRendererUnavailable, rendererUnavailableResponse } from "@/lib/renderer";
import { installTemplate } from "@/lib/badge-templates/install";
import { checkBadgePackage, computeBindings } from "@/lib/badge-templates/bindings";

export const runtime = "nodejs";

function badRequest(errors: string[]) {
  return NextResponse.json({ error: "INVALID_PACKAGE", errors }, { status: 400 });
}

export const POST = withStaffAuth(
  async (req: NextRequest, { session }) => {
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

  // Les liaisons sont calculees ici, jamais recues : le serveur est seul juge.
  const packageErrors = checkBadgePackage(manifest);
  if (packageErrors.length > 0) return badRequest(packageErrors);
  const bindings = computeBindings(manifest.variables);

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
    // Un service de rendu absent n'est pas la faute du paquet : 503, pas 400.
    if (isRendererUnavailable(err)) return rendererUnavailableResponse();
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
},
  { permission: "badge_templates.manage" },
);

export const GET = withStaffAuth(
  async () => {
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
},
  { permission: "badge_templates.read" },
);
