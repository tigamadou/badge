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
  headerContainer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 15,
    height: BADGE_HEIGHT * 0.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  qrCode: {
    width: 70,
    height: 70,
  },
  logo: {
    width: 70,
    height: 70,
    objectFit: "contain",
  },
  eventInfo: {
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  eventTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 1.3,
  },
  eventDate: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 4,
  },
  centralZone: {
    flexDirection: "row",
    marginTop: 10,
    flexGrow: 1,
  },
  centralZoneContainer: {
    flexDirection: "column",
    flexGrow: 1,
    height: BADGE_HEIGHT * 0.5,
  },
  centralZoneContent: {
    flexDirection: "row",
    flexGrow: 1,
  },
  idVertical: {
    width: 20,
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
    height: 100,
    backgroundColor: "#CCCCCC",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -50,
  },
  photo: {
    width: 90,
    height: 100,
    objectFit: "cover",

  },
  personInfo: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "red",
  },
  fullName: {
    fontSize: 12,
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
  teamBanner: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  teamName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});

interface BadgeDocumentProps extends BadgeProps {
  qrCodeDataUrl: string;
}

export function BadgeDocument({
  registration,
  team,
  event,
  qrCodeDataUrl,
}: BadgeDocumentProps) {
  return (
    <Document>
      <Page size={{ width: BADGE_WIDTH, height: BADGE_HEIGHT }} style={styles.page}>
        {/* En-tête : QR code + Logo */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            {event.logo && <Image src={event.logo} style={styles.logo} />}
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDate}>
                {event.location}, le {event.date}
              </Text>
            </View>
          </View>
          <Image src={qrCodeDataUrl} style={styles.qrCode} />
        </View>
        <View style={[styles.centralZoneContainer, { backgroundColor: team.color }]}>
          <View style={[styles.centralZone]}>
            {/* ID vertical */}
            <View style={styles.idVertical}>
              <Text style={styles.idText}>{registration.id}</Text>
            </View>
            <View style={styles.centralZoneContent}>
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
                <View style={styles.personInfoContent}>
                  <Text style={styles.fullName}>{registration.lastName} {registration.firstName}</Text>
                </View>
                <View style={styles.separator} />
                <Text style={styles.structure}>{registration.structure}</Text>
              </View>

            </View>
          </View>

          {/* Bandeau équipe */}
          <View style={[styles.teamBanner, { backgroundColor: team.color }]}>
            <Text style={styles.teamName}>{team.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
