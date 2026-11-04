"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  confirmLoading?: boolean;
}

export function Modal({
  open,
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmer",
  confirmVariant = "primary",
  confirmLoading = false,
}: ModalProps) {
  // Échap annule ; l'écouteur suit la dernière version de onCancel.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  // Pas de document au rendu serveur ; la modale ne s'ouvre de toute façon qu'après une interaction.
  if (!open || typeof document === "undefined") return null;

  // Portail dans body : le calque échappe aux ancêtres transformés (ex. tiroir de navigation mobile).
  return createPortal(
    <ModalPanel
      title={title}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmLabel={confirmLabel}
      confirmVariant={confirmVariant}
      confirmLoading={confirmLoading}
    >
      {children}
    </ModalPanel>,
    document.body,
  );
}

// Calque et boîte de la modale (exporté pour les tests de rendu statique).
export function ModalPanel({
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmer",
  confirmVariant = "primary",
  confirmLoading = false,
}: Omit<ModalProps, "open">) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-base font-semibold text-navy">{title}</h3>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 text-sm text-slate-600">{children}</div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant={confirmVariant} loading={confirmLoading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
