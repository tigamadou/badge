"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface ScanResult {
  valid: boolean;
  error?: string;
  registration?: {
    id: string;
    lastName: string;
    firstName: string;
    structure: string;
    photo: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    allAccessGranted: boolean;
    team: {
      name: string;
      color: string;
    };
  };
  scanLog?: {
    id: string;
    scannedAt: string;
  };
}

export default function ScanPage() {
  const [operator, setOperator] = useState<{ name: string } | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<unknown>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.name) setOperator({ name: data.user.name });
      });
  }, []);

  const handleScan = useCallback(async (decodedText: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Pause the scanner to prevent further callbacks
      const scanner = scannerRef.current as any;
      if (scanner) {
        try {
          const state = scanner.getState?.();
          // Only pause if scanner is actively scanning (state 2 = SCANNING)
          if (state === 2) {
            scanner.pause(true);
          }
        } catch {
          // Scanner may already be stopped/paused
        }
      }

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: decodedText }),
      });

      const data: ScanResult = await res.json();

      if (!res.ok && !data.valid && data.error) {
        setError(data.error);
        setScanResult(null);
      } else {
        setScanResult(data);
        setError(null);
      }

      setScanning(false);
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!scanning) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let html5Qrcode: any = null;
    let mounted = true;

    async function startScanner() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mounted) return;

      html5Qrcode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5Qrcode;

      try {
        await html5Qrcode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            handleScan(decodedText);
          },
          () => {
            // Scan error (no QR found in frame) - ignore
          },
        );
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error && err.message.includes("Permission")
              ? "Acces a la camera refuse. Veuillez autoriser l'acces."
              : "Impossible de demarrer la camera.",
          );
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (html5Qrcode) {
        try {
          const state = html5Qrcode.getState?.();
          // Only stop if scanning (2) or paused (3)
          if (state === 2 || state === 3) {
            html5Qrcode.stop().catch(() => {});
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [scanning, handleScan]);

  function resetScanner() {
    setScanResult(null);
    setError(null);
    setLoading(false);
    isProcessingRef.current = false;
    setScanning(true);
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4" />
        <p className="text-lg">Verification en cours...</p>
      </div>
    );
  }

  // Result state
  if (!scanning && (scanResult || error)) {
    const valid = scanResult?.valid ?? false;
    const reg = scanResult?.registration;

    return (
      <div
        className={`min-h-screen flex flex-col items-center p-4 ${
          error
            ? "bg-red-600"
            : valid
              ? "bg-green-600"
              : "bg-red-600"
        }`}
      >
        <div className="w-full max-w-md mt-8">
          {/* Status header */}
          <div className="text-center mb-6">
            <p className="text-5xl font-bold text-white mb-2">
              {error ? "\u2717" : valid ? "\u2713" : "\u2717"}
            </p>
            <h1 className="text-2xl font-bold text-white">
              {error
                ? "Erreur"
                : valid
                  ? "Badge valide"
                  : "Badge non valide"}
            </h1>
            {error && (
              <p className="text-white/90 mt-2 text-lg">{error}</p>
            )}
          </div>

          {/* Registration details */}
          {reg && (
            <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
              {/* Photo */}
              {reg.photo && (
                <div className="flex justify-center">
                  <img
                    src={`/api/files/${reg.photo}`}
                    alt={`${reg.firstName} ${reg.lastName}`}
                    className="w-28 h-28 rounded-full object-cover border-4 border-gray-200"
                  />
                </div>
              )}

              {/* Name */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {reg.lastName.toUpperCase()} {reg.firstName}
                </h2>
              </div>

              {/* Structure */}
              {reg.structure && (
                <p className="text-center text-gray-600 text-lg">
                  {reg.structure}
                </p>
              )}

              {/* Team / Category */}
              <div className="flex items-center justify-center gap-2">
                <span
                  className="inline-block w-4 h-4 rounded-full"
                  style={{ backgroundColor: reg.team.color }}
                />
                <span className="text-gray-800 font-medium">
                  {reg.team.name}
                </span>
              </div>

              {/* All Access */}
              {reg.allAccessGranted && (
                <div className="text-center">
                  <span className="inline-block px-4 py-1 bg-red-100 text-red-700 font-bold text-sm rounded-full uppercase tracking-wide">
                    All Access
                  </span>
                </div>
              )}

              {/* Status */}
              <div className="flex justify-center">
                <StatusBadge status={reg.status} />
              </div>

              {/* Badge ID */}
              <p className="text-center text-xs text-gray-400 font-mono">
                ID: {reg.id}
              </p>

              {/* Scan time */}
              {scanResult?.scanLog && (
                <p className="text-center text-xs text-gray-400">
                  Scanne le{" "}
                  {new Date(scanResult.scanLog.scannedAt).toLocaleString(
                    "fr-FR",
                  )}
                </p>
              )}
            </div>
          )}

          {/* Reset button */}
          <button
            onClick={resetScanner}
            className="mt-6 w-full py-4 bg-white/20 hover:bg-white/30 text-white font-semibold text-lg rounded-xl transition-colors"
          >
            Scanner un autre badge
          </button>
        </div>
      </div>
    );
  }

  // Scanner state
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black p-4">
      <div className="w-full max-w-md mt-8">
        <h1 className="text-2xl font-bold text-center mb-6">Scanner Badge</h1>
        {operator && (
          <p className="text-center text-sm text-gray-500 mb-4">
            Operateur : <span className="font-medium text-gray-700">{operator.name}</span>
          </p>
        )}

        <div className="rounded-2xl overflow-hidden bg-black">
          <div id="qr-reader" className="w-full" />
        </div>

        <p className="text-center text-gray-400 mt-6 text-sm">
          Placez le QR code du badge devant la camera
        </p>

        {error && (
          <div className="mt-4 p-4 bg-red-500/20 rounded-xl text-center">
            <p className="text-red-300">{error}</p>
            <button
              onClick={resetScanner}
              className="mt-3 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm"
            >
              Reessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
