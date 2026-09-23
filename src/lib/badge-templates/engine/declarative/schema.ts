import { z } from "zod";
import { DATE_FORMATS, VARIABLE_KINDS } from "./manifest-types";
import type { Block, TemplateManifest, VariableDeclaration } from "./manifest-types";
import { extractVariables } from "./text-template";
import { indexVariables, type VariableIndex } from "./variables";

const HEX = /^#[0-9a-fA-F]{6}$/;
// Grammaire d'un nom de variable. Les deux bornes que la regex n'exprime pas
// (nombre de segments, longueur) sont verifiees plus bas.
const VARIABLE_NAME = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;
const MAX_BLOCKS = 60;
const MAX_VARIABLES = 40;
const MAX_CONDITIONS = 40;
const MAX_SEGMENTS = 3;

const weightSchema = z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]);

const styleSchema = z.object({
  font: z.string().min(1).optional(),
  sizePx: z.number().positive().max(270),
  weight: weightSchema.optional(),
  align: z.enum(["left", "center", "right", "justify"]).optional(),
  color: z.string().min(1),
  overflow: z.enum(["shrink", "truncate", "clip"]),
  minSizePx: z.number().positive().max(270).optional(),
  transform: z.enum(["uppercase", "lowercase", "none"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().positive().optional(),
  fontStyle: z.literal("italic").optional(),
  decoration: z.enum(["underline", "line-through"]).optional(),
  maxLines: z.number().int().min(1).optional(),
  backgroundColor: z.string().min(1).optional(),
  paddingPx: z.number().min(0).optional(),
});

const conditionSchema = z.union([
  z.object({ variable: z.string(), equals: z.boolean() }),
  z.object({ variable: z.string(), isEmpty: z.boolean() }),
]);

// Une reference ne porte QUE `use` : un objet melangeant use et variable serait
// ambigu, le strict() le refuse.
const conditionRefSchema = z.object({ use: z.string() }).strict();

const visibleIfEntrySchema = z.union([conditionSchema, conditionRefSchema]);

// Une condition seule, une reference, ou une conjonction des deux.
const visibleIfSchema = z.union([visibleIfEntrySchema, z.array(visibleIfEntrySchema).min(1)]);

// `when` n'accepte PAS de reference : pas de composition, donc pas de cycle.
const namedConditionSchema = z.object({
  name: z.string().regex(VARIABLE_NAME).max(60),
  when: z.union([conditionSchema, z.array(conditionSchema).min(1)]),
});

const borderSideSchema = z.object({
  widthPx: z.number().min(0),
  color: z.string().min(1),
  style: z.enum(["solid", "dashed", "dotted"]).optional(),
});

const cornerRadiiSchema = z.object({
  topLeft: z.number().min(0).optional(),
  topRight: z.number().min(0).optional(),
  bottomRight: z.number().min(0).optional(),
  bottomLeft: z.number().min(0).optional(),
});

const baseShape = {
  name: z.string().min(1).max(60).optional(),
  page: z.number().int().positive().optional(),
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().positive(),
  h: z.number().positive(),
  rotate: z.number().min(-360).max(360).optional(),
  opacity: z.number().min(0).max(1).optional(),
  radiusPx: z.union([z.number().min(0), cornerRadiiSchema]).optional(),
  border: borderSideSchema.optional(),
  borderTop: borderSideSchema.optional(),
  borderRight: borderSideSchema.optional(),
  borderBottom: borderSideSchema.optional(),
  borderLeft: borderSideSchema.optional(),
  visibleIf: visibleIfSchema.optional(),
};

// Fond d'une forme : couleur et/ou image (au moins l'un des deux, verifie plus bas).
const shapeShape = {
  fill: z.string().min(1).optional(),
  image: z
    .object({
      source: z.string().optional(),
      asset: z.string().optional(),
      fit: z.enum(["cover", "contain", "fill"]).optional(),
    })
    .optional(),
};

// `z.lazy` porte la recursion : un groupe contient des blocs, dont des groupes.
// Le type `qr` a disparu en v2 : un QR est une variable image posee dans une forme.
const blockSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string().min(1), style: styleSchema, ...baseShape }),
    z.object({ type: z.literal("rect"), ...shapeShape, ...baseShape }),
    z.object({ type: z.literal("square"), ...shapeShape, ...baseShape }),
    z.object({ type: z.literal("circle"), ...shapeShape, ...baseShape }),
    z.object({ type: z.literal("group"), blocks: z.array(blockSchema).min(1), ...baseShape }),
  ]),
);

