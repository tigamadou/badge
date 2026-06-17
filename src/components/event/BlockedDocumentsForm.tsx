"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Row = { id: string; documentNumber: string; reason: string | null; createdAt: string };

export function BlockedDocumentsForm({
  orgId,
  eventId,
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [doc, setDoc] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/blocked-documents`);
    if (!res.ok) return;
    const j = (await res.json()) as {
      blocked: Array<{ id: string; documentNumber: string; reason: string | null; createdAt: string }>;
    };
    setRows(
      j.blocked.map((b) => ({
        ...b,
        createdAt: typeof b.createdAt === "string" ? b.createdAt : new Date(b.createdAt).toISOString(),
      })),
    );
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/blocked-documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentNumber: doc, reason: reason || undefined }),
    });
    if (res.ok) {
      setDoc("");
      setReason("");
      await refresh();
    } else if (res.status === 409) {
      setError("Ce document est deja bloque.");
    } else {
      setError("Echec de l&apos;ajout.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Retirer ce document de la liste de blocage ?")) return;
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/blocked-documents/${id}`, {
      method: "DELETE",
    });
    if (res.ok) await refresh();
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={add} className="bg-white border rounded p-4 space-y-2">
        <h2 className="font-semibold">Bloquer un document</h2>
        <Input
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
          placeholder="Numero de piece d&apos;identite"
          required
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Raison (optionnelle)"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit">Bloquer</Button>
      </form>
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Document</th>
            <th className="px-3 py-2">Raison</th>
            <th className="px-3 py-2">Depuis</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                Aucun document bloque.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.documentNumber}</td>
              <td className="px-3 py-2 text-gray-600">{r.reason ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-3 py-2 text-right">
                <Button variant="secondary" onClick={() => remove(r.id)}>
                  Retirer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
