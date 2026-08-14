import { createElement, isValidElement, type ComponentType, type ReactNode } from "react";
import type { TemplateContext } from "../../../types";

// Les primitives @react-pdf sont de simples chaines ("DOCUMENT", "PAGE", "VIEW",
// "TEXT", "IMAGE") : l'arbre React se parcourt donc sans rendu ni dependance. C'est
// cet arbre dont le PDF derive de facon deterministe — le comparer est plus stable
// que comparer des octets de PDF (horodatage, identifiants internes).
export type Collected = {
  texts: string[];
  images: string[];
  fills: string[];
  fontSizes: number[];
  // Traits TYPOGRAPHIQUES : casse, graisse, couleur, interlettrage, interligne.
  // Volontairement sans le placement (position, alignement) : un layout flexbox et un
  // layout absolu atteignent le meme resultat visuel par des moyens differents, donc
  // comparer leurs coordonnees n'aurait aucun sens. Le placement se verifie a l'oeil.
  textStyles: Array<Record<string, unknown>>;
  // Chaines de transformation CSS rencontrees sur n'importe quel noeud (rotation).
  transforms: string[];
  // Opacites rencontrees sur n'importe quel noeud.
  opacities: number[];
  // Largeurs de bordure (tous cotes confondus) rencontrees sur n'importe quel noeud.
  borderWidths: number[];
  // Rayons d'arrondi par noeud : cles borderRadius / borderTopLeftRadius / ...
  radii: Array<Record<string, number>>;
  pageCount: number;
};

type Style = Record<string, unknown>;

function flattenStyle(style: unknown): Style {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  return (style ?? {}) as Style;
}

function textOf(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (isValidElement(children)) {
    return textOf((children.props as { children?: ReactNode }).children);
  }
  return "";
}

function walk(node: ReactNode, out: Collected): void {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, out));
    return;
  }
  if (!isValidElement(node)) return;

  // Un composant fonction n'expose pas son arbre : il faut l'appeler pour l'obtenir.
  // Les primitives @react-pdf, elles, ont un type de chaine et se parcourent tel quel.
  if (typeof node.type === "function") {
    const render = node.type as (props: unknown) => ReactNode;
    walk(render(node.props), out);
    return;
  }

  const props = node.props as { children?: ReactNode; style?: unknown; src?: string };
  const style = flattenStyle(props.style);

  if (node.type === "PAGE") out.pageCount += 1;

  if (node.type === "TEXT") {
    out.texts.push(textOf(props.children));
    if (typeof style.fontSize === "number") out.fontSizes.push(style.fontSize);
    out.textStyles.push({
      color: style.color,
      fontWeight: style.fontWeight,
      textTransform: style.textTransform,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
    });
  }

  if (node.type === "IMAGE" && typeof props.src === "string") {
    out.images.push(props.src);
  }

  if (typeof style.backgroundColor === "string") out.fills.push(style.backgroundColor);
  if (typeof style.transform === "string") out.transforms.push(style.transform);
  if (typeof style.opacity === "number") out.opacities.push(style.opacity);
  for (const side of ["Top", "Right", "Bottom", "Left"]) {
    const width = style[`border${side}Width`];
    if (typeof width === "number") out.borderWidths.push(width);
  }

  const radii: Record<string, number> = {};
  for (const [key, value] of Object.entries(style)) {
    if (key.startsWith("border") && key.endsWith("Radius") && typeof value === "number") {
      radii[key] = value;
    }
  }
  if (Object.keys(radii).length > 0) out.radii.push(radii);

  walk(props.children ?? null, out);
}

export function renderToJson(
  Component: ComponentType<{ ctx: TemplateContext }>,
  ctx: TemplateContext,
): Collected {
  const out: Collected = {
    texts: [],
    images: [],
    fills: [],
    fontSizes: [],
    textStyles: [],
    transforms: [],
    opacities: [],
    borderWidths: [],
    radii: [],
    pageCount: 0,
  };
  walk(createElement(Component, { ctx }), out);
  return out;
}
