import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { imagesInputSchema } from "@/lib/print-catalog/input";
import { replaceImages } from "@/lib/print-catalog/content";
import { getProductDetail } from "@/lib/print-catalog/catalog";
import { CatalogError, catalogErrorResponse } from "@/lib/print-catalog/products";

export const PUT = withStaffAuth<{ productId: string }>(
  async (req, { session }, { params }) => {
    const { productId } = await params;
    const body = await req.json().catch(() => null);
    const parsed = imagesInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    try {
      await replaceImages(productId, parsed.data.images);
      await logActivity({
        type: "PRINT_PRODUCT_UPDATED",
        userId: session.user.id,
        targetId: productId,
        details: { changed: ["images"] },
        req,
      });
      return NextResponse.json({ product: await getProductDetail(productId) });
    } catch (err) {
      if (err instanceof CatalogError) return catalogErrorResponse(err);
      throw err;
    }
  },
  { permission: "print.catalog.manage" },
);