const variableSchema = z.object({
  name: z.string().regex(VARIABLE_NAME).max(60),
  kind: z.enum(VARIABLE_KINDS),
  label: z.string().min(1).max(60),
  sample: z.union([z.string(), z.boolean()]).optional(),
  format: z.enum(DATE_FORMATS).optional(),
});

const presetSchema = z.object({
  label: z.string().min(1).max(60),
  values: z.record(z.string(), z.union([z.string(), z.boolean()])),
});

const manifestSchema = z.object({
  formatVersion: z.literal(2),
  family: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  label: z.string().min(1).max(120),
  description: z.string().max(1000),
  preview: z.string().min(1).optional(),
  page: z.object({
    widthPx: z.number().positive().max(4000),
    heightPx: z.number().positive().max(4000),
    count: z.number().int().positive().max(4),
  }),
  fonts: z
    .array(
      z.object({
        alias: z.string().min(1),
        file: z.string().min(1),
        weight: weightSchema.optional(),
        style: z.enum(["normal", "italic"]).optional(),
      }),
    )
    .optional(),
  variables: z.array(variableSchema).max(MAX_VARIABLES),
  conditions: z.array(namedConditionSchema).max(MAX_CONDITIONS).optional(),
  presets: z.array(presetSchema).optional(),
  blocks: z.array(blockSchema).min(1),
});

export type ParseResult =
  | { ok: true; manifest: TemplateManifest }
  | { ok: false; errors: string[] };

type ParsedManifest = z.infer<typeof manifestSchema>;

// Types de variables acceptes par chaque usage. C'est la table qui remplace
// l'ancienne liste blanche SOURCES : elle ne parle plus de noms, seulement de types.
const EXPECTED_KIND = {
  text: ["text", "date"],
  image: ["image"],
  color: ["color"],
} as const;

function checkVariableRef(
  name: string,
  usage: keyof typeof EXPECTED_KIND,
  label: string,
  index: VariableIndex,
  errors: string[],
): void {
  const declaration = index[name];
  if (!declaration) {
    errors.push(`${label} : variable non declaree "${name}".`);
    return;
  }
  if (!(EXPECTED_KIND[usage] as readonly string[]).includes(declaration.kind)) {
    errors.push(
      `${label} : la variable "${name}" est de type ${declaration.kind}, incompatible avec un usage ${usage}.`,
    );
  }
}

// Une couleur est soit un litteral hexadecimal, soit une variable de type couleur.
function checkColor(value: string, label: string, index: VariableIndex, errors: string[]): void {
  if (HEX.test(value)) return;
  const declaration = index[value];
  if (declaration?.kind === "color") return;
  errors.push(
    `${label} : "${value}" n'est ni une couleur hexadecimale ni une variable de type couleur.`,
  );
}

// Coherence d'un `sample` avec le type declare. Un sample d'image designe une
// ressource du paquet, verifiee comme l'est `preview`.
function checkVariableDeclaration(
  variable: VariableDeclaration,
  entries: string[],
  errors: string[],
): void {
  const label = `variable "${variable.name}"`;

  if (variable.name.split(".").length > MAX_SEGMENTS) {
    errors.push(`${label} : un nom porte trois segments au plus.`);
  }
  if (variable.format !== undefined && variable.kind !== "date") {
    errors.push(`${label} : "format" ne concerne que les variables de type date.`);
  }
  if (variable.sample === undefined) return;

  if (variable.kind === "boolean") {
    if (typeof variable.sample !== "boolean") {
      errors.push(`${label} : le sample d'une variable booleenne est un booleen.`);
    }
    return;
  }
  if (typeof variable.sample !== "string") {
    errors.push(`${label} : le sample d'une variable ${variable.kind} est une chaine.`);
    return;
  }
  if (variable.kind === "color" && !HEX.test(variable.sample)) {
    errors.push(`${label} : le sample d'une variable couleur est hexadecimal.`);
  }
  if (variable.kind === "date" && Number.isNaN(new Date(variable.sample).getTime())) {
    errors.push(`${label} : le sample d'une variable date est une date ISO.`);
  }
  if (variable.kind === "image" && !entries.includes(variable.sample)) {
    errors.push(`${label} : ressource "${variable.sample}" absente du paquet.`);
  }
}

function checkVariables(
  variables: VariableDeclaration[],
  entries: string[],
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const variable of variables) {
    if (seen.has(variable.name)) {
      errors.push(`variable "${variable.name}" : declaree deux fois.`);
    }
    seen.add(variable.name);
    checkVariableDeclaration(variable, entries, errors);
  }
}

