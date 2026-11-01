"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { Icon } from "@/components/ui/Icon";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { describeLineChange, type LineChange } from "@/lib/print-requests/line-change";

export type ThreadEntry = {
  id: string;
  side: "ORGANIZER" | "STAFF" | "SYSTEM";
  kind: "MESSAGE" | "EVENT";
  body: string;
  eventType: string | null;
  details: unknown;
  attachmentKey: string | null;
  authorName: string | null;
  createdAt: string;
};

export const THREAD_REFRESH_MS = 30_000;

const SIDE_LABELS = { ORGANIZER: "Organisateur", STAFF: "Équipe Badge", SYSTEM: "Système" } as const;

// Modifications de lignes d'une entrée LINES_CHANGED (détails regroupés côté serveur).
export function lineChangesOf(entry: Pick<ThreadEntry, "eventType" | "details">): string[] {
  if (entry.eventType !== "LINES_CHANGED") return [];
  const changes = (entry.details as { changes?: unknown } | null)?.changes;
  return Array.isArray(changes) ? (changes as LineChange[]).map(describeLineChange) : [];
}

// Nom du fichier joint = dernier segment de la clé de stockage.
export const attachmentName = (key: string): string => key.split("/").pop() ?? key;

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

// Fil de discussion d'une demande. Tous les textes (corps, noms de fichiers) sont rendus en texte
// par React : jamais de HTML injecté.
export function PrintThread({
  entriesUrl,
  postUrl,
  uploadUrl,
  placeholder = "Écrire un message à l'équipe Badge…",
  refreshKey = 0,
}: {
  entriesUrl: string;
  postUrl: string | null;
  uploadUrl: string | null;
  placeholder?: string;
  // Changé par l'écran après une action (ex. côté staff) : recharge le fil sans attendre le tour suivant.
  refreshKey?: number;
}) {
  const [entries, setEntries] = useState<ThreadEntry[] | null>(null);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<{ key: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Rechargement silencieux : en cas d'échec, le prochain tour réessaie.
  const load = useCallback(
    () =>
      fetch(entriesUrl)
        .then((res) => (res.ok ? (res.json() as Promise<{ entries: ThreadEntry[] }>) : null))
        .then((data) => {
          if (data) setEntries(data.entries);
        })
        .catch(() => undefined),
    [entriesUrl],
  );

  useEffect(() => {
    void load();
  }, [load, refreshKey]);
  useVisibleInterval(() => void load(), THREAD_REFRESH_MS);

  async function upload(file: File) {
    if (!uploadUrl) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      if (!res.ok) throw res;
      // La route staff ne renvoie pas originalName : on garde alors le nom du fichier choisi.
      const data = (await res.json()) as { storageKey: string; originalName?: string };
      setAttachment({ key: data.storageKey, name: data.originalName ?? file.name });
    } finally {
      setUploading(false);
    }
  }
  const { run: runUpload } = useAsyncAction(upload, { error: "Le fichier n'a pas pu être envoyé." });

  const { run: send, pending } = useAsyncAction(
    async () => {
      const res = await fetch(postUrl as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, ...(attachment ? { attachmentKey: attachment.key } : {}) }),
      });
      if (!res.ok) throw res;
    },
    {
      error: "Le message n'a pas pu être envoyé.",
      onSuccess: () => {
        setBody("");
        setAttachment(null);
        void load();
      },
    },
  );

  return (
    <div>
      {entries === null ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun échange pour le moment.</p>
      ) : (
        <Timeline>
          {entries.map((entry) => {
            const changes = lineChangesOf(entry);
            const isMessage = entry.kind === "MESSAGE";
            const author = entry.authorName ?? SIDE_LABELS[entry.side];
            return (
              <TimelineItem
                key={entry.id}
                tone={isMessage ? (entry.side === "STAFF" ? "warn" : "ok") : "default"}
                title={
                  <>
                    {isMessage ? <span className="mr-1.5">{author}</span> : null}
                    {changes.length > 1 ? (
                      // Entrée regroupée : le résumé (« n lignes modifiées »), puis le détail.
                      <>
                        <span className="text-slate-600">{entry.body}</span>
                        <ul className="list-disc pl-4 font-normal text-slate-600">
                          {changes.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <span className={`whitespace-pre-wrap break-words ${isMessage ? "block font-normal" : "text-slate-600"}`}>
                        {entry.body}
                      </span>
                    )}
                    {entry.attachmentKey ? (
                      <a
                        href={`/api/files/${entry.attachmentKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1.5 text-[13px] font-normal text-green-700 hover:underline"
                      >
                        <Icon name="file" size={14} />
                        <span className="break-all">{attachmentName(entry.attachmentKey)}</span>
                      </a>
                    ) : null}
                  </>
                }
                meta={`${isMessage ? SIDE_LABELS[entry.side] : "Automatique"} · ${formatDateTime(entry.createdAt)}`}
              />
            );
          })}
        </Timeline>
      )}

      {postUrl ? (
        <form
          className="mt-5 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) void send();
          }}
        >
          <label htmlFor="print-thread-body" className="sr-only">
            Votre message
          </label>
          <textarea
            id="print-thread-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={3}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {attachment ? (
            <div className="flex items-center gap-2 text-[13px] text-slate-600">
              <Icon name="file" size={14} />
              <span className="break-all">{attachment.name}</span>
              <button type="button" className="text-rose-600" onClick={() => setAttachment(null)}>
                Retirer
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {uploadUrl ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void runUpload(file);
                  }}
                />
                <Button type="button" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                  Joindre un fichier
                </Button>
              </>
            ) : null}
            <Button type="submit" loading={pending} disabled={!body.trim()}>
              Envoyer
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
