"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import type { ThreadEntryDTO } from "@/lib/print-requests/thread";
import { formatFcfa } from "@/lib/print-requests/labels";
import { entryTone, toneClasses } from "@/components/print/entry-tone";
import { indexQuoteEntries, parseQuoteMessage } from "@/components/print/quote-message";
import { QuoteMessageCard, type QuoteCardLine } from "@/components/print/QuoteMessageCard";
import { quoteCardOf } from "@/components/print/PrintThread";
import { OrganizerComposer } from "./OrganizerComposer";
import { POLL_MS, attachmentName, entriesUrlAfter, lineChangesOf, mergeEntries } from "./thread-sync";

const NEAR_BOTTOM_PX = 80;

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

function Attachment({ attachmentKey }: { attachmentKey: string }) {
  return (
    <a
      href={`/api/files/${attachmentKey}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-1.5 text-[13px] text-green-700 hover:underline"
    >
      <Icon name="file" size={14} />
      <span className="break-all">{attachmentName(attachmentKey)}</span>
    </a>
  );
}

function SystemEvent({
  entry,
  recapRows,
  currentQuote,
}: {
  entry: ThreadEntryDTO;
  recapRows: Map<number, string[]>;
  currentQuote?: { version: number; lines: QuoteCardLine[] };
}) {
  const card = quoteCardOf(entry, currentQuote);
  if (card) {
    return (
      <div data-testid="thread-quote" className="mx-auto w-full max-w-[95%]">
        <QuoteMessageCard
          version={card.version}
          total={formatFcfa(card.total)}
          rows={recapRows.get(card.version) ?? []}
          lines={card.lines ?? undefined}
        />
        <div className="mt-0.5 text-center text-[11px] text-slate-400">{formatDateTime(entry.createdAt)}</div>
      </div>
    );
  }
  const changes = lineChangesOf(entry);
  return (
    <div data-testid="thread-event" className="mx-auto max-w-[90%] rounded-lg bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-500">
      <span className="whitespace-pre-wrap break-words">{entry.body}</span>
      {changes.length > 1 ? (
        <ul className="mt-1 list-disc pl-4 text-left">
          {changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(entry.createdAt)}</div>
    </div>
  );
}

function Bubble({ entry }: { entry: ThreadEntryDTO }) {
  const mine = entry.side === "ORGANIZER";
  const tone = toneClasses[entryTone(entry, "ORGANIZER")];
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        data-testid={mine ? "bubble-organizer" : "bubble-staff"}
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "rounded-br-sm" : "rounded-bl-sm"} ${tone}`}
      >
        <div className="mb-0.5 text-[11px] font-medium text-slate-500">
          {entry.authorName ?? (mine ? "Vous" : "Équipe Badge")}
        </div>
        {entry.body ? <div className="whitespace-pre-wrap break-words">{entry.body}</div> : null}
        {entry.attachmentKey ? (
          <Attachment attachmentKey={entry.attachmentKey} />
        ) : null}
        <div className="mt-0.5 text-[11px] text-slate-400">
          {formatDateTime(entry.createdAt)}
        </div>
      </div>
    </div>
  );
}

// Fil de la commande côté organisateur : relevé toutes les 10 s (suspendu onglet caché), défilement
// automatique si le lecteur est en bas, sinon indicateur « Nouveaux messages ».
export function OrganizerConversation({
  entriesUrl,
  postUrl,
  uploadUrl,
  initialEntries,
  currentQuote,
}: {
  entriesUrl: string;
  postUrl: string | null;
  uploadUrl: string;
  initialEntries: ThreadEntryDTO[];
  // Lignes du devis courant : repli de la carte quand l'évènement n'embarque pas ses lignes.
  currentQuote?: { version: number; lines: QuoteCardLine[] };
}) {
  const [entries, setEntries] = useState<ThreadEntryDTO[]>(initialEntries);
  const [unseen, setUnseen] = useState(false);
  const router = useRouter();
  const routerRef = useRef(router);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const entriesRef = useRef(entries);
  const inflight = useRef(false);

  const absorb = useCallback((incoming: ThreadEntryDTO[], mine = false) => {
    setEntries((current) => {
      const merged = mergeEntries(current, incoming);
      if (merged.length === current.length) return current;
      if (mine) stickRef.current = true;
      else if (!stickRef.current) setUnseen(true);
      entriesRef.current = merged;
      return merged;
    });
  }, []);

  // Relevé silencieux : en cas d'échec, le tour suivant réessaie.
  const poll = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch(entriesUrlAfter(entriesUrl, entriesRef.current));
      if (!res.ok) return;
      const data = (await res.json()) as { entries: ThreadEntryDTO[] };
      // Le chevauchement renvoie des entrées déjà connues : seules les nouvelles comptent.
      const known = new Set(entriesRef.current.map((e) => e.id));
      if (data.entries.some((e) => !known.has(e.id))) {
        absorb(data.entries);
        // La lecture est enregistrée par l'API : le compteur du menu (layout) se met à jour.
        routerRef.current.refresh();
      }
    } catch {
      // réessayé au prochain tour
    } finally {
      inflight.current = false;
    }
  }, [entriesUrl, absorb]);
  useVisibleInterval(() => void poll(), POLL_MS);

  // La page vient d'enregistrer la lecture : le compteur du menu (layout) se met à jour.
  // Une seule fois : l'identité de `router` peut changer à chaque rafraîchissement (boucle).
  useEffect(() => {
    routerRef.current.refresh();
  }, []);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [entries]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (stickRef.current) setUnseen(false);
  }

  function scrollToEnd() {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stickRef.current = true;
    setUnseen(false);
  }

  const { versions: quoteVersions, rows: recapRows } = indexQuoteEntries(entries);

  return (
    <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={onScroll}
          data-testid="thread-list"
          className="h-full space-y-3 overflow-y-auto p-4"
        >
          {entries.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun échange pour le moment.</p>
          ) : (
            entries.map((entry) => {
              if (entry.kind === "EVENT") {
                return <SystemEvent key={entry.id} entry={entry} recapRows={recapRows} currentQuote={currentQuote} />;
              }
              // Le récapitulatif d'une version annoncée est porté par la carte de l'évènement.
              const recap = parseQuoteMessage(entry.body);
              if (recap && quoteVersions.has(recap.version)) return null;
              return <Bubble key={entry.id} entry={entry} />;
            })
          )}
        </div>
        {unseen ? (
          <button
            type="button"
            onClick={scrollToEnd}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white shadow hover:bg-green-700"
          >
            Nouveaux messages
          </button>
        ) : null}
      </div>
      {postUrl ? (
        <OrganizerComposer postUrl={postUrl} uploadUrl={uploadUrl} onPosted={(entry) => absorb([entry], true)} />
      ) : null}
    </div>
  );
}
