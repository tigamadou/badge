"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { toastApiError, toastError } from "@/lib/toast";
import { requestUrl, staffRequest } from "./request-fetch";

type Entry = {
  id: string;
  side: "ORGANIZER" | "STAFF" | "SYSTEM";
  kind: "MESSAGE" | "EVENT";
  body: string;
  attachmentKey: string | null;
  authorName: string | null;
  createdAt: string;
};

const SIDE_LABEL = { ORGANIZER: "Organisateur", STAFF: "Équipe", SYSTEM: "Système" } as const;
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

// Fil d'échange côté staff. Les corps (messages et évènements) sont rendus en TEXTE seulement.
export function StaffThread({
  requestId,
  canPost,
  refreshKey,
}: {
  requestId: string;
  canPost: boolean;
  // Incrémenté par l'écran après une action : recharge le fil (ex. « 2 lignes modifiées »).
  refreshKey: number;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<{ key: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(requestUrl(requestId, "/messages"));
      if (!res.ok) throw res;
      const data = (await res.json()) as { entries: Entry[] };
      setEntries(data.entries);
    } catch (err) {
      await toastApiError(err);
      setEntries((prev) => prev ?? []);
    }
  }, [requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial et rechargement sur refreshKey
    void load();
  }, [load, refreshKey]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/platform/upload?context=print-request", { method: "POST", body: form });
      if (!res.ok) {
        await toastApiError(res, "Le fichier n'a pas pu être envoyé (JPEG, PNG, WebP ou PDF, 5 Mo maximum).");
        return;
      }
      const { storageKey } = (await res.json()) as { storageKey: string };
      setAttachment({ key: storageKey, name: file.name });
    } catch {
      toastError("Le fichier n'a pas pu être envoyé.");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    if (!body.trim() && !attachment) return;
    setSending(true);
    const res = await staffRequest(requestUrl(requestId, "/messages"), "POST", {
      body: body.trim(),
      attachmentKey: attachment?.key ?? null,
    });
    setSending(false);
    if (!res) return;
    setBody("");
    setAttachment(null);
    await load();
  }

  return (
    <Card>
      <CardHead title="Échanges" subtitle="Messages avec l'organisateur et historique de la demande" />
      <CardBody className="space-y-3">
        {entries === null ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun échange pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className={
                  e.kind === "EVENT"
                    ? "rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600"
                    : e.side === "STAFF"
                      ? "ml-6 rounded-lg bg-green-50 px-3 py-2 text-sm text-slate-800"
                      : "mr-6 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                }
              >
                <div className="mb-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                  <span className="font-medium">{e.authorName ?? SIDE_LABEL[e.side]}</span>
                  <span>{dateFmt.format(new Date(e.createdAt))}</span>
                </div>
                {/* Texte brut : jamais de HTML injecté. */}
                <p className="whitespace-pre-wrap break-words">{e.body}</p>
                {e.attachmentKey && (
                  <a
                    href={`/api/files/${e.attachmentKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-green-700 hover:underline"
                  >
                    <Icon name="file" size={14} /> Pièce jointe
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        {canPost && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <label htmlFor="staff-thread-body" className="sr-only">
              Votre message
            </label>
            <textarea
              id="staff-thread-body"
              rows={3}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Écrire à l'organisateur…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900">
                <Icon name="file" size={14} />
                {uploading ? "Envoi…" : "Joindre un fichier"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void upload(file);
                  }}
                />
              </label>
              {attachment && (
                <span className="inline-flex items-center gap-1 text-[13px] text-slate-600">
                  {attachment.name}
                  <button
                    type="button"
                    aria-label="Retirer la pièce jointe"
                    onClick={() => setAttachment(null)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </span>
              )}
              <Button
                type="button"
                className="ml-auto"
                loading={sending}
                disabled={uploading || (!body.trim() && !attachment)}
                onClick={() => void send()}
              >
                Envoyer
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
