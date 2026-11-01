import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { productCreateSchema } from "@/lib/print-catalog/input";
import { createProduct, listProducts } from "@/lib/print-catalog/products";

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  if (kind !== null && kind !== "BADGE" && kind !== "ACCESSORY") {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const products = await listProducts({
    kind: kind ?? undefined,
    archived: searchParams.get("archived") === "true",
  });
  return NextResponse.json({ products });
});

export const POST = withStaffAuth(
  async (req, { session }) => {
    const body = await req.json().catch(() => null);
    const parsed = productCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    try {
      const product = await createProduct(parsed.data, session.user.id);
      await logActivity({
        type: "PRINT_PRODUCT_CREATED",
        userId: session.user.id,
        targetId: product.id,
        details: { name: product.name, kind: product.kind },
        req,
      });
      return NextResponse.json({ product }, { status: 201 });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
      }
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);
