import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-participant";
import { listPublishedCatalog } from "@/lib/print-catalog/catalog";

// Vitrine des produits d'impression. Ouverte a toute session connectee (prix et images publics).
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kind = req.nextUrl.searchParams.get("kind");
  if (kind !== null && kind !== "BADGE" && kind !== "ACCESSORY") {
    return NextResponse.json({ error: "Type de produit invalide.", code: "VALIDATION" }, { status: 400 });
  }
  const products = await listPublishedCatalog(kind ?? undefined);
  return NextResponse.json({ products });
}
