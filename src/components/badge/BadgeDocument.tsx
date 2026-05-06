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
    zIndex: 1,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // En-tete blanc
  headerContainer: {
    height: BADGE_HEIGHT * 0.45,
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 10,
  },
  logo: {
    width: 100,

    height: 100,
    objectFit: "contain",
   
  },
  eventTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 1.3,
    color: "#1a3a7c",
    maxWidth: BADGE_WIDTH * 0.8,

  },
  eventDate: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    color: "#4a6fa5",
  },
  // Zone centrale coloree
  centralZone: {
    flexGrow: 1,
    flexDirection: "column",
    position: "relative",
    display: "flex",
    zIndex: 2,
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
  },
  idVertical: {
    width: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  idText: {
    fontSize: 12,
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
    justifyContent: "flex-start",
    paddingHorizontal: 10,
    paddingTop: 0,
  },
  fullName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  separator: {
    width: 100,
    height: 1,
    backgroundColor: "#FFFFFF",
    marginVertical: 6,
  },
  structure: {
    fontSize: 14,
    color: "#FFFFFF",
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  qrCodeContainer: {
    position: "absolute",
    bottom: 30,
    right: 10,
    zIndex: 2,
  },
  qrCode: {
    width: 65,
    height: 65,
    zIndex: 5,
  },
  // Bande ALL ACCESS
  allAccessBanner: {
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 10,
    zIndex: 1,
    paddingVertical: 10,
  },
  allAccessText: {
    fontSize: 26,
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
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            {event.logo && <Image src={event.logo} style={styles.logo} />}
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventDate}>
              {event.location}, le {event.date}
            </Text>
          </View>

          <View style={[styles.centralZone, { backgroundColor: team.color }]}>
            <View style={styles.categoryBanner}>
              <Text style={styles.categoryName}>{team.name}</Text>
            </View>


            <View style={styles.contentRow}>
              <View style={styles.idVertical}>
                <Text style={styles.idText}>{registration.id}</Text>
              </View>

              <View style={styles.photoContainer}>
                {registration.photo ? (
                  <Image src={registration.photo} style={styles.photo} />
                ) : (
                  <Text style={{ fontSize: 8, color: "#666" }}>PHOTO</Text>
                )}
              </View>

              <View style={styles.personInfo}>
                <Text style={styles.fullName}>
                  {registration.firstName}
                </Text>
                <Text style={styles.fullName}>
                  {registration.lastName}
                </Text>
                <View style={styles.separator} />
                <Text style={styles.structure}>{registration.structure}</Text>
              </View>
              {/* QR Code en bas a droite */}
            
            </View>
          
            {/* Bande ALL ACCESS (conditionnelle) */}
            {allAccessGranted && (
              <View style={styles.allAccessBanner}>
                <Text style={styles.allAccessText}>ALL ACCESS</Text>
              </View>
            )}
            
          </View>
          
        <View style={styles.qrCodeContainer}>
          <Image src={qrCodeDataUrl} style={styles.qrCode} />
        </View>
        </View>
      </Page>
    </Document>
  );
}
