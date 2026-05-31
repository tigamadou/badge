"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { BadgeDocumentV2, type BadgeRegistration, type BadgeEvent } from "./BadgeDocumentV2";
import { BadgeDocumentAnonymousV2 } from "./BadgeDocumentAnonymousV2";

export function BadgeDownloadV2({
  registration,
  event,
  qrDataUrl,
  photoDataUrl,
  logoDataUrl,
}: {
  registration: BadgeRegistration;
  event: BadgeEvent;
  qrDataUrl: string;
  photoDataUrl?: string | null;
  logoDataUrl?: string | null;
}) {
  const Doc = registration.category.anonymous ? BadgeDocumentAnonymousV2 : BadgeDocumentV2;
  const fileName = `badge-${registration.id}.pdf`;
  return (
    <PDFDownloadLink
      document={
        <Doc
          registration={registration}
          event={event}
          qrDataUrl={qrDataUrl}
          photoDataUrl={photoDataUrl}
          logoDataUrl={logoDataUrl}
        />
      }
      fileName={fileName}
      className="inline-block rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"
    >
      {({ loading }) => (loading ? "Préparation..." : "Télécharger le badge PDF")}
    </PDFDownloadLink>
  );
}
