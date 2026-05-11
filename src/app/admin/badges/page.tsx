"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const BadgeBatchExport = dynamic(
  () => import("@/components/badge/BadgeBatchExport").then((m) => m.BadgeBatchExport),
  { ssr: false }
);

interface Registration {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  structure: string;
  photo: string | null;
  idDocumentType: string;
  idDocumentNumber: string;
  idDocument: string | null;
  status: "APPROVED";
  badgePrinted: boolean;
  badgePrintedAt: string | null;
  allAccessGranted: boolean;
  createdAt: string;
  team: { id: string; name: string; color: string; number: number };
}

interface EventData {
  id: string;
  title: string;
  location: string;
  date: string;
  logo: string | null;
}

export default function BadgesPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [event, setEvent] = useState<EventData | null>(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [printFilter, setPrintFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/registrations")
      .then((r) => r.json())
      .then((all: Registration[]) => setRegistrations(all.filter((r) => r.status === "APPROVED")));
    fetch("/api/event").then((r) => r.json()).then(setEvent);
  }, []);

  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      if (teamFilter && r.team.name !== teamFilter) return false;
      if (printFilter === "printed" && !r.badgePrinted) return false;
      if (printFilter === "not_printed" && r.badgePrinted) return false;
      if (search) {
        const q = search.toLowerCase();
        const match = `${r.lastName} ${r.firstName} ${r.email} ${r.structure}`.toLowerCase();
        if (!match.includes(q)) return false;
      }
      return true;
    });
  }, [registrations, teamFilter, printFilter, search]);

  const teamNames = useMemo(
    () => [...new Set(registrations.map((r) => r.team.name))],
    [registrations]
  );

  const printedCount = registrations.filter((r) => r.badgePrinted).length;

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r.id));
        return next;
      });
    }
  }

  const selectedRegistrations = registrations.filter((r) => selected.has(r.id));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Badges</h1>
          <p className="text-sm text-slate-500 mt-1">
            {registrations.length} badge(s) &mdash; {printedCount} imprime(s) / {registrations.length} total
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64"
            placeholder="Rechercher par nom, email, structure..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="">Toutes les categories</option>
            {teamNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            value={printFilter}
            onChange={(e) => setPrintFilter(e.target.value)}
          >
            <option value="">Tous</option>
            <option value="printed">Imprime</option>
            <option value="not_printed">Non imprime</option>
          </select>

          {event && (
            <BadgeBatchExport
              registrations={filtered}
              event={event}
              label={`Exporter (${filtered.length})`}
            />
          )}
        </div>
      </div>

      {/* Barre de selection */}
      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Tout selectionner ({filtered.length})
        </label>

        {selected.size > 0 && event && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{selected.size} selectionne(s)</span>
            <BadgeBatchExport
              registrations={selectedRegistrations}
              event={event}
              label={`Exporter la selection (${selected.size})`}
            />
            <button
              onClick={() => setSelected(new Set())}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Deselectionner
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map((reg) => (
          <div
            key={reg.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors relative"
          >
            {/* Checkbox */}
            <div
              className="absolute top-3 left-3 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected.has(reg.id)}
                onChange={() => toggleSelect(reg.id)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            <Link
              href={`/admin/badges/${reg.id}`}
              className="block"
            >
              <div className="h-1.5" style={{ backgroundColor: reg.team.color }} />
              <div className="p-3 flex flex-col items-center text-center">
                {reg.photo ? (
                  <img
                    src={`/api/files/${reg.photo}`}
                    alt={`${reg.firstName} ${reg.lastName}`}
                    className="w-14 h-14 rounded-full object-cover mb-2"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-lg text-slate-400 mb-2">
                    {reg.firstName[0]}{reg.lastName[0]}
                  </div>
                )}
                <span className="font-semibold text-sm leading-tight">{reg.lastName} {reg.firstName}</span>
                <p className="text-slate-500 text-xs mt-0.5 truncate w-full">{reg.structure}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: reg.team.color }} />
                  <span className="text-xs text-slate-500">{reg.team.name}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {reg.allAccessGranted && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded">ALL ACCESS</span>
                  )}
                  {reg.badgePrinted ? (
                    <span className="text-[10px] text-emerald-600 font-medium">Imprime</span>
                  ) : (
                    <span className="text-[10px] text-amber-500">Non imprime</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-slate-500">Aucun badge trouve.</p>
      )}
    </div>
  );
}
