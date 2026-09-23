import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { px } from "../px";
import type { Block, TemplateManifest, TextBlock, TextStyle, VariableValues } from "./manifest-types";
import { indexVariables, resolveVariable, type VariableIndex } from "./variables";
import { indexConditions, isBlockVisible, type ConditionIndex } from "./conditions";
import { renderTextTemplate } from "./text-template";
import { registerTemplateFonts, DEFAULT_FONT_FAMILY, type AssetResolver } from "./fonts";
import "../fonts";

const HEX = /^#[0-9a-fA-F]{6}$/;

// Une couleur est soit litterale, soit une variable de type couleur.
function colorOf(value: string, index: VariableIndex, values: VariableValues): string {
  return HEX.test(value) ? value : String(resolveVariable(index, values, value));
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
function borderStyles(block: Block, index: VariableIndex, values: VariableValues) {
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
    out[`border${side}Color`] = colorOf(declared.color, index, values);
    out[`border${side}Style`] = declared.style ?? "solid";
  }
  return out;
}

function renderText(
  block: TextBlock,
  index: VariableIndex,
  values: VariableValues,
  fontMap: Record<string, string>,
  key: string,
) {
  const raw = renderTextTemplate(block.text, index, values);
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
        ...borderStyles(block, index, values),
        ...radiusStyles(block),
        backgroundColor: block.style.backgroundColor
          ? colorOf(block.style.backgroundColor, index, values)
          : undefined,
        padding: block.style.paddingPx !== undefined ? px(block.style.paddingPx) : undefined,
      }}
    >
      <Text
        style={{
          fontFamily: block.style.font ? fontMap[block.style.font] : DEFAULT_FONT_FAMILY,
          fontSize: px(sizePx),
          fontWeight: block.style.weight,
          textAlign: block.style.align,
          color: colorOf(block.style.color, index, values),
          // La casse est confiee a @react-pdf plutot qu'appliquee a la chaine : c'est
          // ce que font les templates historiques, et le moteur gere la locale.
          textTransform: block.style.transform,
          letterSpacing:
            block.style.letterSpacing !== undefined ? px(block.style.letterSpacing) : undefined,
          lineHeight: block.style.lineHeight,
          fontStyle: block.style.fontStyle,
          textDecoration: block.style.decoration,
          // maxLines/textOverflow sont lus par @react-pdf dans le STYLE, pas en prop.
          maxLines: block.style.maxLines,
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
  index: VariableIndex,
  values: VariableValues,
  assets: AssetResolver,
  fontMap: Record<string, string>,
  key: string,
  conditionIndex: ConditionIndex,
) {
  if (block.type === "text") return renderText(block, index, values, fontMap, key);

  if (block.type === "group") {
    // Les enfants se positionnent dans le repere du conteneur : @react-pdf place
    // l'absolu relativement au parent, donc rien a recalculer ici.
    return (
      <View key={key} style={{ ...frame(block) }}>
        {block.blocks
          .filter((child) => isBlockVisible(index, values, child.visibleIf, conditionIndex))
          .map((child, i) =>
            renderBlock(child, index, values, assets, fontMap, `${key}-${i}`, conditionIndex),
          )}
      </View>
    );
  }

  if (block.type === "rect" || block.type === "square" || block.type === "circle") {
    // Le cercle porte un rayon implicite : la moitie de son plus petit cote.
    const radius =
      block.type === "circle"
        ? { borderRadius: px(Math.min(block.w, block.h) / 2) }
        : radiusStyles(block);
    // Le schema garantit qu'un fond image porte exactement un `source` ou un `asset`.
    const backgroundSrc = block.image
      ? block.image.asset !== undefined
        ? assets(block.image.asset)
        : String(resolveVariable(index, values, block.image.source!))
      : null;

    return (
      <View
        key={key}
        style={{
          ...frame(block),
          ...borderStyles(block, index, values),
          ...radius,
          backgroundColor: block.fill ? colorOf(block.fill, index, values) : undefined,
          // Le fond image est rogne par la forme : coins arrondis et cercles
          // decoupent l'image sans que celle-ci ait a les connaitre.
          overflow: "hidden",
        }}
      >
        {backgroundSrc ? (
          <Image
            src={backgroundSrc}
            style={{ width: "100%", height: "100%", objectFit: block.image!.fit ?? "cover" }}
          />
        ) : null}
      </View>
    );
  }

  /* v8 ignore next 2 -- les cinq types de blocs sont couverts ci-dessus ; ce
     retour satisfait le compilateur sans jamais s'executer. */
  return null;
}

export function DeclarativeDocument({
  manifest,
  assets,
  templateId,
  values,
}: {
  manifest: TemplateManifest;
  assets: AssetResolver;
  templateId: string;
  values: VariableValues;
}) {
  const fontMap = registerTemplateFonts(templateId, manifest.fonts, assets);
  const index = indexVariables(manifest.variables);
  const conditionIndex = indexConditions(manifest.conditions);
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
              .map((block, position) => ({ block, position }))
              .filter(
                ({ block }) =>
                  block.page === pageNumber &&
                  isBlockVisible(index, values, block.visibleIf, conditionIndex),
              )
              .map(({ block, position }) =>
                renderBlock(block, index, values, assets, fontMap, `b-${position}`, conditionIndex),
              )}
          </View>
        </Page>
      ))}
    </Document>
  );
}
