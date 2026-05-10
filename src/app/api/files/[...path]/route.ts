import { NextRequest, NextResponse } from "next/server";
import { getFile } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join("/");

  try {
    const { body, contentType } = await getFile(key);
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }
}
