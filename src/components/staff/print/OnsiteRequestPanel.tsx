"use client";

import Link from "next/link";
import { useState } from "react";
import type { Permission } from "@/lib/permissions";
import { OnsiteCounterCard } from "@/components/print/OnsiteCounterCard";
import {
  canOpenOnsiteStation,
  canSetOnsiteMargin,
  showsOnsiteCounter,
} from "@/lib/print-requests/onsite-station-view";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";
import { OnsiteMarginForm } from "./OnsiteMarginForm";

// Bloc « impression sur place » de la page staff de la commande : compteur, accès au poste, marge.
export function OnsiteRequestPanel({
  requestId,
  status,
  permissions,
  canOperateOnsite,
  initialCounter,
}: {
  requestId: string;
  status: string;
  permissions: Permission[];
  canOperateOnsite: boolean;
  initialCounter: OnsiteCounter;
}) {
  const [counter, setCounter] = useState(initialCounter);
  if (!showsOnsiteCounter(status)) return null;
  return (
    <div className="space-y-3">
      <OnsiteCounterCard counter={counter} />
      {canOpenOnsiteStation(status) && canOperateOnsite ? (
        <Link
          href={`/platform/print/orders/${requestId}/onsite`}
          className="inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-hover"
        >
          Ouvrir le poste d&apos;impression
        </Link>
      ) : null}
      {canSetOnsiteMargin(status, new Set(permissions)) ? (
        <OnsiteMarginForm requestId={requestId} counter={counter} onChanged={setCounter} />
      ) : null}
    </div>
  );
}
