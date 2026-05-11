import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLE_HIERARCHY: Record<string, number> = {
  OPERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role || "OPERATOR";
  const isAdmin = (ROLE_HIERARCHY[userRole] || 0) >= ROLE_HIERARCHY.ADMIN;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    total,
    pending,
    approved,
    rejected,
    badgesPrinted,
    badgesNotPrinted,
    allAccessCount,
    totalScans,
    scansToday,
    uniqueScanned,
  ] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.count({ where: { status: "PENDING" } }),
    prisma.registration.count({ where: { status: "APPROVED" } }),
    prisma.registration.count({ where: { status: "REJECTED" } }),
    prisma.registration.count({ where: { status: "APPROVED", badgePrinted: true } }),
    prisma.registration.count({ where: { status: "APPROVED", badgePrinted: false } }),
    prisma.registration.count({ where: { allAccessGranted: true } }),
    prisma.activityLog.count({ where: { type: "BADGE_SCANNED" } }),
    prisma.activityLog.count({ where: { type: "BADGE_SCANNED", createdAt: { gte: today } } }),
    prisma.activityLog.findMany({ where: { type: "BADGE_SCANNED" }, select: { targetId: true }, distinct: ["targetId"] }).then((g) => g.length),
  ]);

  let totalUsers = 0;
  let admins = 0;
  let operators = 0;
  if (isAdmin) {
    [totalUsers, admins, operators] = await Promise.all([
      prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { role: "OPERATOR" } }),
    ]);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

      {/* Inscriptions */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Inscriptions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total" value={total} className="bg-slate-50 text-slate-700 border-slate-200" />
          <KpiCard label="En attente" value={pending} className="bg-amber-50 text-amber-700 border-amber-200" />
          <KpiCard label="Validées" value={approved} className="bg-emerald-50 text-emerald-700 border-emerald-200" />
          <KpiCard label="Rejetées" value={rejected} className="bg-rose-50 text-rose-700 border-rose-200" />
        </div>
      </section>

      {/* Badges */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Imprimés" value={badgesPrinted} className="bg-emerald-50 text-emerald-700 border-emerald-200" />
          <KpiCard label="Non imprimés" value={badgesNotPrinted} className="bg-amber-50 text-amber-700 border-amber-200" />
          <KpiCard label="ALL ACCESS" value={allAccessCount} className="bg-indigo-50 text-indigo-700 border-indigo-200" />
        </div>
      </section>

      {/* Scans */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Scans</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Total scans" value={totalScans} className="bg-slate-50 text-slate-700 border-slate-200" />
          <KpiCard label="Aujourd'hui" value={scansToday} className="bg-indigo-50 text-indigo-700 border-indigo-200" />
          <KpiCard label="Participants scannés" value={uniqueScanned} className="bg-emerald-50 text-emerald-700 border-emerald-200" />
        </div>
      </section>

      {/* Utilisateurs — visible uniquement pour les admins */}
      {isAdmin && (
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Utilisateurs</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Total" value={totalUsers} className="bg-slate-50 text-slate-700 border-slate-200" />
            <KpiCard label="Admins" value={admins} className="bg-indigo-50 text-indigo-700 border-indigo-200" />
            <KpiCard label="Opérateurs" value={operators} className="bg-slate-50 text-slate-700 border-slate-200" />
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-xl border p-5 ${className}`}>
      <p className="text-sm opacity-75 mb-1">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
    </div>
  );
}
