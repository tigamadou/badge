// src/components/badge/BadgeDownload.tsx
"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import { BadgeDocumentAnonymous } from "./BadgeDocumentAnonymous";
import type { BadgeProps } from "@/types";

interface BadgeDownloadProps extends BadgeProps {
  qrCodeDataUrl: string;
  allAccessGranted?: boolean;
}

export function BadgeDownload({
  registration,
  team,
  event,
  qrCodeDataUrl,
  allAccessGranted = false,
}: BadgeDownloadProps) {
  const fileName = team.anonymous
    ? `badge-${registration.id}.pdf`
    : `badge-${registration.lastName}-${registration.firstName}-${registration.id}.pdf`.replace(/\s+/g, "-");

  const document = team.anonymous ? (
    <BadgeDocumentAnonymous
      registrationId={registration.id}
      team={team}
      event={event}
      qrCodeDataUrl={qrCodeDataUrl}
      allAccessGranted={allAccessGranted}
    />
  ) : (
    <BadgeDocument
      registration={registration}
      team={team}
      event={event}
      qrCodeDataUrl={qrCodeDataUrl}
      allAccessGranted={allAccessGranted}
    />
  );

  return (
    <PDFDownloadLink document={document} fileName={fileName}>
      {({ loading }) =>
        loading ? "Génération du PDF..." : "Télécharger le badge PDF"
      }
    </PDFDownloadLink>
  );
}
