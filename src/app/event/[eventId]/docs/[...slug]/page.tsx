import { notFound } from "next/navigation";
import { DocArticle } from "@/components/page-docs/DocArticle";
import { requireDocsUserId } from "@/components/page-docs/docs-session";
import { loadDocById } from "@/lib/page-docs";

export const dynamic = "force-dynamic";

export default async function EventDocPage({ params }: { params: Promise<{ eventId: string; slug: string[] }> }) {
  const { eventId, slug } = await params;
  const userId = await requireDocsUserId(`/event/${eventId}/docs/${slug.join("/")}`);
  const doc = await loadDocById(userId, `event/${slug.join("/")}`, { eventId });
  if (!doc) notFound();
  return <DocArticle doc={doc} listHref={`/event/${eventId}/docs`} />;
}
