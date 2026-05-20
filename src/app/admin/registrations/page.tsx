"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";

interface Registration {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  structure: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  team: { id: string; name: string; color: string };
}

interface Team {
  id: string;
  name: string;
  color: string;
}

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const [teams, setTeams] = useState<Team[]>([]);

  // Fetch teams for the category filter select
  useEffect(() => {
    fetch("/api/teams?limit=100")
      .then((r) => r.json())
      .then((res) => {
        setTeams(res.data || []);
      });
  }, []);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(pageSize));
    if (statusFilter) params.set("status", statusFilter);
    if (teamFilter) params.set("teamId", teamFilter);
    if (search) params.set("search", search);

    const res = await fetch(`/api/registrations?${params.toString()}`);
    const data = await res.json();
    setRegistrations(data.data);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [page, pageSize, statusFilter, teamFilter, search]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, teamFilter, search]);

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
          <option value="APPROVED">Valide</option>
          <option value="REJECTED">Rejete</option>
        </select>
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="">Toutes les categories</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
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
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Categorie</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Statut</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">Chargement...</td>
              </tr>
            ) : registrations.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">Aucune inscription trouvee.</td>
              </tr>
            ) : (
              registrations.map((reg) => (
                <tr key={reg.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/registrations/${reg.id}`} className="text-indigo-600 hover:text-indigo-700 font-medium">
                      {reg.lastName || reg.firstName
                        ? `${reg.lastName} ${reg.firstName}`.trim()
                        : `Inscription #${reg.id}`}
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
                      <Button variant="secondary">Details</Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-8 text-slate-500">Chargement...</p>
        ) : registrations.length === 0 ? (
          <p className="text-center py-8 text-slate-400">Aucune inscription trouvee.</p>
        ) : (
          registrations.map((reg) => (
            <div key={reg.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <Link href={`/admin/registrations/${reg.id}`} className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
                  {reg.lastName || reg.firstName
                    ? `${reg.lastName} ${reg.firstName}`.trim()
                    : `Inscription #${reg.id}`}
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
                  <Button variant="secondary" className="w-full">Details</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
