"use client";

import { useEffect, useState, useCallback } from "react";

interface ActivityLog {
  id: string;
  type: string;
  userId: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface UserOption {
  id: string;
  name: string;
}

const TYPE_GROUPS = [
  { value: "", label: "Tous les types" },
  { value: "registration", label: "Inscriptions" },
  { value: "badge", label: "Badges" },
  { value: "scan", label: "Scans" },
  { value: "user", label: "Utilisateurs" },
  { value: "config", label: "Configuration" },
];

const TYPE_LABELS: Record<string, string> = {
  REGISTRATION_CREATED: "Inscription creee",
  REGISTRATION_APPROVED: "Inscription approuvee",
  REGISTRATION_REJECTED: "Inscription rejetee",
  REGISTRATION_UPDATED: "Inscription modifiee",
  REGISTRATION_DELETED: "Inscription supprimee",
  BADGE_PRINTED: "Badge imprime",
  BADGE_BATCH_PRINTED: "Badges imprimes (lot)",
  BADGE_ALL_ACCESS_TOGGLED: "ALL ACCESS modifie",
  BADGE_EXPORTED: "Badge exporte",
  BADGE_BATCH_EXPORTED: "Badges exportes (lot)",
  BADGE_SCANNED: "Badge scanne",
  USER_CREATED: "Utilisateur cree",
  USER_UPDATED: "Utilisateur modifie",
  USER_DELETED: "Utilisateur supprime",
  USER_PASSWORD_SET: "Mot de passe defini",
  USER_LOGIN: "Connexion",
  CATEGORY_CREATED: "Categorie creee",
  CATEGORY_UPDATED: "Categorie modifiee",
  CATEGORY_DELETED: "Categorie supprimee",
  EVENT_UPDATED: "Evenement modifie",
  SETTINGS_UPDATED: "Parametres modifies",
};

const TYPE_COLORS: Record<string, string> = {
  REGISTRATION_CREATED: "bg-emerald-100 text-emerald-700",
  REGISTRATION_APPROVED: "bg-emerald-100 text-emerald-700",
  REGISTRATION_REJECTED: "bg-emerald-100 text-emerald-700",
  REGISTRATION_UPDATED: "bg-emerald-100 text-emerald-700",
  REGISTRATION_DELETED: "bg-emerald-100 text-emerald-700",
  BADGE_PRINTED: "bg-purple-100 text-purple-700",
  BADGE_BATCH_PRINTED: "bg-purple-100 text-purple-700",
  BADGE_ALL_ACCESS_TOGGLED: "bg-purple-100 text-purple-700",
  BADGE_EXPORTED: "bg-purple-100 text-purple-700",
  BADGE_BATCH_EXPORTED: "bg-purple-100 text-purple-700",
  BADGE_SCANNED: "bg-blue-100 text-blue-700",
  USER_CREATED: "bg-orange-100 text-orange-700",
  USER_UPDATED: "bg-orange-100 text-orange-700",
  USER_DELETED: "bg-orange-100 text-orange-700",
  USER_PASSWORD_SET: "bg-orange-100 text-orange-700",
  USER_LOGIN: "bg-orange-100 text-orange-700",
  CATEGORY_CREATED: "bg-slate-100 text-slate-700",
  CATEGORY_UPDATED: "bg-slate-100 text-slate-700",
  CATEGORY_DELETED: "bg-slate-100 text-slate-700",
  EVENT_UPDATED: "bg-slate-100 text-slate-700",
  SETTINGS_UPDATED: "bg-slate-100 text-slate-700",
};

function getDescription(log: ActivityLog): string {
  const d = log.details;
  if (!d) return "";

  switch (log.type) {
    case "REGISTRATION_CREATED":
    case "REGISTRATION_UPDATED":
    case "REGISTRATION_DELETED":
      return d.registrationName as string || "";
    case "REGISTRATION_APPROVED":
    case "REGISTRATION_REJECTED":
      return `${d.registrationName || ""} (${d.previousStatus} → ${d.newStatus})`;
    case "BADGE_PRINTED":
    case "BADGE_ALL_ACCESS_TOGGLED":
    case "BADGE_EXPORTED":
      return d.registrationName as string || "";
    case "BADGE_BATCH_PRINTED":
    case "BADGE_BATCH_EXPORTED":
      return `${d.count || 0} badge(s)`;
    case "BADGE_SCANNED":
      return `${d.registrationName || ""} — ${d.teamName || ""}`;
    case "USER_CREATED":
    case "USER_UPDATED":
    case "USER_DELETED":
      return `${d.userName || ""} (${d.userRole || ""})`;
    case "USER_PASSWORD_SET":
      return d.userName as string || "";
    case "USER_LOGIN":
      return d.userEmail as string || "";
    case "CATEGORY_CREATED":
    case "CATEGORY_UPDATED":
    case "CATEGORY_DELETED":
      return d.categoryName as string || "";
    case "EVENT_UPDATED":
      return d.eventTitle as string || "";
    case "SETTINGS_UPDATED":
      return d.changes as string || "";
    default:
      return JSON.stringify(d);
  }
}

function parseUserAgent(ua: string | null): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "—", os: "—", device: "—" };

  let browser = "Inconnu";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && ua.includes("Safari/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let os = "Inconnu";
  if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  let device = "Ordinateur";
  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) device = "Mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) device = "Tablette";

  return { browser, os, device };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function DetailPanel({ log, onClose }: { log: ActivityLog; onClose: () => void }) {
  const ua = parseUserAgent(log.userAgent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Detail du log</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type et date */}
          <div className="flex items-center justify-between">
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[log.type] || "bg-slate-100 text-slate-700"}`}>
              {TYPE_LABELS[log.type] || log.type}
            </span>
            <span className="text-sm text-slate-500">{formatDate(log.createdAt)}</span>
          </div>

          {/* Utilisateur */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Utilisateur</p>
            <p className="text-sm text-slate-900">{log.user?.name || "—"}</p>
            {log.user?.email && <p className="text-xs text-slate-500">{log.user.email}</p>}
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-slate-900">{getDescription(log) || "—"}</p>
          </div>

          {/* Ressource */}
          {log.targetId && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Ressource</p>
              <p className="text-sm font-mono text-slate-700">{log.targetId}</p>
            </div>
          )}

          {/* Infos techniques */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Informations techniques</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Adresse IP</p>
                <p className="text-sm font-mono text-slate-700">{log.ipAddress || "—"}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Appareil</p>
                <p className="text-sm text-slate-700">{ua.device}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Systeme</p>
                <p className="text-sm text-slate-700">{ua.os}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Navigateur</p>
                <p className="text-sm text-slate-700">{ua.browser}</p>
              </div>
            </div>
          </div>

          {/* User-Agent brut */}
          {log.userAgent && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">User-Agent</p>
              <p className="text-xs font-mono text-slate-500 break-all bg-slate-50 rounded-lg p-2">{log.userAgent}</p>
            </div>
          )}

          {/* Details JSON */}
          {log.details && Object.keys(log.details).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Donnees</p>
              <pre className="text-xs font-mono text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const limit = 30;

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setUsers(data); });
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (userFilter) params.set("userId", userFilter);
    if (search) params.set("search", search);
    if (dateFrom) params.set("startDate", dateFrom);
    if (dateTo) params.set("endDate", dateTo);
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await fetch(`/api/activity-logs?${params.toString()}`);
    const data = await res.json();
    setLogs(data.logs);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [typeFilter, userFilter, search, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, userFilter, search, dateFrom, dateTo]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Journal d&apos;activite</h1>
        <span className="text-sm text-slate-500">{total} entree{total > 1 ? "s" : ""}</span>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 mb-4">
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          {TYPE_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>

        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option value="">Tous les utilisateurs</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Rechercher..."
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <input
          type="date"
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />

        <input
          type="date"
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {/* Tableau desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-4 py-3">Date/Heure</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Utilisateur</th>
              <th className="text-left px-4 py-3">Description</th>
              <th className="text-left px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">Chargement...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">Aucune entree trouvee.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[log.type] || "bg-slate-100 text-slate-700"}`}>
                      {TYPE_LABELS[log.type] || log.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">{log.user?.name || "—"}</td>
                  <td className="px-4 py-3">{getDescription(log)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.ipAddress || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cartes mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-8 text-slate-500">Chargement...</p>
        ) : logs.length === 0 ? (
          <p className="text-center py-8 text-slate-500">Aucune entree trouvee.</p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 cursor-pointer hover:border-slate-300 transition-colors"
              onClick={() => setSelectedLog(log)}
            >
              <div className="flex justify-between items-start">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[log.type] || "bg-slate-100 text-slate-700"}`}>
                  {TYPE_LABELS[log.type] || log.type}
                </span>
                <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-900">{getDescription(log)}</p>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{log.user?.name || "—"}</span>
                {log.ipAddress && <span className="font-mono">{log.ipAddress}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Precedent
          </button>
          <span className="text-sm text-slate-600">
            Page {page} sur {totalPages}
          </span>
          <button
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      )}

      {/* Modale detail */}
      {selectedLog && (
        <DetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
