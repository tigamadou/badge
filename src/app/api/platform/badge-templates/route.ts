import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireStaff, AuthError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { deletePrefix, uploadFile } from "@/lib/storage";
import { MAX_ARCHIVE_BYTES, readTemplatePackage } from "@/lib/badge-templates/package-reader";
import { renderProof } from "@/lib/badge-templates/render-proof";
import { collidesWithRegistry } from "@/lib/badge-templates/resolve";

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
  if (collidesWithRegistry(manifest.family)) {
    return badRequest([
      `famille "${manifest.family}" : identifiant reserve par un template livre avec l'application.`,
    ]);
  }

  const previous = await prisma.installedBadgeTemplate.findFirst({
    where: { family: manifest.family },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (previous?.version ?? 0) + 1;

  // L'identifiant est genere en amont : il compose le prefixe de stockage, ce qui
  // permet de nettoyer les ressources si le rendu d'epreuve echoue.
  const id = crypto.randomUUID();
  const assetPrefix = `badge-templates/${id}/`;

  let preview: Buffer;
  try {
    preview = await renderProof(manifest, assets, id);
  } catch (err) {
    // Un paquet qui ne s'imprime pas n'entre pas au catalogue, et ne laisse rien
    // derriere lui. Nettoyage best-effort : son echec ne doit pas masquer l'erreur
    // de rendu, qui est ce que l'installateur doit lire.
    /* v8 ignore next -- rien n'a encore ete ecrit sous ce prefixe a ce stade */
    await deletePrefix(assetPrefix).catch(() => undefined);
    return badRequest([
      `rendu d'epreuve : le paquet n'a pas pu etre imprime (${(err as Error).message}).`,
    ]);
  }

  for (const asset of assets) {
    await uploadFile(`${assetPrefix}${asset.path}`, asset.body, asset.contentType);
  }
  const previewPath = `${assetPrefix}preview.pdf`;
  await uploadFile(previewPath, preview, "application/pdf");

  const created = await prisma.installedBadgeTemplate.create({
    data: {
      id,
      family: manifest.family,
      version,
      label: manifest.label,
      description: manifest.description,
      pages: manifest.page.count,
      pageWidthMm: manifest.page.widthMm,
      pageHeightMm: manifest.page.heightMm,
      layout: manifest as unknown as object,
      assetPrefix,
      previewPath,
      formatVersion: manifest.formatVersion,
      installedById: session.user.id as string,
    },
    select: { id: true, family: true, version: true },
  });

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
