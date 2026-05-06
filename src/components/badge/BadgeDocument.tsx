// src/components/badge/BadgeDocument.tsx
"use client";

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { BadgeProps } from "@/types";

// Dimensions en points (1mm = 2.835pt)
const BADGE_WIDTH = 100 * 2.835; // ~283.5pt
const BADGE_HEIGHT = 140 * 2.835; // ~396.9pt

const styles = StyleSheet.create({
  page: {
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  // En-tete blanc
  headerContainer: {
    height: BADGE_HEIGHT * 0.38,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: "contain",
    marginBottom: 6,
  },
  eventTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 1.3,
    color: "#1a3a7c",
  },
  eventDate: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 4,
    color: "#4a6fa5",
  },
  // Zone centrale coloree
  centralZone: {
    flexGrow: 1,
    flexDirection: "column",
  },
  categoryBanner: {
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  contentRow: {
    flexDirection: "row",
    flexGrow: 1,
    paddingBottom: 8,
  },
  idVertical: {
    width: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  idText: {
    fontSize: 7,
    transform: "rotate(-90deg)",
    width: 120,
    textAlign: "center",
    color: "#FFFFFF",
  },
  photoContainer: {
    width: 90,
    height: 105,
    backgroundColor: "#CCCCCC",
    justifyContent: "center",
    alignItems: "center",
  },
  photo: {
    width: 90,
    height: 105,
    objectFit: "cover",
  },
  personInfo: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  fullName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  separator: {
    width: 40,
    height: 1,
    backgroundColor: "#FFFFFF",
    marginVertical: 6,
  },
  structure: {
    fontSize: 10,
    color: "#FFFFFF",
  },
  qrCodeContainer: {
    alignItems: "flex-end",
    paddingRight: 10,
    paddingBottom: 10,
  },
  qrCode: {
    width: 55,
    height: 55,
  },
  // Bande ALL ACCESS
  allAccessBanner: {
    height: 45,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
  },
  allAccessText: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
});

interface BadgeDocumentProps extends BadgeProps {
  qrCodeDataUrl: string;
  allAccessGranted?: boolean;
}

export function BadgeDocument({
  registration,
  team,
  event,
  qrCodeDataUrl,
  allAccessGranted = false,
}: BadgeDocumentProps) {
  return (
    <Document>
      <Page size={{ width: BADGE_WIDTH, height: BADGE_HEIGHT }} style={styles.page}>
        {/* En-tete blanc : Logo + Titre + Date */}
        <View style={styles.headerContainer}>
          {event.logo && <Image src={event.logo} style={styles.logo} />}
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDate}>
            {event.location}, le {event.date}
          </Text>
        </View>

        {/* Zone centrale coloree */}
        <View style={[styles.centralZone, { backgroundColor: team.color }]}>
          {/* Nom de la categorie */}
          <View style={styles.categoryBanner}>
            <Text style={styles.categoryName}>{team.name}</Text>
          </View>

          {/* Contenu : ID + Photo + Infos */}
          <View style={styles.contentRow}>
            {/* ID vertical */}
            <View style={styles.idVertical}>
              <Text style={styles.idText}>{registration.id}</Text>
            </View>

            {/* Photo */}
            <View style={styles.photoContainer}>
              {registration.photo ? (
                <Image src={registration.photo} style={styles.photo} />
              ) : (
                <Text style={{ fontSize: 8, color: "#666" }}>PHOTO</Text>
              )}
            </View>

            {/* Nom + Structure */}
            <View style={styles.personInfo}>
              <Text style={styles.fullName}>
                {registration.firstName[0]}. {registration.lastName}
              </Text>
              <View style={styles.separator} />
              <Text style={styles.structure}>{registration.structure}</Text>
            </View>
          </View>

          {/* QR Code en bas a droite */}
          <View style={styles.qrCodeContainer}>
            <Image src={qrCodeDataUrl} style={styles.qrCode} />
          </View>
        </View>

        {/* Bande ALL ACCESS (conditionnelle) */}
        {allAccessGranted && (
          <View style={styles.allAccessBanner}>
            <Text style={styles.allAccessText}>ALL ACCESS</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
