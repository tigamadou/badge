// src/components/badge/BadgePreview.tsx
"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import type { BadgeProps } from "@/types";

interface BadgePreviewProps extends BadgeProps {
  qrCodeDataUrl: string;
}

export function BadgePreview({
  registration,
  team,
  event,
  qrCodeDataUrl,
}: BadgePreviewProps) {
  return (
    <PDFViewer width="100%" height={600} showToolbar={false}>
      <BadgeDocument
        registration={registration}
        team={team}
        event={event}
        qrCodeDataUrl={qrCodeDataUrl}
      />
    </PDFViewer>
  );
}
