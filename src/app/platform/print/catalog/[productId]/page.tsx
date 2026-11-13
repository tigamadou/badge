import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformPage } from "@/app/platform/page-guard";
import { getProductDetail } from "@/lib/print-catalog/catalog";
import { ProductEditor } from "@/components/staff/print/ProductEditor";

export default async function PrintCatalogProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { permissions } = await requirePlatformPage("print.catalog.read", "/platform/print/catalog");
  const { productId } = await params;
  const product = await getProductDetail(productId);
  if (!product) notFound();
  const canWrite = permissions.has("print.catalog.manage");

  return (
    <div>
      <Link href="/platform/print/catalog" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Catalogue
      </Link>
      <ProductEditor product={product} canWrite={canWrite} />
    </div>
  );
}
