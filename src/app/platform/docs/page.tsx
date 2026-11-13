import { DocsIndex } from "@/components/page-docs/DocsIndex";
import { requireDocsUserId } from "@/components/page-docs/docs-session";
import { listDocsForUser } from "@/lib/page-docs";

export const dynamic = "force-dynamic";

export default async function PlatformDocsPage() {
  const userId = await requireDocsUserId("/platform/docs");
  const items = await listDocsForUser(userId, "platform", {});
  return <DocsIndex space="platform" baseHref="/platform/docs" items={items} />;
}
