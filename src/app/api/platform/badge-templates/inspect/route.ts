import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireStaff, AuthError } from "@/lib/auth-guards";
import { MAX_ARCHIVE_BYTES, readTemplatePackage } from "@/lib/badge-templates/engine/package-reader";
import { SOURCE_KINDS, suggestBindings } from "@/lib/badge-templates/bindings";

export const runtime = "nodejs";

function badRequest(errors: string[]) {
  return NextResponse.json({ error: "INVALID_PACKAGE", errors }, { status: 400 });
}

// Lecture seule, volontairement separee de l'installation : rien n'est ecrit
// tant que l'administrateur n'a pas vu et complete ses liaisons. L'archive
// transite deux fois, ce que MAX_ARCHIVE_BYTES borne deja.
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

  const read = await readTemplatePackage(Buffer.from(await file.arrayBuffer()));
  if (!read.ok) return badRequest(read.errors);

  return NextResponse.json({
    variables: read.manifest.variables,
    suggested: suggestBindings(read.manifest.variables),
    sources: SOURCE_KINDS,
  });
}
