import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole } from "@/lib/auth-helpers";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event || event.orgId !== orgId) notFound();

  const role = effectiveEventRole(ctx, eventId, orgId);
  if (role !== "STAFF" && role !== "ADMIN" && role !== "OPERATOR") {
    notFound();
  }

  const where: Prisma.ActivityLogWhereInput = { eventId };
  if (role === "OPERATOR") {
    where.userId = ctx.user.id;
    where.type = "BADGE_SCANNED";
  }

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      staffActor: true,
      details: true,
      targetId: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Journal d&apos;activite</h1>
      <ul className="bg-white border rounded divide-y text-sm">
        {logs.length === 0 && (
          <li className="px-3 py-3 text-slate-500">Aucune activite.</li>
        )}
        {logs.map((l) => (
          <li key={l.id} className="px-3 py-3 flex justify-between items-start">
            <div>
              <div className="font-medium">
                {l.type}
                {l.staffActor && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    staff
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {l.user ? `${l.user.name} (${l.user.email})` : "Systeme"}
                {l.targetId ? ` — cible ${l.targetId}` : ""}
              </div>
            </div>
            <div className="text-xs text-slate-500 whitespace-nowrap">
              {new Date(l.createdAt).toLocaleString("fr-FR")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
