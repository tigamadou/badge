"use client";

import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { formatBadgeName, formatBadgeStructure } from "@/lib/format-badge-name";

Font.register({
  family: "Montserrat",
  fonts: [
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtZ6Ew-.ttf", fontWeight: 500 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCu170w-.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf", fontWeight: 700 },
  ],
});

const BADGE_WIDTH = 100 * 2.835;
const BADGE_HEIGHT = 140 * 2.835;

const styles = StyleSheet.create({
  page: {
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    backgroundColor: "#FFFFFF",
    fontFamily: "Montserrat",
    position: "relative",
  },
  header: { flexDirection: "row", alignItems: "center", padding: 14 },
  logo: { width: 60, height: 60, objectFit: "contain", marginRight: 16 },
  title: { fontSize: 12, fontWeight: 700, color: "#111" },
  date: { fontSize: 9, color: "#666", marginTop: 2 },
  photo: { width: 130, height: 160, objectFit: "cover", alignSelf: "center", marginTop: 6, borderRadius: 4 },
  name: { fontSize: 14, fontWeight: 700, textAlign: "center", marginTop: 12, paddingHorizontal: 16 },
  structure: { fontSize: 10, color: "#555", textAlign: "center", marginTop: 4, paddingHorizontal: 16 },
  categoryBar: { padding: 8, marginTop: 12, alignItems: "center" },
  categoryText: { color: "#fff", fontSize: 12, fontWeight: 600 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 8, marginTop: "auto" },
  qr: { width: 70, height: 70 },
  badgeId: { fontSize: 8, color: "#888" },
});

export type BadgeRegistration = {
  id: string;
  firstName: string;
  lastName: string;
  structure: string;
  photo?: string | null;
  allAccessGranted?: boolean;
  category: { name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean };
};

export type BadgeEvent = {
  title: string;
  date: Date;
  logo?: string | null;
};

export function BadgeDocumentV2({
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
  const catColor = registration.category.neutralBadge ? "#777" : registration.category.color;
  return (
    <Document>
      <Page size={[BADGE_WIDTH, BADGE_HEIGHT]} style={styles.page}>
        <View style={styles.header}>
          {logoDataUrl && <Image src={logoDataUrl} style={styles.logo} />}
          <View>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.date}>{new Date(event.date).toLocaleDateString("fr-FR")}</Text>
          </View>
        </View>
        {photoDataUrl && <Image src={photoDataUrl} style={styles.photo} />}
        <Text style={styles.name}>
          {formatBadgeName(registration.firstName, registration.lastName)}
        </Text>
        <Text style={styles.structure}>{formatBadgeStructure(registration.structure)}</Text>
        <View style={[styles.categoryBar, { backgroundColor: catColor }]}>
          <Text style={styles.categoryText}>
            #{registration.category.number} {"—"} {registration.category.name}
            {registration.allAccessGranted ? "  •  ALL ACCESS" : ""}
          </Text>
        </View>
        <View style={styles.footer}>
          <Image src={qrDataUrl} style={styles.qr} />
          <Text style={styles.badgeId}>{registration.id}</Text>
        </View>
      </Page>
    </Document>
  );
}
