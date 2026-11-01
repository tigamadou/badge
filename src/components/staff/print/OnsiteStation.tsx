"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeDocumentView } from "@/components/badge/BadgeDocumentView";
import { OnsiteCounterCard } from "@/components/print/OnsiteCounterCard";
import { QrCamera } from "@/components/event/QrCamera";
import { ScannerFrame } from "@/components/event/ScannerFrame";
import { Button } from "@/components/ui/Button";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { Alert } from "@/components/ui/Feedback";
import { Input } from "@/components/ui/Input";
import { CatPill } from "@/components/ui/Labels";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { badgeDocumentUrl } from "@/lib/badge-document-client";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";
import {
  alreadyPrintedLabel,
  fetchOnsiteRefusal,
  type OnsiteRefusal,
} from "@/lib/print-requests/onsite-station-view";
import { toastError, toastSuccess } from "@/lib/toast";
import { requestUrl } from "./request-fetch";

// Fiche telle que la renvoient les routes du poste (dates sérialisées en ISO).
type StationCard = {
  id: string;
  snapshotFirstName: string;
  snapshotLastName: string;
  snapshotEmail: string;
  snapshotPhoto: string;
  category: { name: string; color: string };
  badgePrinted: boolean;
  badgePrintedAt: string | null;
};

export type OnsiteStationProps = {
  requestId: string;
  reference: string;
  orgId: string;
  eventId: string;
  eventTitle: string;
  location: string | null;
  printerNote: string | null;
  initialCounter: OnsiteCounter;
};

// Le contenu d'un QR d'accueil contient l'URL de vérification ; une saisie qui la contient est lue comme un QR.
const looksLikeQr = (text: string) => text.includes("/verify/");

