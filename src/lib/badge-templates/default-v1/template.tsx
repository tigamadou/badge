import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { TemplateContext } from "../types";
import { mm } from "../mm";
import "../fonts";

const PAGE_W = mm(85.6);
const PAGE_H = mm(54);
const PHOTO_W = mm(28);
const PHOTO_H = mm(34);
const CATEGORY_BAND_H = mm(8);

const styles = StyleSheet.create({
  page: {
    width: PAGE_W,
    height: PAGE_H,
    backgroundColor: "#ffffff",
    fontFamily: "Montserrat",
    flexDirection: "row",
  },
  photoCol: {
    width: PHOTO_W + mm(4),
    padding: mm(2),
    justifyContent: "center",
    alignItems: "center",
  },
  photo: {
    width: PHOTO_W,
    height: PHOTO_H,
    objectFit: "cover",
    borderRadius: mm(1),
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  photoPlaceholder: {
    width: PHOTO_W,
    height: PHOTO_H,
    backgroundColor: "#e2e8f0",
    borderRadius: mm(1),
  },
  rightCol: {
    flex: 1,
    paddingTop: mm(3),
    paddingBottom: CATEGORY_BAND_H + mm(2),
    paddingRight: mm(3),
    justifyContent: "space-between",
  },
  eventTitle: {
    fontSize: 9,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: mm(1),
  },
  participantName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.2,
  },
  participantStructure: {
    fontSize: 8,
    color: "#475569",
    marginTop: mm(0.5),
  },
  qrRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  qrCode: {
    width: mm(16),
    height: mm(16),
  },
  badgeId: {
    fontSize: 7,
    color: "#64748b",
    fontFamily: "Montserrat",
  },
  categoryBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: CATEGORY_BAND_H,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

export default function DefaultV1Template({ ctx }: { ctx: TemplateContext }) {
  const isAnonymous = ctx.category.anonymous;
  const isNeutral = ctx.category.neutralBadge;
  const categoryBg = isNeutral ? "#ffffff" : ctx.category.color;
  const categoryBorder = isNeutral ? ctx.category.color : "transparent";
  const categoryTextColor = isNeutral ? ctx.category.color : "#ffffff";

  return (
    <Document>
      <Page size={{ width: PAGE_W, height: PAGE_H }} style={styles.page}>
        <View style={styles.photoCol}>
          {!isAnonymous && ctx.participant.photoDataUrl ? (
            <Image src={ctx.participant.photoDataUrl} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder} />
          )}
        </View>

        <View style={styles.rightCol}>
          <View>
            <Text style={styles.eventTitle}>{ctx.event.title}</Text>
            <Text style={styles.participantName}>
              {isAnonymous
                ? "Participant anonyme"
                : `${ctx.participant.firstName} ${ctx.participant.lastName}`}
            </Text>
            {!isAnonymous && (
              <Text style={styles.participantStructure}>{ctx.participant.structure}</Text>
            )}
          </View>

          <View style={styles.qrRow}>
            <Text style={styles.badgeId}>#{ctx.badge.id}</Text>
            <Image src={ctx.badge.qrCodeDataUrl} style={styles.qrCode} />
          </View>
        </View>

        <View
          style={[
            styles.categoryBand,
            {
              backgroundColor: categoryBg,
              borderTopWidth: isNeutral ? 1 : 0,
              borderTopColor: categoryBorder,
            },
          ]}
        >
          <Text style={[styles.categoryText, { color: categoryTextColor }]}>
            {ctx.category.name}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
