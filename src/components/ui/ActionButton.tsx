"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";

// Bouton d'action par ligne : chaque ligne a son propre état `pending`.
export function ActionButton<T>({
  action,
  success,
  error,
  confirm,
  onSuccess,
  variant = "secondary",
  className,
  disabled,
  "aria-label": ariaLabel,
  children,
}: {
  action: () => Promise<T>;
  success?: string;
  error?: string;
  confirm?: string;
  onSuccess?: (result: T) => void;
  variant?: "primary" | "secondary" | "danger" | "link";
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  children: ReactNode;
}) {
  const { run, pending } = useAsyncAction(action, { success, error, onSuccess });
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={disabled}
      loading={pending}
      aria-label={ariaLabel}
      onClick={() => {
        // L'annulation du confirm natif ne lance ni requête ni toast.
        if (confirm && !window.confirm(confirm)) return;
        void run();
      }}
    >
      {children}
    </Button>
  );
}
