"use client";

import { useEffect, useRef } from "react";

type ScannerLike = { clear: () => Promise<void> };

// Caméra de lecture de QR (html5-qrcode). Le scanner vit tant que le composant est monté ;
// `onDecode` peut changer d'un rendu à l'autre sans relancer la caméra.
export function QrCamera({
  elementId,
  onDecode,
  className,
}: {
  elementId: string;
  onDecode: (text: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onDecodeRef = useRef(onDecode);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  });

  useEffect(() => {
    let cancelled = false;
    let scanner: ScannerLike | null = null;
    (async () => {
      const mod = await import("html5-qrcode");
      if (cancelled || !containerRef.current) return;
      const instance = new mod.Html5QrcodeScanner(containerRef.current.id, { fps: 10, qrbox: 250 }, false);
      instance.render(
        (decoded: string) => {
          onDecodeRef.current(decoded);
        },
        () => {
          /* ignore frame errors */
        },
      );
      scanner = instance as unknown as ScannerLike;
    })();
    return () => {
      cancelled = true;
      try {
        scanner?.clear();
      } catch {
        /* ignore */
      }
    };
  }, [elementId]);

  return <div id={elementId} ref={containerRef} className={className} />;
}
