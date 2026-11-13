import { DocsIndex } from "@/components/page-docs/DocsIndex";
import { requireDocsUserId } from "@/components/page-docs/docs-session";
import { listDocsForUser } from "@/lib/page-docs";

export const dynamic = "force-dynamic";

export default async function AccountDocsPage() {
  const userId = await requireDocsUserId("/account/docs");
  const items = await listDocsForUser(userId, "account", {});
  return <DocsIndex space="account" baseHref="/account/docs" items={items} />;
}
