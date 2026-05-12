"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Registration {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  structure: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  team: { name: string; color: string };
}

const PAGE_SIZE = 10;

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  async function fetchRegistrations() {
    const res = await fetch("/api/registrations");
    setRegistrations(await res.json());
  }

  useEffect(() => {
    fetchRegistrations();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, teamFilter, search]);

  const filtered = registrations.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (teamFilter && r.team.name !== teamFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = `${r.lastName} ${r.firstName} ${r.email} ${r.structure}`.toLowerCase();
      if (!match.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const teamNames = [...new Set(registrations.map((r) => r.team.name))];

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Inscriptions</h1>
        <Link href="/admin/registrations/new">
          <Button>Nouvelle inscription</Button>
        </Link>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Rechercher par nom, email, structure..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Validé</option>
          <option value="REJECTED">Rejeté</option>
        </select>
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="">Toutes les catégories</option>
          {teamNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Structure</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Catégorie</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Statut</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((reg) => (
              <tr key={reg.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/admin/registrations/${reg.id}`} className="text-indigo-600 hover:text-indigo-700 font-medium">
                    {reg.lastName} {reg.firstName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{reg.structure}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: reg.team.color }} />
                    <span className="text-slate-600">{reg.team.name}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(reg.createdAt)}</td>
                <td className="px-4 py-3"><StatusBadge status={reg.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/registrations/${reg.id}`}>
                    <Button variant="secondary">Détails</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center py-8 text-slate-400">Aucune inscription trouvée.</p>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {paginated.map((reg) => (
          <div key={reg.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <Link href={`/admin/registrations/${reg.id}`} className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
                {reg.lastName} {reg.firstName}
              </Link>
              <StatusBadge status={reg.status} />
            </div>
            <div className="space-y-1.5 text-sm text-slate-500">
              <p>{reg.structure}</p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: reg.team.color }} />
                {reg.team.name}
              </p>
              <p>{formatDate(reg.createdAt)}</p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <Link href={`/admin/registrations/${reg.id}`}>
                <Button variant="secondary" className="w-full">Détails</Button>
              </Link>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-slate-400">Aucune inscription trouvée.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""} — page {currentPage} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="secondary"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
