import { DocsIndex } from "@/components/page-docs/DocsIndex";
import { requireDocsUserId } from "@/components/page-docs/docs-session";
import { listDocsForUser } from "@/lib/page-docs";

export const dynamic = "force-dynamic";

export default async function OrgDocsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const userId = await requireDocsUserId(`/org/${orgId}/docs`);
  const items = await listDocsForUser(userId, "org", { orgId });
  return <DocsIndex space="org" baseHref={`/org/${orgId}/docs`} items={items} />;
}
