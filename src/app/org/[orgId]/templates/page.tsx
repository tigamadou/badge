import { prisma } from "@/lib/prisma";
import { requireOrgPagePermission } from "@/app/org/[orgId]/_lib/page-access";
import { TemplatesClient } from "./TemplatesClient";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export default async function TemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const { permissions } = await requireOrgPagePermission(orgId, "org.templates.read", `/org/${orgId}/templates`);
  const list = parseListPage(await searchParams);
  const result = await paginate(
    list,
    () => prisma.categoryTemplate.count({ where: { orgId } }),
    (range) =>
      prisma.categoryTemplate.findMany({
        where: { orgId },
        orderBy: [{ number: "asc" }, { name: "asc" }, { id: "asc" }],
        ...range,
      }),
  );
  return (
    <TemplatesClient
      orgId={orgId}
      canManage={permissions.has("org.templates.manage")}
      rows={result.rows.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
      footer={<UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />}
    />
  );
}
