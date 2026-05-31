"use client";

import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { BadgeRegistration, BadgeEvent } from "./BadgeDocumentV2";

const BADGE_WIDTH = 100 * 2.835;
const BADGE_HEIGHT = 140 * 2.835;

const styles = StyleSheet.create({
  page: { width: BADGE_WIDTH, height: BADGE_HEIGHT, backgroundColor: "#FFFFFF", fontFamily: "Montserrat" },
  header: { padding: 14, alignItems: "center" },
  logo: { width: 60, height: 60, objectFit: "contain" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 8 },
  categoryBar: { padding: 16, marginTop: 24, alignItems: "center" },
  categoryText: { color: "#fff", fontSize: 18, fontWeight: 700 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 8, marginTop: "auto" },
  qr: { width: 70, height: 70 },
  badgeId: { fontSize: 8, color: "#888" },
});

export function BadgeDocumentAnonymousV2({
  registration,
  event,
  qrDataUrl,
  logoDataUrl,
}: {
  registration: BadgeRegistration;
  event: BadgeEvent;
  qrDataUrl: string;
  logoDataUrl?: string | null;
}) {
  const catColor = registration.category.neutralBadge ? "#777" : registration.category.color;
  return (
    <Document>
      <Page size={[BADGE_WIDTH, BADGE_HEIGHT]} style={styles.page}>
        <View style={styles.header}>
          {logoDataUrl && <Image src={logoDataUrl} style={styles.logo} />}
          <Text style={styles.title}>{event.title}</Text>
        </View>
        <View style={[styles.categoryBar, { backgroundColor: catColor }]}>
          <Text style={styles.categoryText}>{registration.category.name}</Text>
        </View>
        <View style={styles.footer}>
          <Image src={qrDataUrl} style={styles.qr} />
          <Text style={styles.badgeId}>{registration.id}</Text>
        </View>
      </Page>
    </Document>
  );
}
