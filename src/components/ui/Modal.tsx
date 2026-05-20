"use client";

import { ReactNode } from "react";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
}

export function Modal({
  open,
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmer",
  confirmVariant = "primary",
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
        <div className="mb-6">{children}</div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
