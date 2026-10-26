"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useAsyncAction } from "@/hooks/useAsyncAction";

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
  // Pas de toast : la page change. Le hook garde le bouton bloqué et n'envoie qu'un seul signOut.
  // `leaving` couvre la navigation : signOut se résout avant le changement de page.
  const [leaving, setLeaving] = useState(false);
  const { run, pending } = useAsyncAction(() => signOut({ callbackUrl: "/" }), {
    onSuccess: () => setLeaving(true),
  });

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
        confirmLabel="Se déconnecter"
        confirmLoading={pending || leaving}
        onCancel={() => setOpen(false)}
        onConfirm={run}
      >
        Voulez-vous vraiment vous déconnecter ?
      </Modal>
    </>
  );
}
