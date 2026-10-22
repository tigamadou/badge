"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { TableFrame } from "@/components/ui/TableFrame";

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
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/blocked-documents`);
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
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/blocked-documents`, {
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
      setError("Échec de l'ajout.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Retirer ce document de la liste de blocage ?")) return;
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/blocked-documents/${id}`, {
      method: "DELETE",
    });
    if (res.ok) await refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form onSubmit={add} className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <Input label="Numéro de pièce à bloquer" value={doc} onChange={(e) => setDoc(e.target.value)} required />
            </div>
            <div className="flex-1">
              <Input label="Raison (optionnelle)" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button type="submit" variant="danger">
              Bloquer
            </Button>
          </form>
          {error && (
            <div className="mt-3">
              <Alert tone="err">{error}</Alert>
            </div>
          )}
        </CardBody>
      </Card>

      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Raison</th>
              <th className="px-4 py-3">Depuis</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucun document bloqué.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-[13px] text-slate-900">{r.documentNumber}</td>
                <td className="px-4 py-3 text-[13px] text-slate-500">{r.reason ?? "—"}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-slate-400">
                  {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(r.id)}
                    aria-label="Retirer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Icon name="trash-2" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </div>
  );
}
