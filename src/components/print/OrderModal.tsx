"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";

// `ui/Dialog` est limité à 2xl : le devis éditable et la liste des badges demandent plus de largeur.
export function OrderModalPanel({
  title,
  onClose,
  size = "md",
  children,
  footer,
  closeRef,
}: {
  title: string;
  onClose: () => void;
  size?: "md" | "xl";
  children: ReactNode;
  footer?: ReactNode;
  closeRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ${
          size === "xl" ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="flex flex-none items-center justify-between border-b border-slate-200 px-5 py-4">
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
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-600">{children}</div>
        {footer ? <div className="flex flex-none flex-wrap justify-end gap-3 border-t border-slate-200 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function OrderModal({
  open,
  title,
  onClose,
  size,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  size?: "md" | "xl";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <OrderModalPanel title={title} onClose={onClose} size={size} footer={footer} closeRef={closeRef}>
      {children}
    </OrderModalPanel>,
    document.body,
  );
}
