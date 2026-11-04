import type { Block, TemplateManifest } from "@tigamadou/pdf-engine";
import { ID_PHOTO_RATIO, ratioMatches } from "@/lib/image-dimensions";
import type { Bindings } from "./bindings";

// Module pur : importe aussi par les composants client (ImageCropper).

export type ImageFrame = { width: number; height: number };

// Cadres des blocs dont l'image vient de l'une des variables, en ordre de document
// (groupes parcourus en profondeur).
function collectFrames(blocks: Block[], names: ReadonlySet<string>): ImageFrame[] {
  return blocks.flatMap((block): ImageFrame[] => {
    if (block.type === "group") return collectFrames(block.blocks, names);
    if (block.type === "text" || block.type === "list") return [];
    if ("image" in block && block.image?.source && names.has(block.image.source)) {
      return [{ width: block.w, height: block.h }];
    }
    return [];
  });
}

export function findImageFrames(blocks: Block[], variable: string): ImageFrame[] {
  return collectFrames(blocks, new Set([variable]));
}

// Cadre du premier bloc dont l'image est une variable liee a `source`.
export function frameForSource(
  manifest: Pick<TemplateManifest, "blocks">,
  variables: { name: string }[],
  bindings: Bindings,
  source: string,
): ImageFrame | null {
  const names = new Set(
    variables.filter((v) => Object.hasOwn(bindings, v.name) && bindings[v.name] === source).map((v) => v.name),
  );
  return collectFrames(manifest.blocks, names)[0] ?? null;
}

export type ImageRequirement = {
  ratio: { width: number; height: number };
  ratioLabel: string;
  minWidth: number;
  minHeight: number;
  exampleWidth: number;
  exampleHeight: number;
};

const MAX_DENOMINATOR = 20;
const RATIO_TOLERANCE = 0.02;

// Plus petit denominateur <= 20 dont l'ecart relatif au ratio reel est <= 2 %.
export function simplifyRatio(width: number, height: number): [number, number] {
  const target = width / height;
  for (let d = 1; d <= MAX_DENOMINATOR; d++) {
    const n = Math.round(target * d);
    if (n >= 1 && Math.abs(n / d - target) / target <= RATIO_TOLERANCE) return [n, d];
  }
  return [Math.round(width), Math.round(height)];
}

export function requirementFromFrame(frame: ImageFrame): ImageRequirement {
  const [rw, rh] = simplifyRatio(frame.width, frame.height);
  const minWidth = Math.ceil(frame.width * 2);
  const minHeight = Math.ceil(frame.height * 2);
  return {
    ratio: { width: rw, height: rh },
    ratioLabel: `${rw}:${rh}`,
    minWidth,
    minHeight,
    exampleWidth: minWidth,
    exampleHeight: minHeight,
  };
}

export const ID_PHOTO_MIN = { width: 210, height: 270 };

export const ID_PHOTO_REQUIREMENT: ImageRequirement = {
  ratio: { ...ID_PHOTO_RATIO },
  ratioLabel: `${ID_PHOTO_RATIO.width}:${ID_PHOTO_RATIO.height}`,
  minWidth: ID_PHOTO_MIN.width,
  minHeight: ID_PHOTO_MIN.height,
  exampleWidth: ID_PHOTO_MIN.width,
  exampleHeight: ID_PHOTO_MIN.height,
};

export type ImageCheck = { ok: true } | { ok: false; reason: "RATIO" | "RESOLUTION"; message: string };

export function checkAgainst(dims: { width: number; height: number }, req: ImageRequirement): ImageCheck {
  if (!ratioMatches(dims.width, dims.height, req.ratio.width, req.ratio.height)) {
    return {
      ok: false,
      reason: "RATIO",
      message: `Ratio attendu ${req.ratioLabel}, par ex. ${req.exampleWidth} × ${req.exampleHeight} px.`,
    };
  }
  if (dims.width < req.minWidth || dims.height < req.minHeight) {
    return {
      ok: false,
      reason: "RESOLUTION",
      message: `Image trop petite : ${req.minWidth} × ${req.minHeight} px minimum (reçue : ${dims.width} × ${dims.height} px).`,
    };
  }
  return { ok: true };
}

// Taille de sortie d'un recadrage : entre 1x et 3x la resolution minimale, au ratio exact.
export function computeCropOutput(
  area: { width: number; height: number },
  req: ImageRequirement,
): { width: number; height: number } {
  const width = Math.round(Math.min(Math.max(area.width, req.minWidth), 3 * req.minWidth));
  return { width, height: Math.round((width * req.ratio.height) / req.ratio.width) };
}
