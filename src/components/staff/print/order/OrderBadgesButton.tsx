"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { OrderBadgesDialog } from "@/components/print/OrderBadgesDialog";

// « Voir les badges (N) » : ouvre la liste paginée des badges d'une commande en amont.
export function OrderBadgesButton({ count, fetchUrl }: { count: number; fetchUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Voir les badges ({count})
      </Button>
      <OrderBadgesDialog open={open} onClose={() => setOpen(false)} fetchUrl={fetchUrl} />
    </>
  );
}
