// src/components/badge/BadgePreview.tsx
"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import type { BadgeProps } from "@/types";

interface BadgePreviewProps extends BadgeProps {
  qrCodeDataUrl: string;
  allAccessGranted?: boolean;
}

export function BadgePreview({
  registration,
  team,
  event,
  qrCodeDataUrl,
  allAccessGranted = false,
}: BadgePreviewProps) {
  return (
    <PDFViewer width="100%" height={600} showToolbar={false}>
      <BadgeDocument
        registration={registration}
        team={team}
        event={event}
        qrCodeDataUrl={qrCodeDataUrl}
        allAccessGranted={allAccessGranted}
      />
    </PDFViewer>
  );
}
