"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScanResult as ScanResultPanel } from "./ScannerFrame";
import { CatPill } from "@/components/ui/Labels";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { QrCamera } from "./QrCamera";

type ScanResult = {
  authorized: boolean;
  registration?: {
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    category: { name: string; color: string; number: number };
  };
  error?: string;
  message?: string;
  scannedAt: Date;
};

export function QRScanner({ orgId, eventId }: { orgId: string; eventId: string }) {
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [last, setLast] = useState<ScanResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualPayload, setManualPayload] = useState("");

  // La carte de résultat est l'unique retour de succès (pas de toast). Une erreur réseau ou une
  // réponse non JSON lève : toast de repli, et le hook libère le verrou (garde anti double scan).
  const { run: verifyPayload, pending: busy } = useAsyncAction(
    async (payload: string) => {
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/scan/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const json = await res.json();
      const result: ScanResult = {
        authorized: json.authorized ?? false,
        registration: json.registration,
        error: json.error,
        message: json.message,
        scannedAt: new Date(),
      };
      setLast(result);
      setHistory((h) => [result, ...h].slice(0, 10));
      setManualPayload("");
    },
    { error: "Vérification impossible. Réessayez." },
  );

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualPayload) return;
    await verifyPayload(manualPayload);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <Icon name="scan-line" size={16} /> {manualMode ? "Saisie manuelle" : "Caméra active"}
          </span>
          <Button variant="secondary" onClick={() => setManualMode((m) => !m)}>
            {manualMode ? "Activer la caméra" : "Saisie manuelle"}
          </Button>
        </div>

        {manualMode ? (
          <form onSubmit={submitManual} className="flex gap-2">
            <div className="flex-1">
              <Input
                value={manualPayload}
                onChange={(e) => setManualPayload(e.target.value)}
                placeholder="ID de badge ou contenu QR"
              />
            </div>
            <Button type="submit" loading={busy} disabled={!manualPayload}>
              Vérifier
            </Button>
          </form>
        ) : (
          <QrCamera
            elementId="qr-scanner-container"
            onDecode={verifyPayload}
            className="mx-auto max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-2"
          />
        )}
      </div>

      <div className="space-y-6">
        {last ? (
          <ScanResultPanel
            valid={last.authorized}
            title={
              last.authorized
                ? "Accès autorisé"
                : last.error === "FOREIGN_EVENT"
                  ? "Badge d'un autre événement"
                  : "Accès refusé"
            }
          >
            {last.message && <p className="mt-1 text-sm text-slate-600">{last.message}</p>}
            {last.registration && (
              <div className="mt-3 space-y-2">
                <div className="text-base font-semibold text-navy">
                  {last.registration.firstName} {last.registration.lastName}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <CatPill
                    color={last.registration.category.color}
                    label={`#${last.registration.category.number} ${last.registration.category.name}`}
                  />
                  <StatusBadge status={last.registration.status as "PENDING" | "APPROVED" | "REJECTED"} />
                </div>
              </div>
            )}
          </ScanResultPanel>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            Aucun scan pour le moment.
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy">Historique de session</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {history.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">Aucun scan.</p>
            ) : (
              history.map((h, i) => (
                <div key={i} className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${h.authorized ? "bg-turquoise" : "bg-rose-500"}`} />
                    {h.registration ? `${h.registration.firstName} ${h.registration.lastName}` : h.error ?? "?"}
                  </span>
                  <span className="text-xs tabular-nums text-slate-400">{h.scannedAt.toLocaleTimeString("fr-FR")}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
