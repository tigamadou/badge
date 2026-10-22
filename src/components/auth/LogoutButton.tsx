"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

// v4 Phase 3 : deconnexion via modal de confirmation, puis signOut vers l'accueil public.
export function LogoutButton({
  className,
  label = "Déconnexion",
  labelClassName,
}: {
  className?: string;
  label?: string;
  // Permet de masquer visuellement le libellé (ex. sous sm) tout en le gardant accessible.
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={labelClassName ? label : undefined}
        onClick={() => setOpen(true)}
      >
        <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
        {labelClassName ? <span className={labelClassName}>{label}</span> : label}
      </button>
      <Modal
        open={open}
        title="Se déconnecter"
        confirmLabel={pending ? "Déconnexion…" : "Se déconnecter"}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setPending(true);
          void signOut({ callbackUrl: "/" });
        }}
      >
        Voulez-vous vraiment vous déconnecter ?
      </Modal>
    </>
  );
}
