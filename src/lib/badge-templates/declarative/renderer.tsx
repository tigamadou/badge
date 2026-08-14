import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { TemplateContext } from "../types";
import { px } from "../px";
import type { Block, TemplateManifest, TextBlock, TextStyle } from "./manifest-types";
import { resolveSource } from "./resolve-source";
import { isBlockVisible } from "./conditions";
import { renderTextTemplate } from "./text-template";
import { registerTemplateFonts, DEFAULT_FONT_FAMILY, type AssetResolver } from "./fonts";
import "../fonts";

const HEX = /^#[0-9a-fA-F]{6}$/;

// Une couleur est soit litterale, soit une source de type couleur.
function colorOf(value: string, ctx: TemplateContext): string {
  return HEX.test(value) ? value : String(resolveSource(ctx, value));
}

// @react-pdf ne mesure pas le texte hors rendu. 0,55 em par caractere approche
// Montserrat en graisse normale : l'objectif n'est pas d'etre exact mais de garantir
// qu'un texte trop long retrecit ou se coupe au lieu de deborder du cadre.
// Tailles et largeurs partagent la meme unite (px 96 dpi), le calcul reste donc
// entierement en pixels ; seule l'emission du style convertit en points.
const CHAR_RATIO = 0.55;

function shrinkToFit(text: string, style: TextStyle, widthPx: number): number {
  /* v8 ignore next -- le schema exige minSizePx des que overflow vaut "shrink",
     et shrinkToFit n'est appele que dans ce mode ; garde defensive */
  const min = style.minSizePx ?? style.sizePx;
  let size = style.sizePx;
  while (size > min && text.length * size * CHAR_RATIO > widthPx) size -= 2;
  return Math.max(size, min);
}

