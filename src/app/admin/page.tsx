import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.count({ where: { status: "PENDING" } }),
    prisma.registration.count({ where: { status: "APPROVED" } }),
    prisma.registration.count({ where: { status: "REJECTED" } }),
  ]);

  const stats = [
    { label: "Total", value: total, color: "bg-blue-100 text-blue-800" },
    { label: "En attente", value: pending, color: "bg-yellow-100 text-yellow-800" },
    { label: "Validées", value: approved, color: "bg-green-100 text-green-800" },
    { label: "Rejetées", value: rejected, color: "bg-red-100 text-red-800" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
