// src/components/badge/BadgeDocumentAnonymous.tsx
"use client";

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { EventInfo, Team } from "@/types";

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
  container: {
    flexDirection: "column",
    flexGrow: 1,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 16,
    paddingBottom: 14,
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: "contain",
    marginRight: 20,
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: "column",
  },
  eventTitle: {
    fontSize: 10,
    fontFamily: "Montserrat",
    lineHeight: 1.3,
    color: "#1a3a7c",
    fontWeight: "600",
    paddingRight: 10,
  },
  eventDate: {
    fontSize: 10,
    marginTop: 8,
    color: "#4a6fa5",
  },
  separatorLine: {
    height: 1,
    backgroundColor: "#1a3a7c",
    marginHorizontal: 30,
    marginBottom: 15,
  },
  contentArea: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  qrCode: {
    width: 120,
    height: 120,
  },
  idText: {
    fontSize: 16,
    fontFamily: "Montserrat",
    fontWeight: "600",
    color: "#000000",
    marginTop: 12,
    textAlign: "center",
  },
  categoryBanner: {
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 26,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
});

interface BadgeDocumentAnonymousProps {
  registrationId: string;
  team: Team;
  event: EventInfo;
  qrCodeDataUrl: string;
}

export function BadgeDocumentAnonymous({
  registrationId,
  team,
  event,
  qrCodeDataUrl,
}: BadgeDocumentAnonymousProps) {
  return (
    <Document>
      <Page size={{ width: BADGE_WIDTH, height: BADGE_HEIGHT }} style={styles.page}>
        <View style={styles.container}>
          {/* En-tete : logo + titre + date */}
          <View style={styles.headerContainer}>
            {event.logo && <Image src={event.logo} style={styles.logo} />}
            <View style={styles.headerTextContainer}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDate}>
                {event.location}, le {event.date}
              </Text>
            </View>
          </View>

          {/* Ligne de separation */}
          <View style={styles.separatorLine} />

          {/* Zone contenu centree : QR code + numero */}
          <View style={styles.contentArea}>
            <Image src={qrCodeDataUrl} style={styles.qrCode} />
            <Text style={styles.idText}>{registrationId}</Text>
          </View>

          {/* Bande categorie en bas */}
          <View style={[styles.categoryBanner, {
            backgroundColor: team.neutralBadge ? "#FFFFFF" : team.color,
            height: 120,
            ...(team.neutralBadge ? { borderTopWidth: 1, borderTopColor: "#E2E8F0" } : {}),
          }]}>
            <Text style={[styles.categoryName, team.neutralBadge ? { color: team.color } : {}]}>{team.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
