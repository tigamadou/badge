"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { Spinner } from "@/components/ui/Feedback";
import { formatEventDate } from "@/lib/format-date";
import { DocBody } from "./DocBody";

export interface PanelDoc {
  title: string;
  updatedAt: string;
  html: string;
  docsHref: string;
}

export type PanelState = { status: "loading" } | { status: "error" } | { status: "ready"; doc: PanelDoc };

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Contenu du panneau selon l'état de chargement (exporté pour les tests de rendu statique). */
export function PageDocPanelContent({ state, onRetry }: { state: PanelState; onRetry: () => void }): ReactNode {
  if (state.status === "loading") {
    return (
      <div className="flex justify-center py-10" role="status" aria-label="Chargement de l'aide">
        <Spinner />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 py-4 text-sm text-slate-600" role="alert">
        <p>La documentation de cette page n&apos;a pas pu être chargée.</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-navy hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
        >
          Réessayer
        </button>
      </div>
    );
  }
  return (
    <>
      <DocBody html={state.doc.html} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
        <span>Mise à jour le {formatEventDate(`${state.doc.updatedAt}T12:00:00`)}</span>
        <Link href={state.doc.docsHref} className="font-medium text-navy underline">
          Toute la documentation
        </Link>
      </div>
    </>
  );
}

/** Panneau latéral (plein écran sous `sm`) : focus piégé, Échap ferme. Le parent rend le focus au bouton. */
export function PageDocPanel({
  title,
  state,
  onClose,
  onRetry,
}: {
  title: string;
  state: PanelState;
  onClose: () => void;
  onRetry: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <PanelFrame title={title} panelRef={panelRef} closeRef={closeRef} onClose={onClose}>
      <PageDocPanelContent state={state} onRetry={onRetry} />
    </PanelFrame>,
    document.body,
  );
}

/** Calque et boîte du panneau (exporté pour les tests de rendu statique). */
export function PanelFrame({
  title,
  onClose,
  children,
  panelRef,
  closeRef,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  panelRef?: RefObject<HTMLDivElement | null>;
  closeRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-xl sm:max-w-md lg:max-w-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="min-w-0 truncate text-base font-semibold text-navy">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Fermer l'aide"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-mist hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
