import { prisma } from "@/lib/prisma";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const logs = await prisma.activityLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Journal d&apos;activité</h1>
      <p className="text-sm text-gray-500">
        Les actions marquées{" "}
        <span className="px-1 rounded bg-amber-100 text-amber-800">staff</span> sont effectuées par
        le staff applicatif.
      </p>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Acteur</th>
            <th className="px-3 py-2">Détails</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                Aucune activité.
              </td>
            </tr>
          )}
          {logs.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="px-3 py-2 whitespace-nowrap">
                {new Date(l.createdAt).toLocaleString("fr-FR")}
              </td>
              <td className="px-3 py-2">
                {l.type}
                {l.staffActor && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    staff
                  </span>
                )}
              </td>
              <td className="px-3 py-2">{l.user?.email ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-gray-600">
                <pre className="whitespace-pre-wrap font-mono">
                  {JSON.stringify(l.details, null, 0)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
