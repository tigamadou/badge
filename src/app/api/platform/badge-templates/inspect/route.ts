import { NextRequest, NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { MAX_ARCHIVE_BYTES, readTemplatePackage } from "@tigamadou/pdf-engine/package";
import type { VariableDeclaration } from "@tigamadou/pdf-engine";
import { prisma } from "@/lib/prisma";
import { checkBadgePackage, computeBindings, OPTION_BINDING } from "@/lib/badge-templates/bindings";

export const runtime = "nodejs";

function badRequest(errors: string[]) {
  return NextResponse.json({ error: "INVALID_PACKAGE", errors }, { status: 400 });
}

// Lecture seule, volontairement separee de l'installation : rien n'est ecrit
// tant que l'administrateur n'a pas vu le recapitulatif. L'archive
// transite deux fois, ce que MAX_ARCHIVE_BYTES borne deja.
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

  const read = await readTemplatePackage(Buffer.from(await file.arrayBuffer()));
  if (!read.ok) return badRequest(read.errors);

  const packageErrors = checkBadgePackage(read.manifest);
  if (packageErrors.length > 0) return badRequest(packageErrors);

  const { manifest, assets } = read;
  const bindings = computeBindings(manifest.variables);
  const describe = (v: VariableDeclaration) => ({ name: v.name, kind: v.kind, label: v.label });
  const latest = await prisma.installedBadgeTemplate.findFirst({
    where: { family: manifest.family },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const previewAsset = manifest.preview ? assets.find((a) => a.path === manifest.preview) : undefined;

  return NextResponse.json({
    family: manifest.family,
    label: manifest.label,
    pages: manifest.page.count,
    nextVersion: (latest?.version ?? 0) + 1,
    preview: previewAsset
      ? `data:${previewAsset.contentType};base64,${previewAsset.body.toString("base64")}`
      : null,
    contractVariables: manifest.variables.filter((v) => bindings[v.name] !== OPTION_BINDING).map(describe),
    options: manifest.variables.filter((v) => bindings[v.name] === OPTION_BINDING).map(describe),
    bindings,
  });
},
  { permission: "badge_templates.manage" },
);
