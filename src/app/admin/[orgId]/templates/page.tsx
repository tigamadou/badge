import { prisma } from "@/lib/prisma";
import { TemplatesClient } from "./TemplatesClient";

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const templates = await prisma.categoryTemplate.findMany({
    where: { orgId },
    orderBy: [{ number: "asc" }, { name: "asc" }],
  });
  return (
    <TemplatesClient
      orgId={orgId}
      initial={templates.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
    />
  );
}
