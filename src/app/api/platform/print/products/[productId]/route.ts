import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { productUpdateSchema } from "@/lib/print-catalog/input";
import {
  CatalogError,
  archiveProduct,
  catalogErrorResponse,
  updateProduct,
} from "@/lib/print-catalog/products";

export const PATCH = withStaffAuth<{ productId: string }>(
  async (req, { session }, { params }) => {
    const { productId } = await params;
    const body = await req.json().catch(() => null);
    const parsed = productUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    try {
      const { product, changed } = await updateProduct(productId, parsed.data);
      if (changed.length > 0) {
        await logActivity({
          type: "PRINT_PRODUCT_UPDATED",
          userId: session.user.id,
          targetId: product.id,
          details: { changed },
          req,
        });
      }
      return NextResponse.json({ product });
    } catch (err) {
      if (err instanceof CatalogError) return catalogErrorResponse(err);
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);

// Archivage logique : les demandes d'impression referencent les produits.
export const DELETE = withStaffAuth<{ productId: string }>(
  async (req, { session }, { params }) => {
    const { productId } = await params;
    try {
      const product = await archiveProduct(productId);
      await logActivity({
        type: "PRINT_PRODUCT_ARCHIVED",
        userId: session.user.id,
        targetId: product.id,
        details: { name: product.name },
        req,
      });
      return NextResponse.json({ product });
    } catch (err) {
      if (err instanceof CatalogError) return catalogErrorResponse(err);
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);