// Les conditions nommees suivent les memes bornes que les variables : noms
// uniques, grammaire commune, trois segments au plus. Leur `when` se valide comme
// un visibleIf litteral.
function checkConditions(
  conditions: ParsedManifest["conditions"],
  index: VariableIndex,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const condition of conditions ?? []) {
    const label = `condition "${condition.name}"`;
    if (seen.has(condition.name)) errors.push(`${label} : declaree deux fois.`);
    seen.add(condition.name);
    if (condition.name.split(".").length > MAX_SEGMENTS) {
      errors.push(`${label} : un nom porte trois segments au plus.`);
    }
    const list = Array.isArray(condition.when) ? condition.when : [condition.when];
    for (const entry of list) checkConditionEntry(entry, label, index, errors);
  }
}

// Partage entre le visibleIf d'un bloc et le `when` d'une condition nommee : la
// meme regle doit s'appliquer aux deux, sans la recopier.
function checkConditionEntry(
  condition: { variable: string; equals?: boolean; isEmpty?: boolean },
  label: string,
  index: VariableIndex,
  errors: string[],
): void {
  const declaration = index[condition.variable];
  if (!declaration) {
    errors.push(`${label} : variable non declaree "${condition.variable}".`);
    return;
  }
  if ("equals" in condition && declaration.kind !== "boolean") {
    errors.push(
      `${label} : "equals" exige une variable booleenne, "${condition.variable}" est de type ${declaration.kind}.`,
    );
  }
}

function checkPresets(
  presets: ParsedManifest["presets"],
  index: VariableIndex,
  entries: string[],
  errors: string[],
): void {
  for (const preset of presets ?? []) {
    const label = `preset "${preset.label}"`;
    for (const [name, value] of Object.entries(preset.values)) {
      const declaration = index[name];
      if (!declaration) {
        errors.push(`${label} : variable non declaree "${name}".`);
        continue;
      }
      if (declaration.kind === "boolean" && typeof value !== "boolean") {
        errors.push(`${label} : "${name}" est booleenne, sa valeur doit l'etre aussi.`);
        continue;
      }
      if (declaration.kind !== "boolean" && typeof value !== "string") {
        errors.push(`${label} : "${name}" attend une valeur de type chaine.`);
        continue;
      }
      // Une valeur d'image designe une ressource du paquet, ou le vide.
      if (declaration.kind === "image" && value !== "" && !entries.includes(String(value))) {
        errors.push(`${label} : ressource "${value}" absente du paquet.`);
      }
    }
  }
}

function checkTextBlock(
  block: Extract<Block, { type: "text" }>,
  label: string,
  manifest: ParsedManifest,
  index: VariableIndex,
  errors: string[],
): void {
  const names = extractVariables(block.text);
  if (names.length === 0 && !block.text.trim()) {
    errors.push(`${label} : le gabarit de texte est vide.`);
  }
  for (const name of names) checkVariableRef(name, "text", label, index, errors);
  checkColor(block.style.color, `${label} (couleur)`, index, errors);
  if (block.style.backgroundColor !== undefined) {
    checkColor(block.style.backgroundColor, `${label} (fond du texte)`, index, errors);
  }
  if (block.style.overflow === "shrink" && block.style.minSizePx === undefined) {
    errors.push(`${label} : overflow "shrink" exige un minSizePx.`);
  }
  if (block.style.minSizePx !== undefined && block.style.minSizePx > block.style.sizePx) {
    errors.push(`${label} : minSizePx superieur a sizePx.`);
  }
  if (block.style.font && !(manifest.fonts ?? []).some((f) => f.alias === block.style.font)) {
    errors.push(`${label} : police "${block.style.font}" non declaree.`);
  }
}

function checkShapeBlock(
  block: Extract<Block, { type: "rect" | "square" | "circle" }>,
  label: string,
  index: VariableIndex,
  entries: string[],
  errors: string[],
): void {
  if (block.fill === undefined && block.image === undefined) {
    errors.push(`${label} : une forme exige un fond (fill et/ou image).`);
  }
  if (block.fill !== undefined) checkColor(block.fill, `${label} (remplissage)`, index, errors);
  if (!block.image) return;

  const hasSource = block.image.source !== undefined;
  const hasAsset = block.image.asset !== undefined;
  if (hasSource === hasAsset) {
    errors.push(`${label} : un fond image porte soit source, soit asset, jamais les deux ni aucun.`);
    return;
  }
  if (hasSource) checkVariableRef(block.image.source!, "image", label, index, errors);
  if (hasAsset && !entries.includes(block.image.asset!)) {
    errors.push(`${label} : ressource "${block.image.asset}" absente du paquet.`);
  }
}

