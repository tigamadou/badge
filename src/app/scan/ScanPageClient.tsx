"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
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

const SCANNER_ID = "qr-reader";

export default function ScanPageClient() {
  const [operator, setOperator] = useState<{ name: string } | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrcodeRef = useRef<any>(null);
  const isProcessingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.name) setOperator({ name: data.user.name });
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopScanner = useCallback(async () => {
    try {
      if (html5QrcodeRef.current) {
        try {
          await html5QrcodeRef.current.stop();
        } catch {
          // ignore stop errors
        }
        try {
          html5QrcodeRef.current.clear();
        } catch {
          // ignore clear errors
        }
        html5QrcodeRef.current = null;
      }
    } catch {
      // ignore
    }
    if (mountedRef.current) setScanning(false);
  }, []);

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        await stopScanner();

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
      } catch {
        setError("Erreur de connexion au serveur");
      } finally {
        setLoading(false);
        isProcessingRef.current = false;
      }
    },
    [stopScanner],
  );

  const startScanner = useCallback(async () => {
    setError(null);

    // Clean up any previous instance
    await stopScanner();

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (!mountedRef.current) return;

      const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
      html5QrcodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          handleScan(decodedText);
        },
        () => {},
      );

      if (mountedRef.current) setScanning(true);
    } catch (err) {
      console.error("Failed to start scanner", err);
      if (mountedRef.current) {
        setError(
          err instanceof Error && err.message.includes("Permission")
            ? "Acces a la camera refuse. Veuillez autoriser l'acces dans les parametres du navigateur."
            : "Impossible de demarrer la camera. Verifiez que la camera n'est pas utilisee par une autre application.",
        );
        setScanning(false);
      }
    }
  }, [stopScanner, handleScan]);

  // Start scanner when camera is authorized by user gesture
  useEffect(() => {
    if (!cameraStarted) return;

    startScanner();

    return () => {
      stopScanner();
    };
  }, [cameraStarted, startScanner, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current) {
        try {
          html5QrcodeRef.current.stop().catch(() => {});
        } catch {
          // ignore
        }
        try {
          html5QrcodeRef.current.clear();
        } catch {
          // ignore
        }
        html5QrcodeRef.current = null;
      }
    };
  }, []);

  function resetScanner() {
    setScanResult(null);
    setError(null);
    setLoading(false);
    isProcessingRef.current = false;
    // Restart the scanner
    startScanner();
  }

  function startCameraFromUserGesture() {
    setError(null);
    setCameraStarted(true);
  }

  const showResults = !scanning && !loading && (scanResult || error) && cameraStarted;
  const showPrompt = !cameraStarted;
  const showScanner = cameraStarted && !showResults;

  // Result view data
  const valid = scanResult?.valid ?? false;
  const reg = scanResult?.registration;

  return (
    <>
      {/* Top bar with menu */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900 h-14 flex items-center justify-between px-4">
        <h1 className="text-white font-semibold">Scanner</h1>
        <div className="flex items-center gap-3">
          {operator && (
            <span className="text-sm text-slate-400 hidden sm:inline">
              {operator.name}
            </span>
          )}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-slate-300 hover:text-white transition-colors"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm" />
          <div className="relative flex flex-col items-center justify-center h-full px-6">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
              aria-label="Fermer le menu"
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <nav className="space-y-2 w-full max-w-xs">
              <Link
                href="/admin"
                className="block px-4 py-3 rounded-xl text-center text-base text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/registrations"
                className="block px-4 py-3 rounded-xl text-center text-base text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Inscriptions
              </Link>
              <Link
                href="/admin/badges"
                className="block px-4 py-3 rounded-xl text-center text-base text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Badges
              </Link>
              <div
                className="block px-4 py-3 rounded-xl text-center text-base bg-indigo-500/20 text-indigo-400 font-medium"
              >
                Scanner
              </div>
              <Link
                href="/admin/scan-history"
                className="block px-4 py-3 rounded-xl text-center text-base text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Historique Scans
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Prompt: user must tap to authorize camera */}
      {showPrompt && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 pt-14 p-4">
          <div className="w-full max-w-md mt-8 space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 text-center">Scanner Badge</h2>
            {operator && (
              <p className="text-center text-sm text-slate-500">
                Operateur :{" "}
                <span className="font-medium text-slate-700">
                  {operator.name}
                </span>
              </p>
            )}
            <p className="text-center text-slate-500 text-sm leading-relaxed">
              Pour scanner les QR codes, nous avons besoin d&apos;acceder a la
              camera. Apres avoir appuye sur le bouton ci-dessous, votre
              navigateur affichera une demande d&apos;autorisation — acceptez-la
              pour continuer.
            </p>
            <button
              type="button"
              onClick={startCameraFromUserGesture}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-lg rounded-xl transition-colors"
            >
              Autoriser la camera et scanner
            </button>
          </div>
        </div>
      )}

      {/* Result view */}
      {showResults && (
        <div
          className={`min-h-screen flex flex-col items-center pt-14 p-4 ${
            error ? "bg-rose-600" : valid ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          <div className="w-full max-w-md mt-8">
            <div className="text-center mb-6">
              <p className="text-5xl font-bold text-white mb-2">
                {error ? "\u2717" : valid ? "\u2713" : "\u2717"}
              </p>
              <h2 className="text-2xl font-semibold text-white">
                {error
                  ? "Erreur"
                  : valid
                    ? "Badge valide"
                    : "Badge non valide"}
              </h2>
              {error && (
                <p className="text-white/90 mt-2 text-lg">{error}</p>
              )}
            </div>

            {reg && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                {reg.photo && (
                  <div className="flex justify-center">
                    <img
                      src={`/api/files/${reg.photo}`}
                      alt={`${reg.firstName} ${reg.lastName}`}
                      className="w-28 h-28 rounded-full object-cover border-4 border-slate-200"
                    />
                  </div>
                )}

                <div className="text-center">
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {reg.lastName.toUpperCase()} {reg.firstName}
                  </h3>
                </div>

                {reg.structure && (
                  <p className="text-center text-slate-500 text-lg">
                    {reg.structure}
                  </p>
                )}

                <div className="flex items-center justify-center gap-2">
                  <span
                    className="inline-block w-4 h-4 rounded-full"
                    style={{ backgroundColor: reg.team.color }}
                  />
                  <span className="text-slate-700 font-medium">
                    {reg.team.name}
                  </span>
                </div>

                {reg.allAccessGranted && (
                  <div className="text-center">
                    <span className="inline-block px-4 py-1 bg-rose-50 text-rose-700 font-bold text-sm rounded-full uppercase tracking-wide">
                      All Access
                    </span>
                  </div>
                )}

                <div className="flex justify-center">
                  <StatusBadge status={reg.status} />
                </div>

                <p className="text-center text-xs text-slate-400 font-mono">
                  ID: {reg.id}
                </p>

                {scanResult?.scanLog && (
                  <p className="text-center text-xs text-slate-400">
                    Scanne le{" "}
                    {new Date(scanResult.scanLog.scannedAt).toLocaleString(
                      "fr-FR",
                    )}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={resetScanner}
              className="mt-6 w-full py-4 bg-white/20 hover:bg-white/30 text-white font-semibold text-lg rounded-xl transition-colors"
            >
              Scanner un autre badge
            </button>
          </div>
        </div>
      )}

      {/* Scanner view — the div#qr-reader MUST stay in the DOM while camera is active */}
      <div
        className={`min-h-screen flex flex-col items-center justify-center bg-slate-50 pt-14 p-4 ${
          showScanner ? "" : "hidden"
        }`}
      >
        <div className="w-full max-w-md mt-8">
          <h2 className="text-xl font-semibold text-slate-900 text-center mb-6">
            Scanner Badge
          </h2>
          {operator && (
            <p className="text-center text-sm text-slate-500 mb-4">
              Operateur :{" "}
              <span className="font-medium text-slate-700">
                {operator.name}
              </span>
            </p>
          )}

          {loading && (
            <div className="flex flex-col items-center mb-4">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-300 border-t-transparent" />
              <p className="text-sm text-slate-500 mt-2">Verification...</p>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden bg-black min-h-[300px]">
            <div id={SCANNER_ID} className="w-full min-h-[300px]" />
          </div>

          <p className="text-center text-slate-400 mt-6 text-sm">
            Placez le QR code du badge devant la camera
          </p>

          {error && (
            <div className="mt-4 p-4 bg-rose-50 rounded-xl text-center border border-rose-200">
              <p className="text-rose-600">{error}</p>
              <button
                type="button"
                onClick={resetScanner}
                className="mt-3 px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors text-sm"
              >
                Reessayer
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
