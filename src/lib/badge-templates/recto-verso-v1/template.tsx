import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { TemplateContext } from "../types";
import { mm } from "../mm";
import "../fonts";

const PAGE_W = mm(74);
const PAGE_H = mm(105);
const PHOTO_W = mm(50);
const PHOTO_H = mm(60);
const VERSO_CATEGORY_H = mm(25);

const styles = StyleSheet.create({
  page: {
    width: PAGE_W,
    height: PAGE_H,
    backgroundColor: "#ffffff",
    fontFamily: "Montserrat",
  },
  recto: {
    paddingTop: mm(10),
    paddingHorizontal: mm(6),
    paddingBottom: mm(8),
    alignItems: "center",
    justifyContent: "flex-start",
    height: PAGE_H,
  },
  eventTitleRecto: {
    fontSize: 11,
    fontWeight: 600,
    color: "#0f172a",
    textAlign: "center",
    marginBottom: mm(6),
  },
  photo: {
    width: PHOTO_W,
    height: PHOTO_H,
    objectFit: "cover",
    borderRadius: mm(2),
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginBottom: mm(5),
  },
  photoPlaceholder: {
    width: PHOTO_W,
    height: PHOTO_H,
    backgroundColor: "#e2e8f0",
    borderRadius: mm(2),
    marginBottom: mm(5),
  },
  participantName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "center",
  },
  participantStructure: {
    fontSize: 9,
    color: "#475569",
    textAlign: "center",
    marginTop: mm(1.5),
    marginBottom: mm(6),
  },
  qrWrap: {
    alignItems: "center",
  },
  qrCode: {
    width: mm(28),
    height: mm(28),
  },
  badgeId: {
    fontSize: 7,
    color: "#64748b",
    marginTop: mm(1),
  },
  versoRoot: {
    height: PAGE_H,
    paddingTop: mm(10),
    paddingHorizontal: mm(6),
  },
  verso: {
    alignItems: "center",
  },
  versoLogo: {
    width: mm(18),
    height: mm(18),
    objectFit: "contain",
    marginBottom: mm(4),
  },
  versoTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "center",
    marginBottom: mm(2),
  },
  versoDateLocation: {
    fontSize: 9,
    color: "#475569",
    textAlign: "center",
    marginBottom: mm(4),
  },
  categoryBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: VERSO_CATEGORY_H,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

function formatFrenchDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default function RectoVersoV1Template({ ctx }: { ctx: TemplateContext }) {
  const isAnonymous = ctx.category.anonymous;
  const isNeutral = ctx.category.neutralBadge;
  const categoryBg = isNeutral ? "#ffffff" : ctx.category.color;
  const categoryBorder = isNeutral ? ctx.category.color : "transparent";
  const categoryTextColor = isNeutral ? ctx.category.color : "#ffffff";

  return (
    <Document>
      <Page size={{ width: PAGE_W, height: PAGE_H }} style={styles.page}>
        <View style={styles.recto}>
          <Text style={styles.eventTitleRecto}>{ctx.event.title}</Text>
          {!isAnonymous && ctx.participant.photoDataUrl ? (
            <Image src={ctx.participant.photoDataUrl} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder} />
          )}
          <Text style={styles.participantName}>
            {isAnonymous
              ? "Participant anonyme"
              : `${ctx.participant.firstName} ${ctx.participant.lastName}`}
          </Text>
          {!isAnonymous && (
            <Text style={styles.participantStructure}>{ctx.participant.structure}</Text>
          )}
          <View style={styles.qrWrap}>
            <Image src={ctx.badge.qrCodeDataUrl} style={styles.qrCode} />
            <Text style={styles.badgeId}>#{ctx.badge.id}</Text>
          </View>
        </View>
      </Page>

      <Page size={{ width: PAGE_W, height: PAGE_H }} style={styles.page}>
        <View style={styles.versoRoot}>
          <View style={styles.verso}>
            {ctx.event.logoDataUrl ? (
              <Image src={ctx.event.logoDataUrl} style={styles.versoLogo} />
            ) : null}
            <Text style={styles.versoTitle}>{ctx.event.title}</Text>
            <Text style={styles.versoDateLocation}>
              {formatFrenchDate(ctx.event.date)} {"\n"} {ctx.event.location}
            </Text>
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