// Poste d'impression sur place : le staff identifie un participant déjà approuvé et imprime
// son badge. Le poste n'inscrit et n'approuve personne.
export function OnsiteStation(props: OnsiteStationProps) {
  const { requestId, reference, orgId, eventId, eventTitle, location, printerNote } = props;
  const [counter, setCounter] = useState(props.initialCounter);
  const [card, setCard] = useState<StationCard | null>(null);
  const [refusal, setRefusal] = useState<OnsiteRefusal | null>(null);
  const [results, setResults] = useState<StationCard[] | null>(null);
  const [query, setQuery] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const { run: lookup, pending: looking } = useAsyncAction(async (payload: string) => {
    const res = await fetch(requestUrl(requestId, "/onsite/lookup"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: payload.trim().slice(0, 200) }),
    });
    setPdfUrl(null);
    if (!res.ok) {
      setCard(null);
      setRefusal(await fetchOnsiteRefusal(res));
      return;
    }
    const { registration } = (await res.json()) as { registration: StationCard };
    setRefusal(null);
    setResults(null);
    setCard(registration);
  }, { error: "Recherche impossible. Réessayez." });

  const { run: search, pending: searching } = useAsyncAction(async (q: string) => {
    const res = await fetch(`${requestUrl(requestId, "/onsite/search")}?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw res;
    setResults(((await res.json()) as { registrations: StationCard[] }).registrations);
  }, { error: "Recherche impossible. Réessayez." });

  const { run: print, pending: printing } = useAsyncAction(
    async (registrationId: string, confirmReprint: boolean, tab: Window | null) => {
      try {
        const res = await fetch(requestUrl(requestId, "/onsite/print"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ registrationId, confirmReprint }),
        });
        if (!res.ok) {
          tab?.close();
          const refused = await fetchOnsiteRefusal(res);
          if (refused.kind === "REPRINT") {
            // Le badge a été imprimé entre-temps : on recharge la fiche pour proposer la réimpression.
            await lookup(registrationId);
          } else {
            toastError(refused.message);
          }
          return;
        }
        const body = (await res.json()) as { print: { printedAt: string }; counter: OnsiteCounter; pdfUrl: string };
        setCounter(body.counter);
        setCard((c) => (c ? { ...c, badgePrinted: true, badgePrintedAt: body.print.printedAt } : c));
        setPdfUrl(body.pdfUrl);
        if (tab) tab.location.href = body.pdfUrl;
        toastSuccess(tab ? "Badge envoyé à l'impression" : "Badge prêt : ouvrez le PDF");
      } catch (err) {
        tab?.close();
        throw err;
      }
    },
    { error: "Impression impossible. Réessayez." },
  );

  // `window.open` doit partir du clic lui-même : après un `await`, le navigateur bloque la fenêtre.
  function onPrint(confirmReprint: boolean) {
    if (!card || printing) return;
    const tab = window.open("about:blank");
    void print(card.id, confirmReprint, tab);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const text = query.trim();
    if (looksLikeQr(text)) void lookup(text);
    else if (text.length >= 2) void search(text);
  }

  function pick(id: string) {
    void lookup(id);
  }

  const alreadyPrinted = card?.badgePrinted === true;
  const capReached = counter.level === "CAP_REACHED";

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/platform/print/requests/${requestId}`}
          className="text-[13px] text-slate-500 hover:text-slate-800"
        >
          ← Demande {reference}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Poste d&apos;impression · {reference}</h1>
        <p className="text-sm text-slate-500">
          {eventTitle}
          {location ? ` · ${location}` : ""}
        </p>
        {printerNote ? <p className="mt-1 text-sm text-slate-500">Imprimante : {printerNote}</p> : null}
      </div>

      <OnsiteCounterCard counter={counter} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">{cameraOn ? "Caméra active" : "Caméra désactivée"}</span>
            <Button variant="secondary" onClick={() => setCameraOn((v) => !v)}>
              {cameraOn ? "Désactiver la caméra" : "Activer la caméra"}
            </Button>
          </div>
          {cameraOn ? (
            <ScannerFrame>
              <QrCamera
                elementId="onsite-qr-camera"
                onDecode={(text) => void lookup(text)}
                className="absolute inset-0 overflow-hidden"
              />
            </ScannerFrame>
          ) : null}

          <form onSubmit={submitSearch} className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                aria-label="Nom, email, ID ou contenu du QR"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, email, ID ou contenu du QR"
              />
            </div>
            <Button type="submit" loading={searching || looking} disabled={query.trim().length < 2}>
              Rechercher
            </Button>
          </form>

          {results ? (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
              {results.length === 0 ? <li className="px-4 py-3 text-slate-400">Aucun résultat.</li> : null}
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {r.snapshotFirstName} {r.snapshotLastName}
                      </span>
                      <span className="block truncate text-xs text-slate-400">{r.snapshotEmail}</span>
                    </span>
                    {r.badgePrinted ? <span className="shrink-0 text-xs text-slate-400">Déjà imprimé</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-4">
          {refusal ? <Alert tone="err">{refusal.message}</Alert> : null}
          {card ? (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <DocumentPreview storageKey={card.snapshotPhoto} label="Photo" />
                <div className="min-w-0 space-y-1">
                  <div className="text-lg font-semibold text-slate-900">
                    {card.snapshotFirstName} {card.snapshotLastName}
                  </div>
                  <div className="truncate text-sm text-slate-500">{card.snapshotEmail}</div>
                  <CatPill color={card.category.color} label={card.category.name} />
                </div>
              </div>
              <BadgeDocumentView
                src={badgeDocumentUrl(orgId, eventId, card.id)}
                label={`Badge de ${card.snapshotFirstName} ${card.snapshotLastName}`}
                className="!h-[320px]"
              />
              {alreadyPrinted ? (
                <div className="space-y-2">
                  <Alert tone="warn">{alreadyPrintedLabel(card.badgePrintedAt)}</Alert>
                  <Button variant="secondary" loading={printing} onClick={() => onPrint(true)}>
                    Réimprimer
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button loading={printing} disabled={capReached} onClick={() => onPrint(false)}>
                    Imprimer
                  </Button>
                  {capReached ? (
                    <p className="text-xs text-rose-600">Plafond atteint : seules les réimpressions restent possibles.</p>
                  ) : null}
                </div>
              )}
              {pdfUrl ? (
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="block text-[13px] font-medium text-green-700 hover:underline">
                  Ouvrir le PDF
                </a>
              ) : null}
            </div>
          ) : !refusal ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
              Scannez le QR d&apos;accueil d&apos;un participant ou recherchez-le.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
