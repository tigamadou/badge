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
    position: "relative",
  },
  container: {
    flexDirection: "column",
    flexGrow: 1,
  },
  // En-tete : logo a gauche, texte a droite
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 16,
    paddingBottom: 20,
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
    fontFamily: "Helvetica",
    lineHeight: 1.3,
    color: "#1a3a7c",
    fontWeight: "600",
    paddingRight: 10,
  },
  eventDate: {
    fontSize: 10,
    marginTop: 4,
    color: "#4a6fa5",
  },
  // Ligne de separation
  separatorLine: {
    height: 1,
    backgroundColor: "#1a3a7c",
    marginHorizontal: 30,
    marginBottom: 20,
  },
  // Zone contenu (blanche)
  contentArea: {
    flexGrow: 1,
    paddingHorizontal: 30,

  },
  // Ligne photo / QR / ID
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  photoContainer: {
    width: 80,
    height: 89,
    backgroundColor: "#CCCCCC",
    justifyContent: "center",
    alignItems: "center",
  },
  photo: {
    width: 80,
    height: 89,
    objectFit: "cover",
  },
  qrCodeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  qrCode: {
    width: 60,
    height: 60,
  },
  idVertical: {
    width: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  idText: {
    fontSize: 13,
    fontFamily: "Helvetica",
    fontWeight: "500",
    transform: "rotate(-90deg)",
    width: 130,
    textAlign: "center",
    color: "#000000",
  },
  // Nom et structure
  fullName: {
    fontSize: 15,
    fontFamily: "Helvetica",
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  structure: {
    fontSize: 12,
    color: "#333333",
  },
  // Spacer pour pousser les bandes en bas
  spacer: {
    flexGrow: 1,
  },
  // Bande ALL ACCESS
  allAccessBanner: {
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
  },
  allAccessText: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
  // Bande categorie/equipe en bas
  categoryBanner: {
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
    height: 120,
  },
  categoryName: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
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
        <View style={styles.container}>
          {/* En-tete : logo a gauche, titre + date a droite */}
          <View style={styles.headerContainer}>
            {event.logo && <Image src={event.logo} style={styles.logo} />}
            <View style={styles.headerTextContainer}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDate}>
                {event.location}, le {event.date}
              </Text>
            </View>
          </View>

          {/* Ligne de separation bleue */}
          <View style={styles.separatorLine} />

          {/* Zone contenu blanche */}
          <View style={styles.contentArea}>
            {/* Photo | QR Code | ID vertical */}
            <View style={styles.contentRow}>
              <View style={styles.photoContainer}>
                {registration.photo ? (
                  <Image src={registration.photo} style={styles.photo} />
                ) : (
                  <Text style={{ fontSize: 8, color: "#666" }}>PHOTO</Text>
                )}
              </View>

              <View style={styles.qrCodeContainer}>
                <Image src={qrCodeDataUrl} style={styles.qrCode} />
              </View>

              <View style={styles.idVertical}>
                <Text style={styles.idText}>{registration.id}</Text>
              </View>
            </View>

            {/* Nom et structure */}
            <Text style={styles.fullName}>
              {registration.firstName} {registration.lastName.toUpperCase()}
            </Text>
            <Text style={styles.structure}>{registration.structure}</Text>
          </View>

          {/* Bande ALL ACCESS (conditionnelle) */}
          {allAccessGranted && (
            <View style={styles.allAccessBanner}>
              <Text style={styles.allAccessText}>ALL ACCESS</Text>
            </View>
          )}

          {/* Bande categorie/equipe tout en bas */}
          <View style={[styles.categoryBanner, { backgroundColor: team.color }]}>
            <Text style={styles.categoryName}>{team.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
