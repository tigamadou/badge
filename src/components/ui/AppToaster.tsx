"use client";

import { Toaster } from "sonner";

// containerAriaLabel : « Messages » et non « Notifications » (défaut de sonner) pour ne pas
// se confondre avec la cloche.
export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      containerAriaLabel="Messages"
      toastOptions={{ closeButtonAriaLabel: "Fermer" }}
    />
  );
}
