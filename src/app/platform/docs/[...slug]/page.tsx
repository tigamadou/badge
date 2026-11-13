import { notFound } from "next/navigation";
import { DocArticle } from "@/components/page-docs/DocArticle";
import { requireDocsUserId } from "@/components/page-docs/docs-session";
import { loadDocById } from "@/lib/page-docs";

export const dynamic = "force-dynamic";

export default async function PlatformDocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const userId = await requireDocsUserId(`/platform/docs/${slug.join("/")}`);
  const doc = await loadDocById(userId, `platform/${slug.join("/")}`, {});
  if (!doc) notFound();
  return <DocArticle doc={doc} listHref="/platform/docs" />;
}
