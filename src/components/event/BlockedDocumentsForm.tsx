"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { ActionButton } from "@/components/ui/ActionButton";
import { Icon } from "@/components/ui/Icon";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { TableFrame } from "@/components/ui/TableFrame";

type Row = { id: string; documentNumber: string; reason: string | null; createdAt: string };

export function BlockedDocumentsForm({
  orgId,
  eventId,
  rows,
  footer,
}: {
  orgId: string;
  eventId: string;
  rows: Row[];
  footer?: ReactNode;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState("");
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Les lignes viennent de la page serveur (tranche de l'URL) : on la relit apres chaque mutation.
  async function refresh() {
    router.refresh();
  }

  // Motif C : « déjà bloqué » (409) est rattaché au champ ; le reste lève une exception (toast).
  const add = useAsyncAction(
    async (): Promise<{ fieldError?: string }> => {
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/blocked-documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentNumber: doc, reason: reason || undefined }),
      });
      if (res.status === 409) return { fieldError: "Ce document est déjà bloqué." };
      if (!res.ok) throw res;
      return {};
    },
    {
      error: "Échec de l'ajout.",
      onSuccess: async (result) => {
        if (result.fieldError) {
          setFieldError(result.fieldError);
          return;
        }
        setFieldError(null);
        setDoc("");
        setReason("");
        toastSuccess("Document bloqué.");
        await refresh();
      },
    },
  );

  async function remove(id: string) {
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/blocked-documents/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw res;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFieldError(null);
              void add.run();
            }}
            className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <Input label="Numéro de pièce à bloquer" value={doc} error={fieldError ?? undefined} onChange={(e) => setDoc(e.target.value)} required />
            </div>
            <div className="flex-1">
              <Input label="Raison (optionnelle)" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button type="submit" variant="danger" loading={add.pending}>
              Bloquer
            </Button>
          </form>
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
                  <ActionButton
                    variant="link"
                    confirm="Retirer ce document de la liste de blocage ?"
                    action={() => remove(r.id)}
                    success="Document retiré de la liste."
                    error="Échec du retrait."
                    onSuccess={() => void refresh()}
                    aria-label="Retirer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:no-underline"
                  >
                    <Icon name="trash-2" size={15} />
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
      {footer}
    </div>
  );
}
