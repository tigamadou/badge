"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

type ScannerLike = { clear: () => Promise<void> };

export function QRScanner({ orgId, eventId }: { orgId: string; eventId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<ScannerLike | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [last, setLast] = useState<ScanResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualPayload, setManualPayload] = useState("");
  const [busy, setBusy] = useState(false);

  async function verifyPayload(payload: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/scan/verify`, {
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
    setBusy(false);
  }

  useEffect(() => {
    if (manualMode) return;
    let cancelled = false;
    (async () => {
      const mod = await import("html5-qrcode");
      if (cancelled || !containerRef.current) return;
      const scanner = new mod.Html5QrcodeScanner(
        containerRef.current.id,
        { fps: 10, qrbox: 250 },
        false,
      );
      scanner.render(
        (decoded: string) => {
          verifyPayload(decoded);
        },
        () => {
          /* ignore frame errors */
        },
      );
      scannerRef.current = scanner as unknown as ScannerLike;
    })();
    return () => {
      cancelled = true;
      try {
        scannerRef.current?.clear();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMode, orgId, eventId]);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualPayload) return;
    await verifyPayload(manualPayload);
    setManualPayload("");
  }

  const resultClass = last
    ? last.authorized
      ? "border-green-400 bg-green-50"
      : "border-red-400 bg-red-50"
    : "border-gray-200 bg-white";

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Scanner</h2>
        <Button variant="secondary" onClick={() => setManualMode((m) => !m)}>
          {manualMode ? "Activer la caméra" : "Saisie manuelle"}
        </Button>
      </div>

      {manualMode ? (
        <form onSubmit={submitManual} className="bg-white border rounded p-3 flex gap-2">
          <Input
            value={manualPayload}
            onChange={(e) => setManualPayload(e.target.value)}
            placeholder="ID de badge ou contenu QR"
          />
          <Button type="submit" disabled={busy || !manualPayload}>
            Vérifier
          </Button>
        </form>
      ) : (
        <div id="qr-scanner-container" ref={containerRef} className="bg-white border rounded p-2" />
      )}

      <div className={`rounded border p-4 ${resultClass}`}>
        {last ? (
          <>
            <div className="text-lg font-bold">
              {last.authorized
                ? "Entrée autorisée"
                : last.error === "FOREIGN_EVENT"
                ? "Badge d'un autre événement"
                : "Refusé"}
            </div>
            {last.message && <div className="text-sm">{last.message}</div>}
            {last.registration && (
              <div className="mt-2">
                <div className="font-semibold">
                  {last.registration.firstName} {last.registration.lastName}
                </div>
                <div className="text-sm text-gray-600">
                  Catégorie : #{last.registration.category.number} {last.registration.category.name}
                </div>
                <div className="text-sm">Statut : {last.registration.status}</div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500">Aucun scan pour le moment.</div>
        )}
      </div>

      <section>
        <h3 className="font-semibold mb-2">Historique session</h3>
        <ul className="bg-white border rounded divide-y text-sm">
          {history.length === 0 && <li className="px-3 py-2 text-gray-500">—</li>}
          {history.map((h, i) => (
            <li key={i} className="px-3 py-2 flex justify-between">
              <span>{h.registration ? `${h.registration.firstName} ${h.registration.lastName}` : h.error ?? "?"}</span>
              <span className={h.authorized ? "text-green-700" : "text-red-700"}>
                {h.authorized ? "OK" : "Refusé"} — {h.scannedAt.toLocaleTimeString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
