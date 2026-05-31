"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { BadgeDocumentV2, type BadgeRegistration, type BadgeEvent } from "./BadgeDocumentV2";
import { BadgeDocumentAnonymousV2 } from "./BadgeDocumentAnonymousV2";

export function BadgePreviewV2({
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
  return (
    <PDFViewer style={{ width: "100%", height: 600 }}>
      <Doc
        registration={registration}
        event={event}
        qrDataUrl={qrDataUrl}
        photoDataUrl={photoDataUrl}
        logoDataUrl={logoDataUrl}
      />
    </PDFViewer>
  );
}
