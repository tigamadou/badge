import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { getProductDetail } from "@/lib/print-catalog/catalog";
import { ProductEditor } from "@/components/staff/print/ProductEditor";

export default async function PrintCatalogProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = await getProductDetail(productId);
  if (!product) notFound();

  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const canWrite =
    !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN");

  return (
    <div>
      <Link href="/platform/print/catalog" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Catalogue
      </Link>
      <ProductEditor product={product} canWrite={canWrite} />
    </div>
  );
}
