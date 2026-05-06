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
  badgePrinted: boolean;
  badgePrintedAt: string | null;
  createdAt: string;
  team: { name: string; color: string };
}

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [printFilter, setPrintFilter] = useState<string>("");
  const [hasContact, setHasContact] = useState(false);

  async function fetchRegistrations() {
    const res = await fetch("/api/registrations");
    setRegistrations(await res.json());
  }

  useEffect(() => {
    fetchRegistrations();
    fetch("/api/event").then((r) => r.json()).then((e) => {
      setHasContact(Boolean(e?.contactEmail && e?.contactPhone));
    });
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchRegistrations();
  }

  const filtered = registrations.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (teamFilter && r.team.name !== teamFilter) return false;
    if (printFilter === "printed" && !r.badgePrinted) return false;
    if (printFilter === "not_printed" && (r.badgePrinted || r.status !== "APPROVED")) return false;
    return true;
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const printableIds = filtered
      .filter((r) => r.status === "APPROVED" && !r.badgePrinted)
      .map((r) => r.id);
    if (printableIds.every((id) => selected.has(id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        printableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        printableIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function batchPrint() {
    if (selected.size === 0) return;
    setPrinting(true);
    await fetch("/api/registrations/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setSelected(new Set());
    await fetchRegistrations();
    setPrinting(false);
  }

  const teamNames = [...new Set(registrations.map((r) => r.team.name))];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inscriptions</h1>
        <Link href="/admin/registrations/new">
          <Button>Nouvelle inscription</Button>
        </Link>
      </div>

      <div className="flex gap-4 mb-4">
        <select
          className="px-3 py-2 border rounded text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Validé</option>
          <option value="REJECTED">Rejeté</option>
        </select>
        <select
          className="px-3 py-2 border rounded text-sm"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="">Toutes les catégories</option>
          {teamNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 border rounded text-sm"
          value={printFilter}
          onChange={(e) => setPrintFilter(e.target.value)}
        >
          <option value="">Impression</option>
          <option value="printed">Imprimé</option>
          <option value="not_printed">Non imprimé</option>
        </select>
        {hasContact && selected.size > 0 && (
          <Button onClick={batchPrint} disabled={printing}>
            {printing ? "Envoi..." : `Marquer comme imprimés (${selected.size})`}
          </Button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 w-10">
                {hasContact && (
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={
                      filtered.filter((r) => r.status === "APPROVED" && !r.badgePrinted).length > 0 &&
                      filtered
                        .filter((r) => r.status === "APPROVED" && !r.badgePrinted)
                        .every((r) => selected.has(r.id))
                    }
                  />
                )}
              </th>
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Structure</th>
              <th className="text-left px-4 py-3">Catégorie</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Badge</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((reg) => (
              <tr key={reg.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  {hasContact && reg.status === "APPROVED" && !reg.badgePrinted && (
                    <input
                      type="checkbox"
                      checked={selected.has(reg.id)}
                      onChange={() => toggleSelect(reg.id)}
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/registrations/${reg.id}`} className="text-blue-600 hover:underline font-medium">
                    {reg.lastName} {reg.firstName}
                  </Link>
                </td>
                <td className="px-4 py-3">{reg.structure}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: reg.team.color }} />
                    {reg.team.name}
                  </span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={reg.status} /></td>
                <td className="px-4 py-3">
                  {reg.badgePrinted ? (
                    <span className="text-xs text-green-600 font-medium">Imprimé</span>
                  ) : reg.status === "APPROVED" ? (
                    <span className="text-xs text-orange-500">Non imprimé</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {reg.status === "APPROVED" && (
                    <Link href={`/badge-preview/${reg.id}`} target="_blank">
                      <Button variant="secondary">Voir badge</Button>
                    </Link>
                  )}
                  {reg.status === "PENDING" && (
                    <>
                      <Button variant="primary" onClick={() => updateStatus(reg.id, "APPROVED")}>Valider</Button>
                      <Button variant="danger" onClick={() => updateStatus(reg.id, "REJECTED")}>Rejeter</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center py-8 text-gray-500">Aucune inscription trouvée.</p>
        )}
      </div>
    </div>
  );
}
