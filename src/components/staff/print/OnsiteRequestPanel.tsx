"use client";

import Link from "next/link";
import { useState } from "react";
import type { StaffRole } from "@prisma/client";
import { OnsiteCounterCard } from "@/components/print/OnsiteCounterCard";
import {
  canOpenOnsiteStation,
  canSetOnsiteMargin,
  showsOnsiteCounter,
} from "@/lib/print-requests/onsite-station-view";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { OnsiteMarginForm } from "./OnsiteMarginForm";

// Bloc « impression sur place » de la page staff de la commande : compteur, accès au poste, marge.
export function OnsiteRequestPanel({
  requestId,
  status,
  role,
  initialCounter,
}: {
  requestId: string;
  status: string;
  role: StaffRole;
  initialCounter: OnsiteCounter;
}) {
  const [counter, setCounter] = useState(initialCounter);
  if (!showsOnsiteCounter(status)) return null;
  return (
    <div className="space-y-3">
      <OnsiteCounterCard counter={counter} />
      {canOpenOnsiteStation(status) && staffRoleAtLeast(role, "STAFF_SUPPORT") ? (
        <Link
          href={`/platform/print/orders/${requestId}/onsite`}
          className="inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Ouvrir le poste d&apos;impression
        </Link>
      ) : null}
      {canSetOnsiteMargin(status, role) ? (
        <OnsiteMarginForm requestId={requestId} counter={counter} onChanged={setCounter} />
      ) : null}
    </div>
  );
}
