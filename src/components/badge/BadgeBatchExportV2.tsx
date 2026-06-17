"use client";

import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { BadgeDocumentV2, type BadgeEvent, type BadgeRegistration } from "./BadgeDocumentV2";

const A4_W = 842;
const A4_H = 595;

const styles = StyleSheet.create({
  page: { flexDirection: "row", padding: 20, gap: 20 },
  slot: { width: (A4_W - 60) / 2, border: "1pt solid #ccc" },
});

type BatchItem = {
  registration: BadgeRegistration;
  qrDataUrl: string;
  photoDataUrl?: string | null;
  logoDataUrl?: string | null;
};

export function BadgeBatchExportV2({
  items,
  event,
}: {
  items: BatchItem[];
  event: BadgeEvent;
}) {
  const pages: BatchItem[][] = [];
  for (let i = 0; i < items.length; i += 2) pages.push(items.slice(i, i + 2));
  return (
    <Document>
      {pages.map((pair, i) => (
        <Page key={i} size={[A4_W, A4_H]} style={styles.page}>
          {pair.map((it) => (
            <View key={it.registration.id} style={styles.slot}>
              <BadgeDocumentV2
                registration={it.registration}
                event={event}
                qrDataUrl={it.qrDataUrl}
                photoDataUrl={it.photoDataUrl}
                logoDataUrl={it.logoDataUrl}
              />
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}
