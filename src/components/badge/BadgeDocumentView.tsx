"use client";

import { useEffect, useRef, useState } from "react";
import type { PageViewElement } from "@tigamadou/pdf-engine/viewer";
import { PREVIEW_UNAVAILABLE, fetchBadgeDocument } from "@/lib/badge-document-client";

type Fetched = { key: string; src: string; error: string | null };

// Apercu d'un badge dans <page-view> (composant web du moteur). La route ne renvoie que
// des documents figes ; la vue ne recoit jamais un document vivant. <page-view> prend la
// hauteur de son parent (minimum 160 px) : le conteneur DOIT lui en donner une. Fond gris
// du studio pdfStudio (.cv-area) : la page blanche s'y detache.
export function BadgeDocumentView({ src, label, className }: { src: string; label: string; className?: string }) {
  const viewRef = useRef<PageViewElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const key = `${attempt}:${src}`;
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
    const controller = new AbortController();
    void (async () => {
      const result = await fetchBadgeDocument(src, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!result.ok) {
        // Par la ref : l'element n'est peut-etre pas encore enregistre.
        if (viewRef.current) viewRef.current.document = null;
        setFetched({ key, src, error: result.message });
        return;
      }
      const { definePageView } = await import("@tigamadou/pdf-engine/viewer");
      if (controller.signal.aborted) return;
      definePageView();
      // Propriete posee par la ref, apres l'enregistrement de l'element.
      if (viewRef.current) viewRef.current.document = result.document;
      setFetched({ key, src, error: null });
    })();
    return () => controller.abort();
  }, [src, attempt, key]);

  useEffect(() => {
    const view = viewRef.current;
    const onReady = () => setReadyKey(keyRef.current);
    view?.addEventListener("pe-ready", onReady);
    return () => view?.removeEventListener("pe-ready", onReady);
  }, []);

  // Etat derive : une reponse (ou un signal prêt) d'une autre requete ne compte pas.
  const failed = fetched?.key === key && fetched.error !== null;
  const state = failed ? "error" : readyKey === key ? "ready" : "loading";
  const shownSrc = fetched && fetched.error === null ? fetched.src : "";
  const message = fetched?.error ?? "";

  return (
    <div
      data-testid="badge-document"
      data-state={state}
      data-requested-src={src}
      data-src={shownSrc}
      className={`relative h-[70vh] max-h-[640px] w-full overflow-hidden rounded-xl border border-slate-200 bg-[#8b8b90] ${className ?? ""}`}
    >
      <page-view ref={viewRef} label={label} layout="all" fit="width" className="block h-full w-full" />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-[13px] text-slate-500">
          Chargement de l&apos;aperçu…
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white p-4 text-center">
          {message !== PREVIEW_UNAVAILABLE && <p className="text-[13px] text-slate-600">{message}</p>}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            {PREVIEW_UNAVAILABLE}
          </button>
        </div>
      )}
    </div>
  );
}
