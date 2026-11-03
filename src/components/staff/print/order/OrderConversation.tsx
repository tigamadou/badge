"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { attachmentName, lineChangesOf } from "@/components/print/PrintThread";
import { OrderComposer } from "./OrderComposer";
import { afterParam, mergeEntries, type OrderEntry } from "./order-thread";

export const ORDER_POLL_MS = 10_000;

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

function Attachment({ fileKey }: { fileKey: string }) {
  return (
    <a
      href={`/api/files/${fileKey}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-1.5 text-[13px] text-green-700 hover:underline"
    >
      <Icon name="file" size={14} />
      <span className="break-all">{attachmentName(fileKey)}</span>
    </a>
  );
}

function Entry({ entry }: { entry: OrderEntry }) {
  const meta = `${entry.authorName ?? ""}${entry.authorName ? " · " : ""}${formatDateTime(entry.createdAt)}`;
  if (entry.kind === "EVENT") {
    const changes = lineChangesOf(entry);
    return (
      <div className="flex justify-center" data-entry-kind={entry.internal ? "internal-event" : "event"}>
        <div
          className={`max-w-[90%] rounded-lg px-3 py-1.5 text-center text-[13px] ${
            entry.internal ? "border border-amber-200 bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-600"
          }`}
        >
          {entry.internal ? <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide">Interne</span> : null}
          {changes.length > 1 ? (
            <>
              <span>{entry.body}</span>
              <ul className="list-disc pl-4 text-left">
                {changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          ) : (
            <span className="whitespace-pre-wrap break-words">{entry.body}</span>
          )}
          <div className="text-[11px] opacity-70">{meta}</div>
        </div>
      </div>
    );
  }
  const mine = entry.side === "STAFF";
  const tone = entry.internal
    ? "border border-amber-300 bg-amber-50 text-amber-950"
    : mine
      ? "bg-green-600 text-white"
      : "bg-slate-100 text-slate-900";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} data-entry-kind={entry.internal ? "internal-note" : "message"}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${tone}`}>
        {entry.internal ? (
          <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide">Note interne</div>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{entry.body}</p>
        {entry.attachmentKey ? <Attachment fileKey={entry.attachmentKey} /> : null}
        <div className={`mt-0.5 text-[11px] ${mine && !entry.internal ? "text-green-100" : "text-slate-500"}`}>{meta}</div>
      </div>
    </div>
  );
}

// Fil de la commande côté staff : bulles (staff à droite, organisateur à gauche), évènements
// centrés, notes internes sur fond ambré. Polling toutes les 10 s, onglet visible seulement ;
// chaque lecture marque le fil comme lu (GET …/messages). Textes rendus en texte, jamais en HTML.
export function OrderConversation({
  messagesUrl,
  uploadUrl,
  canPost,
  refreshKey,
  onFirstRead,
}: {
  messagesUrl: string;
  uploadUrl: string;
  canPost: boolean;
  // Changé par l'écran après une action : recharge tout le fil sans attendre le polling.
  refreshKey: number;
  // Appelé une fois le fil lu pour la première fois (le fil est alors marqué lu : menu à rafraîchir).
  onFirstRead?: () => void;
}) {
  const [entries, setEntries] = useState<OrderEntry[] | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const known = useRef<OrderEntry[]>([]);
  const announced = useRef(false);

  const absorb = useCallback((incoming: OrderEntry[]) => {
    const before = known.current;
    const knownIds = new Set(before.map((e) => e.id));
    const fresh = incoming.filter((e) => !knownIds.has(e.id));
    const next = mergeEntries(before, incoming);
    known.current = next;
    setEntries(next);
    if (before.length > 0 && fresh.length > 0 && !stick.current) setHasNew(true);
  }, []);

  // `full` : relecture complète (premier chargement, après une action) ; sinon, depuis `after`.
  const load = useCallback(
    async (full: boolean) => {
      try {
        const after = full ? null : afterParam(known.current);
        const res = await fetch(after ? `${messagesUrl}?after=${encodeURIComponent(after)}` : messagesUrl);
        if (!res.ok) return;
        absorb(((await res.json()) as { entries: OrderEntry[] }).entries);
        if (!announced.current) {
          announced.current = true;
          onFirstRead?.();
        }
      } catch {
        // Le prochain tour réessaie.
      }
    },
    [messagesUrl, absorb, onFirstRead],
  );

  useEffect(() => {
    void load(true);
  }, [load, refreshKey]);
  useVisibleInterval(() => void load(false), ORDER_POLL_MS);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [entries]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (stick.current) setHasNew(false);
  }

  function jumpToEnd() {
    const el = scroller.current;
    if (!el) return;
    stick.current = true;
    el.scrollTop = el.scrollHeight;
    setHasNew(false);
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative">
        <div
          ref={scroller}
          onScroll={onScroll}
          aria-label="Fil de la commande"
          className="max-h-[60vh] min-h-48 space-y-2.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 lg:max-h-[calc(100vh-22rem)]"
        >
          {entries === null ? (
            <p className="text-sm text-slate-400">Chargement…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun échange pour le moment.</p>
          ) : (
            entries.map((entry) => <Entry key={entry.id} entry={entry} />)
          )}
        </div>
        {hasNew ? (
          <button
            type="button"
            onClick={jumpToEnd}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white shadow"
          >
            Nouveaux messages
          </button>
        ) : null}
      </div>
      {canPost ? (
        <OrderComposer
          postUrl={messagesUrl}
          uploadUrl={uploadUrl}
          onSent={(entry) => {
            stick.current = true;
            absorb([entry]);
          }}
        />
      ) : null}
    </div>
  );
}
