import { z } from "zod";
import type { Block, TemplateManifest } from "./manifest-types";
import { CONDITION_PATHS, SOURCES, type SourceKind } from "./sources";
import { extractPaths } from "./text-template";

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_BLOCKS = 60;

const weightSchema = z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]);

const styleSchema = z.object({
  font: z.string().min(1).optional(),
  sizePt: z.number().positive().max(200),
  weight: weightSchema.optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  color: z.string().min(1),
  overflow: z.enum(["shrink", "truncate", "clip"]),
  minSizePt: z.number().positive().max(200).optional(),
  transform: z.enum(["uppercase", "lowercase", "none"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().positive().optional(),
});

const conditionSchema = z.union([
  z.object({ path: z.string(), equals: z.boolean() }),
  z.object({ path: z.string(), isEmpty: z.boolean() }),
]);

// Une condition seule, ou une conjonction.
const visibleIfSchema = z.union([conditionSchema, z.array(conditionSchema).min(1)]);

const baseShape = {
  page: z.number().int().positive(),
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().positive(),
  h: z.number().positive(),
  visibleIf: visibleIfSchema.optional(),
};

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1), style: styleSchema, ...baseShape }),
  z.object({
    type: z.literal("image"),
    source: z.string().optional(),
    asset: z.string().optional(),
    radiusMm: z.number().min(0).optional(),
    ...baseShape,
  }),
  z.object({ type: z.literal("qr"), ...baseShape }),
  z.object({
    type: z.literal("rect"),
    fill: z.string(),
    radiusMm: z.number().min(0).optional(),
    borderTopPt: z.number().min(0).optional(),
    borderColor: z.string().optional(),
    ...baseShape,
  }),
]);

const manifestSchema = z.object({
  formatVersion: z.literal(1),
  family: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  label: z.string().min(1).max(120),
  description: z.string().max(1000),
  preview: z.string().min(1).optional(),
  page: z.object({
    widthMm: z.number().positive().max(1000),
    heightMm: z.number().positive().max(1000),
    count: z.number().int().positive().max(4),
  }),
  fonts: z
    .array(z.object({ alias: z.string().min(1), file: z.string().min(1), weight: weightSchema.optional() }))
    .optional(),
  blocks: z.array(blockSchema).min(1).max(MAX_BLOCKS),
});

export type ParseResult =
  | { ok: true; manifest: TemplateManifest }
  | { ok: false; errors: string[] };

// Un bloc `text` consomme du texte ou une date ; un bloc `image` consomme une image.
const EXPECTED_KIND: Record<"text" | "image", SourceKind[]> = {
  text: ["text", "date"],
  image: ["image"],
};

function checkColor(value: string, label: string, errors: string[]): void {
  if (HEX.test(value)) return;
  if (SOURCES[value] === "color") return;
  errors.push(`${label} : "${value}" n'est ni une couleur hexadecimale ni une source de couleur.`);
}

function checkSource(value: string, kind: "text" | "image", label: string, errors: string[]): void {
  const actual = SOURCES[value];
  if (!actual) {
    errors.push(`${label} : source inconnue "${value}".`);
    return;
  }
  if (!EXPECTED_KIND[kind].includes(actual)) {
    errors.push(
      `${label} : la source "${value}" est de type ${actual}, incompatible avec un bloc ${kind}.`,
    );
  }
}

type ParsedManifest = z.infer<typeof manifestSchema>;

function checkTextBlock(
  block: Extract<Block, { type: "text" }>,
  label: string,
  manifest: ParsedManifest,
  errors: string[],
): void {
  const paths = extractPaths(block.text);
  if (paths.length === 0 && !block.text.trim()) {
    errors.push(`${label} : le gabarit de texte est vide.`);
  }
  for (const path of paths) checkSource(path, "text", label, errors);
  checkColor(block.style.color, `${label} (couleur)`, errors);
  if (block.style.overflow === "shrink" && block.style.minSizePt === undefined) {
    errors.push(`${label} : overflow "shrink" exige un minSizePt.`);
  }
  if (block.style.minSizePt !== undefined && block.style.minSizePt > block.style.sizePt) {
    errors.push(`${label} : minSizePt superieur a sizePt.`);
  }
  if (block.style.font && !(manifest.fonts ?? []).some((f) => f.alias === block.style.font)) {
    errors.push(`${label} : police "${block.style.font}" non declaree.`);
  }
}

function checkImageBlock(
  block: Extract<Block, { type: "image" }>,
  label: string,
  entries: string[],
  errors: string[],
): void {
  const hasSource = block.source !== undefined;
  const hasAsset = block.asset !== undefined;
  if (hasSource === hasAsset) {
    errors.push(`${label} : un bloc image porte soit source, soit asset, jamais les deux ni aucun.`);
    return;
  }
  if (hasSource) checkSource(block.source!, "image", label, errors);
  if (hasAsset && !entries.includes(block.asset!)) {
    errors.push(`${label} : ressource "${block.asset}" absente du paquet.`);
  }
}

function checkBlock(
  block: Block,
  index: number,
  manifest: ParsedManifest,
  entries: string[],
  errors: string[],
): void {
  const label = `bloc ${index + 1}`;
  const { page } = manifest;

  if (block.x + block.w > page.widthMm || block.y + block.h > page.heightMm) {
    errors.push(`${label} : hors de la page.`);
  }
  if (block.page > page.count) {
    errors.push(`${label} : page ${block.page} alors que le manifeste en declare ${page.count}.`);
  }
  if (block.visibleIf) {
    const conditions = Array.isArray(block.visibleIf) ? block.visibleIf : [block.visibleIf];
    for (const condition of conditions) {
      // `equals` compare un booleen : seuls les deux chemins metier sont admis.
      // `isEmpty` teste une absence : tout chemin de la liste blanche convient.
      const allowed =
        "equals" in condition
          ? CONDITION_PATHS.includes(condition.path as never)
          : Boolean(SOURCES[condition.path]);
      if (!allowed) {
        errors.push(
          `${label} : visibleIf porte sur "${condition.path}", non autorise sous cette forme.`,
        );
      }
    }
  }

  if (block.type === "text") checkTextBlock(block, label, manifest, errors);
  if (block.type === "image") checkImageBlock(block, label, entries, errors);
  if (block.type === "rect") checkColor(block.fill, `${label} (remplissage)`, errors);
}

// `entries` est la liste des chemins presents dans le paquet. Elle permet de verifier
// qu'un asset ou une police reference existe reellement. Le lecteur d'archive la
// fournit ; les tests la passent en dur.
export function parseManifest(input: unknown, entries: string[]): ParseResult {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "manifeste"} : ${i.message}`),
    };
  }

  const errors: string[] = [];
  for (const font of parsed.data.fonts ?? []) {
    if (!entries.includes(font.file)) {
      errors.push(`police "${font.alias}" : fichier "${font.file}" absent du paquet.`);
    }
  }
  if (parsed.data.preview && !entries.includes(parsed.data.preview)) {
    errors.push(`apercu : fichier "${parsed.data.preview}" absent du paquet.`);
  }
  parsed.data.blocks.forEach((block, i) =>
    checkBlock(block as Block, i, parsed.data, entries, errors),
  );

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: parsed.data as TemplateManifest };
}