function checkBlock(
  block: Block,
  label: string,
  manifest: ParsedManifest,
  index: VariableIndex,
  entries: string[],
  declaredConditions: Set<string>,
  errors: string[],
): void {
  const { page } = manifest;

  // Un bloc qui depasse la page n'est PAS une erreur : le fond perdu est un cas
  // print legitime, et le depassement se juge a l'oeil dans l'apercu du studio.
  if (block.page !== undefined && block.page > page.count) {
    errors.push(`${label} : page ${block.page} alors que le manifeste en declare ${page.count}.`);
  }
  for (const side of ["border", "borderTop", "borderRight", "borderBottom", "borderLeft"] as const) {
    const declared = block[side];
    if (declared) checkColor(declared.color, `${label} (bordure)`, index, errors);
  }
  if (block.visibleIf) {
    const entries = Array.isArray(block.visibleIf) ? block.visibleIf : [block.visibleIf];
    for (const entry of entries) {
      if ("use" in entry) {
        if (!declaredConditions.has(entry.use)) {
          errors.push(`${label} : condition non declaree "${entry.use}".`);
        }
        continue;
      }
      checkConditionEntry(entry, label, index, errors);
    }
  }

  if (block.type === "square" && block.w !== block.h) {
    errors.push(`${label} : un carre exige w = h (${block.w}×${block.h} recus).`);
  }
  if (block.type === "circle" && block.radiusPx !== undefined) {
    errors.push(`${label} : un cercle a un rayon implicite, radiusPx n'y est pas admis.`);
  }

  if (block.type === "text") checkTextBlock(block, label, manifest, index, errors);
  if (block.type === "rect" || block.type === "square" || block.type === "circle") {
    checkShapeBlock(block, label, index, entries, errors);
  }
}

function countBlocks(blocks: Block[]): number {
  return blocks.reduce(
    (total, block) => total + 1 + (block.type === "group" ? countBlocks(block.blocks) : 0),
    0,
  );
}

// Descente recursive : chaque bloc porte un label localise (« bloc 3 › 2 ») pour
// qu'une erreur enfouie dans un groupe reste reperable.
function walkBlocks(
  blocks: Block[],
  parentLabel: string | null,
  isRoot: boolean,
  manifest: ParsedManifest,
  index: VariableIndex,
  entries: string[],
  declaredConditions: Set<string>,
  errors: string[],
): void {
  blocks.forEach((block, position) => {
    const label = parentLabel ? `${parentLabel} › ${position + 1}` : `bloc ${position + 1}`;
    if (isRoot && block.page === undefined) {
      errors.push(`${label} : page manquante a la racine.`);
    }
    if (!isRoot && block.page !== undefined) {
      errors.push(`${label} : page interdite dans un groupe.`);
    }
    checkBlock(block, label, manifest, index, entries, declaredConditions, errors);
    if (block.type === "group") {
      walkBlocks(block.blocks, label, false, manifest, index, entries, declaredConditions, errors);
    }
  });
}

// `entries` est la liste des chemins presents dans le paquet. Elle permet de verifier
// qu'une ressource, une police ou un sample d'image reference existe reellement.
export function parseManifest(input: unknown, entries: string[]): ParseResult {
  // Message dedie plutot que le sec « expected 2 » de zod : un manifeste v1 se
  // migre, il n'est pas malforme.
  if ((input as { formatVersion?: unknown })?.formatVersion === 1) {
    return {
      ok: false,
      errors: [
        'manifeste : formatVersion 1 n\'est plus supporte, migrez avec "make migrate-template NAME=<famille>".',
      ],
    };
  }

  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "manifeste"} : ${i.message}`),
    };
  }

  const errors: string[] = [];
  const variables = parsed.data.variables as VariableDeclaration[];
  checkVariables(variables, entries, errors);

  const index = indexVariables(variables);
  checkPresets(parsed.data.presets, index, entries, errors);

  const declaredConditions = new Set((parsed.data.conditions ?? []).map((c) => c.name));
  checkConditions(parsed.data.conditions, index, errors);

  for (const font of parsed.data.fonts ?? []) {
    if (!entries.includes(font.file)) {
      errors.push(`police "${font.alias}" : fichier "${font.file}" absent du paquet.`);
    }
  }
  if (parsed.data.preview && !entries.includes(parsed.data.preview)) {
    errors.push(`apercu : fichier "${parsed.data.preview}" absent du paquet.`);
  }

  const rootBlocks = parsed.data.blocks as Block[];
  if (countBlocks(rootBlocks) > MAX_BLOCKS) {
    errors.push(`manifeste : plus de ${MAX_BLOCKS} blocs (groupes et enfants compris).`);
  }
  walkBlocks(rootBlocks, null, true, parsed.data, index, entries, declaredConditions, errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: parsed.data as TemplateManifest };
}