function truncateToFit(text: string, style: TextStyle, widthPx: number): string {
  const maxChars = Math.floor(widthPx / (style.sizePx * CHAR_RATIO));
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

function frame(block: Block) {
  return {
    position: "absolute" as const,
    left: px(block.x),
    top: px(block.y),
    width: px(block.w),
    height: px(block.h),
    opacity: block.opacity,
    // Rotation autour du centre du cadre (transform-origin par defaut de
    // @react-pdf) : le manifeste declare le cadre non pivote, comme Figma.
    transform: block.rotate !== undefined ? `rotate(${block.rotate}deg)` : undefined,
  };
}

// `radiusPx` accepte un nombre (les quatre coins) ou un objet par coin.
function radiusStyles(block: Block) {
  const radius = block.radiusPx;
  if (radius === undefined) return {};
  if (typeof radius === "number") return { borderRadius: px(radius) };
  const out: Record<string, number> = {};
  if (radius.topLeft !== undefined) out.borderTopLeftRadius = px(radius.topLeft);
  if (radius.topRight !== undefined) out.borderTopRightRadius = px(radius.topRight);
  if (radius.bottomRight !== undefined) out.borderBottomRightRadius = px(radius.bottomRight);
  if (radius.bottomLeft !== undefined) out.borderBottomLeftRadius = px(radius.bottomLeft);
  return out;
}

// `border` couvre les quatre cotes ; une declaration par cote prime sur lui.
function borderStyles(block: Block, ctx: TemplateContext) {
  const sides = {
    Top: block.borderTop ?? block.border,
    Right: block.borderRight ?? block.border,
    Bottom: block.borderBottom ?? block.border,
    Left: block.borderLeft ?? block.border,
  } as const;
  const out: Record<string, unknown> = {};
  for (const [side, declared] of Object.entries(sides)) {
    if (!declared) continue;
    out[`border${side}Width`] = px(declared.widthPx);
    out[`border${side}Color`] = colorOf(declared.color, ctx);
    out[`border${side}Style`] = declared.style ?? "solid";
  }
  return out;
}

function renderText(
  block: TextBlock,
  ctx: TemplateContext,
  fontMap: Record<string, string>,
  key: string,
) {
  const raw = renderTextTemplate(block.text, ctx);
  // La marge interne retranche de la largeur utile : sans cela un texte cadre au
  // pixel deborderait de son fond.
  const innerWidth = block.w - 2 * (block.style.paddingPx ?? 0);
  const content =
    block.style.overflow === "truncate" ? truncateToFit(raw, block.style, innerWidth) : raw;
  const sizePx =
    block.style.overflow === "shrink" ? shrinkToFit(raw, block.style, innerWidth) : block.style.sizePx;

  return (
    <View
      key={key}
      style={{
        ...frame(block),
        ...borderStyles(block, ctx),
        ...radiusStyles(block),
        backgroundColor: block.style.backgroundColor
          ? colorOf(block.style.backgroundColor, ctx)
          : undefined,
        padding: block.style.paddingPx !== undefined ? px(block.style.paddingPx) : undefined,
      }}
    >
      <Text
        maxLines={block.style.maxLines}
        style={{
          fontFamily: block.style.font ? fontMap[block.style.font] : DEFAULT_FONT_FAMILY,
          fontSize: px(sizePx),
          fontWeight: block.style.weight,
          textAlign: block.style.align,
          color: colorOf(block.style.color, ctx),
          // La casse est confiee a @react-pdf plutot qu'appliquee a la chaine : c'est
          // ce que font les templates historiques, et le moteur gere la locale.
          textTransform: block.style.transform,
          letterSpacing:
            block.style.letterSpacing !== undefined ? px(block.style.letterSpacing) : undefined,
          lineHeight: block.style.lineHeight,
          fontStyle: block.style.fontStyle,
          textDecoration: block.style.decoration,
          textOverflow: block.style.maxLines !== undefined ? "ellipsis" : undefined,
        }}
      >
        {content}
      </Text>
    </View>
  );
}

function renderBlock(
  block: Block,
  ctx: TemplateContext,
  assets: AssetResolver,
  fontMap: Record<string, string>,
  key: string,
) {
  if (block.type === "text") return renderText(block, ctx, fontMap, key);

  if (block.type === "rect") {
    return (
      <View
        key={key}
        style={{
          ...frame(block),
          ...borderStyles(block, ctx),
          ...radiusStyles(block),
          backgroundColor: colorOf(block.fill, ctx),
        }}
      />
    );
  }

  // Le schema garantit qu'un bloc image porte exactement un `source` ou un `asset`.
  const src =
    block.type === "qr"
      ? String(resolveSource(ctx, "badge.qrCodeDataUrl"))
      : block.asset !== undefined
        ? assets(block.asset)
        : String(resolveSource(ctx, block.source!));

  return (
    <Image
      key={key}
      src={src}
      style={{
        ...frame(block),
        ...borderStyles(block, ctx),
        ...radiusStyles(block),
        objectFit: block.type === "image" ? (block.objectFit ?? "cover") : "cover",
      }}
    />
  );
}

export function DeclarativeDocument({
  manifest,
  assets,
  templateId,
  ctx,
}: {
  manifest: TemplateManifest;
  assets: AssetResolver;
  templateId: string;
  ctx: TemplateContext;
}) {
  const fontMap = registerTemplateFonts(templateId, manifest.fonts, assets);
  const pages = Array.from({ length: manifest.page.count }, (_, i) => i + 1);

  return (
    <Document>
      {pages.map((pageNumber) => (
        <Page
          key={`page-${pageNumber}`}
          size={{ width: px(manifest.page.widthPx), height: px(manifest.page.heightPx) }}
          style={{ backgroundColor: "#ffffff", fontFamily: DEFAULT_FONT_FAMILY }}
        >
          {/* Les blocs vivent dans une View insecable couvrant exactement la page :
              sans elle, @react-pdf paginerait sur des pages supplementaires tout
              contenu debordant (fond perdu permis). wrap={false} directement sur la
              Page ne convient pas : la page adopterait la hauteur du flux, soit 0. */}
          <View
            wrap={false}
            style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
          >
            {manifest.blocks
              .map((block, index) => ({ block, index }))
              .filter(({ block }) => block.page === pageNumber && isBlockVisible(ctx, block.visibleIf))
              .map(({ block, index }) => renderBlock(block, ctx, assets, fontMap, `b-${index}`))}
          </View>
        </Page>
      ))}
    </Document>
  );
}
