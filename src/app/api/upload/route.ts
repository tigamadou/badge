import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string; // "logo" | "photo"
  const registrationId = formData.get("registrationId") as string | null;

  if (!file || !type) {
    return NextResponse.json({ error: "Fichier et type requis" }, { status: 400 });
  }

  const allowedTypes = type === "idDocument" ? ALLOWED_DOC_TYPES : ALLOWED_IMAGE_TYPES;
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non autorisé" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 5 MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  let key: string;

  if (type === "logo") {
    key = `logos/event-logo.${ext}`;
  } else if (type === "photo" && registrationId) {
    key = `photos/${registrationId}.${ext}`;
  } else if (type === "idDocument" && registrationId) {
    key = `documents/${registrationId}.${ext}`;
  } else {
    return NextResponse.json({ error: "Type invalide ou registrationId manquant" }, { status: 400 });
  }

  // Pour les photos publiques (formulaire inscription), pas besoin d'auth
  // Pour le logo, vérifier l'auth admin
  if (type === "logo") {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = await uploadFile(key, buffer, file.type);
  return NextResponse.json({ path });
}
