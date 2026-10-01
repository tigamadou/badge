"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

// Dialogue generique (meme habillage que Modal) : titre, bouton Fermer, corps, pied facultatif.
export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus sur Fermer a l'ouverture seulement.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Echap ferme la fenetre ; l'ecouteur suit la derniere version de onClose.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            ref={closeRef}
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 text-sm text-slate-600">{children}</div>
        {footer ? <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
