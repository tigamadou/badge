// src/components/badge/BadgeDownload.tsx
"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import type { BadgeProps } from "@/types";

interface BadgeDownloadProps extends BadgeProps {
  qrCodeDataUrl: string;
}

export function BadgeDownload({
  registration,
  team,
  event,
  qrCodeDataUrl,
}: BadgeDownloadProps) {
  const fileName = `badge-${registration.lastName}-${registration.firstName}-${registration.id}.pdf`.replace(/\s+/g, "-");

  return (
    <PDFDownloadLink
      document={
        <BadgeDocument
          registration={registration}
          team={team}
          event={event}
          qrCodeDataUrl={qrCodeDataUrl}
        />
      }
      fileName={fileName}
    >
      {({ loading }) =>
        loading ? "Génération du PDF..." : "Télécharger le badge PDF"
      }
    </PDFDownloadLink>
  );
}
