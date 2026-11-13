import { notFound } from "next/navigation";
import { DocArticle } from "@/components/page-docs/DocArticle";
import { requireDocsUserId } from "@/components/page-docs/docs-session";
import { loadDocById } from "@/lib/page-docs";

export const dynamic = "force-dynamic";

export default async function OrgDocPage({ params }: { params: Promise<{ orgId: string; slug: string[] }> }) {
  const { orgId, slug } = await params;
  const userId = await requireDocsUserId(`/org/${orgId}/docs/${slug.join("/")}`);
  const doc = await loadDocById(userId, `org/${slug.join("/")}`, { orgId });
  if (!doc) notFound();
  return <DocArticle doc={doc} listHref={`/org/${orgId}/docs`} />;
}
