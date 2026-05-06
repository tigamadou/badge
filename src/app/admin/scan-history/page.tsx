"use client";

import { useEffect, useState, useCallback } from "react";

interface ScanLog {
  id: string;
  scannedAt: string;
  registration: {
    lastName: string;
    firstName: string;
    structure: string;
    team: { name: string; color: string };
  };
  user: { name: string };
}

interface Operator {
  id: string;
  name: string;
}

export default function ScanHistoryPage() {
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [operators, setOperators] = useState<Operator[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const limit = 20;

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setOperators(data));
  }, []);

  const fetchScanLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (operatorId) params.set("operatorId", operatorId);
    if (search) params.set("search", search);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await fetch(`/api/scan-logs?${params.toString()}`);
    const data = await res.json();
    setScanLogs(data.scanLogs);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [operatorId, search, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchScanLogs();
  }, [fetchScanLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [operatorId, search, dateFrom, dateTo]);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Historique des scans</h1>
        <span className="text-sm text-gray-500">{total} scan{total > 1 ? "s" : ""}</span>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <select
          className="px-3 py-2 border rounded text-sm"
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
        >
          <option value="">Tous les operateurs</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>
              {op.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Rechercher un participant..."
          className="px-3 py-2 border rounded text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <input
          type="date"
          className="px-3 py-2 border rounded text-sm"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />

        <input
          type="date"
          className="px-3 py-2 border rounded text-sm"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3">Date/Heure</th>
              <th className="text-left px-4 py-3">Operateur</th>
              <th className="text-left px-4 py-3">Participant</th>
              <th className="text-left px-4 py-3">Categorie</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  Chargement...
                </td>
              </tr>
            ) : (
              scanLogs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{formatDate(log.scannedAt)}</td>
                  <td className="px-4 py-3">{log.user.name}</td>
                  <td className="px-4 py-3 font-medium">
                    {log.registration.lastName.toUpperCase()} {log.registration.firstName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: log.registration.team.color }}
                      />
                      {log.registration.team.name}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && scanLogs.length === 0 && (
          <p className="text-center py-8 text-gray-500">Aucun scan trouve.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            className="px-4 py-2 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Precedent
          </button>
          <span className="text-sm text-gray-600">
            Page {page} sur {totalPages}
          </span>
          <button
            className="px-4 py-2 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
