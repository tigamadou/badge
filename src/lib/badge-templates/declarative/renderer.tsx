import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { TemplateContext } from "../types";
import { mm } from "../mm";
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
const CHAR_RATIO = 0.55;

function shrinkToFit(text: string, style: TextStyle, widthMm: number): number {
  const maxPt = mm(widthMm);
  /* v8 ignore next -- le schema exige minSizePt des que overflow vaut "shrink",
     et shrinkToFit n'est appele que dans ce mode ; garde defensive */
  const min = style.minSizePt ?? style.sizePt;
  let size = style.sizePt;
  while (size > min && text.length * size * CHAR_RATIO > maxPt) size -= 0.5;
  return Math.max(size, min);
}

function truncateToFit(text: string, style: TextStyle, widthMm: number): string {
  const maxChars = Math.floor(mm(widthMm) / (style.sizePt * CHAR_RATIO));
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

function frame(block: Block) {
  return {
    position: "absolute" as const,
    left: mm(block.x),
    top: mm(block.y),
    width: mm(block.w),
    height: mm(block.h),
  };
}

function renderText(
  block: TextBlock,
  ctx: TemplateContext,
  fontMap: Record<string, string>,
  key: string,
) {
  const raw = renderTextTemplate(block.text, ctx);
  const content = block.style.overflow === "truncate" ? truncateToFit(raw, block.style, block.w) : raw;
  const fontSize =
    block.style.overflow === "shrink" ? shrinkToFit(raw, block.style, block.w) : block.style.sizePt;

  return (
    <View key={key} style={frame(block)}>
      <Text
        style={{
          fontFamily: block.style.font ? fontMap[block.style.font] : DEFAULT_FONT_FAMILY,
          fontSize,
          fontWeight: block.style.weight,
          textAlign: block.style.align,
          color: colorOf(block.style.color, ctx),
          // La casse est confiee a @react-pdf plutot qu'appliquee a la chaine : c'est
          // ce que font les templates historiques, et le moteur gere la locale.
          textTransform: block.style.transform,
          letterSpacing: block.style.letterSpacing,
          lineHeight: block.style.lineHeight,
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
          backgroundColor: colorOf(block.fill, ctx),
          borderRadius: block.radiusMm ? mm(block.radiusMm) : undefined,
          borderTopWidth: block.borderTopPt,
          borderTopColor: block.borderColor ? colorOf(block.borderColor, ctx) : undefined,
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
        objectFit: "cover",
        borderRadius: block.type === "image" && block.radiusMm ? mm(block.radiusMm) : undefined,
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
          size={{ width: mm(manifest.page.widthMm), height: mm(manifest.page.heightMm) }}
          style={{ backgroundColor: "#ffffff", fontFamily: DEFAULT_FONT_FAMILY }}
        >
          {manifest.blocks
            .map((block, index) => ({ block, index }))
            .filter(({ block }) => block.page === pageNumber && isBlockVisible(ctx, block.visibleIf))
            .map(({ block, index }) => renderBlock(block, ctx, assets, fontMap, `b-${index}`))}
        </Page>
      ))}
    </Document>
  );
}
