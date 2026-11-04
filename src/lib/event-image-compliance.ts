import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import { readImageDimensions } from "@/lib/image-dimensions";
import { findEffectiveTemplateRow, resolveEventTemplateId } from "@/lib/badge-templates/event-template-variables";
import { readLayout } from "@/lib/badge-templates/resolve";
import type { Bindings } from "@/lib/badge-templates/bindings";
import {
  ID_PHOTO_REQUIREMENT,
  checkAgainst,
  frameForSource,
  requirementFromFrame,
  type ImageRequirement,
} from "@/lib/badge-templates/image-frames";

export type ImageSlot = "logo" | "banner";

export const SLOT_SOURCE: Record<ImageSlot, string> = {
  logo: "event.logoDataUrl",
  banner: "event.bannerDataUrl",
};

export const SLOT_LABEL: Record<ImageSlot, string> = { logo: "logo", banner: "bannière" };

const SLOTS: ImageSlot[] = ["logo", "banner"];

export const EVENT_IMAGE_SELECT = {
  id: true,
  orgId: true,
  badgeTemplateId: true,
  logo: true,
  banner: true,
  logoWidth: true,
  logoHeight: true,
  bannerWidth: true,
  bannerHeight: true,
} satisfies Prisma.EventSelect;

export type EventImageSource = Prisma.EventGetPayload<{ select: typeof EVENT_IMAGE_SELECT }>;

// Exigences d'image du template effectif. Aucun template = aucune contrainte. Une erreur de lecture
// (base, manifeste invalide) est relancee, pour qu'un controle bloquant n'echoue jamais en silence ;
// `lenient` (affichage seulement) la journalise et ne contraint rien.
export async function getEventImageRequirements(
  event: { badgeTemplateId: string | null; orgId: string },
  opts: { lenient?: boolean } = {},
): Promise<Partial<Record<ImageSlot, ImageRequirement>>> {
  try {
    const row = await findEffectiveTemplateRow(await resolveEventTemplateId(event));
    if (!row) {
      console.warn("[event-images] aucun template effectif : aucune contrainte d'image");
      return {};
    }
    const manifest = readLayout(row);
    const bindings: Bindings =
      row.bindings !== null && typeof row.bindings === "object" && !Array.isArray(row.bindings)
        ? (row.bindings as Bindings)
        : {};
    const out: Partial<Record<ImageSlot, ImageRequirement>> = {};
    for (const slot of SLOTS) {
      const frame = frameForSource(manifest, manifest.variables, bindings, SLOT_SOURCE[slot]);
      if (frame) out[slot] = requirementFromFrame(frame);
    }
    return out;
  } catch (err) {
    if (!opts.lenient) throw err;
    console.warn("[event-images] lecture du template impossible : aucune contrainte d'image", err);
    return {};
  }
}

export type ImageIssue = {
  slot: ImageSlot;
  reason: "RATIO" | "RESOLUTION";
  message: string;
  expected: ImageRequirement;
  actual: { width: number; height: number };
};

type StoredDimensions = { width: number; height: number; format: "jpeg" | "png" | "webp" };

export async function readStoredDimensions(key: string): Promise<StoredDimensions | null> {
  try {
    const { body } = await getFile(key);
    return readImageDimensions(body);
  } catch {
    return null;
  }
}

// La conformite est calculee a la lecture (template effectif + dimensions memorisees),
// jamais stockee : changer de template change le verdict sans ecriture en base.
export async function evaluateEventImages(
  event: EventImageSource,
  opts: { lenient?: boolean } = {},
): Promise<ImageIssue[]> {
  const stored: Record<ImageSlot, { key: string | null; width: number | null; height: number | null }> = {
    logo: { key: event.logo, width: event.logoWidth, height: event.logoHeight },
    banner: { key: event.banner, width: event.bannerWidth, height: event.bannerHeight },
  };
  if (!stored.logo.key && !stored.banner.key) return [];

  const requirements = await getEventImageRequirements(event, opts);
  const issues: ImageIssue[] = [];
  for (const slot of SLOTS) {
    const expected = requirements[slot];
    const { key, width, height } = stored[slot];
    if (!expected || !key) continue;
    const actual = width && height ? { width, height } : await readStoredDimensions(key);
    if (!actual) {
      console.warn(`[event-images] ${slot} illisible (${key}) : ignore`);
      continue;
    }
    const check = checkAgainst(actual, expected);
    if (!check.ok) {
      issues.push({
        slot,
        reason: check.reason,
        message: check.message,
        expected,
        actual: { width: actual.width, height: actual.height },
      });
    }
  }
  return issues;
}

export type UploadVerdict =
  | { ok: true; width: number; height: number }
  | {
      ok: false;
      status: 400 | 415 | 422;
      code: "INVALID_IMAGE" | "UNSUPPORTED_FORMAT" | "IMAGE_RATIO" | "IMAGE_RESOLUTION";
      message: string;
    };

const FORMAT_BY_MIME: Record<string, StoredDimensions["format"]> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateImageBuffer(
  buf: Buffer,
  mime: string,
  req: ImageRequirement | null,
  opts: { engineFormatsOnly?: boolean } = {},
): UploadVerdict {
  const dims = readImageDimensions(buf);
  if (!dims) {
    return { ok: false, status: 400, code: "INVALID_IMAGE", message: "Le fichier n'est pas une image valide." };
  }
  if (FORMAT_BY_MIME[mime] !== dims.format) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_IMAGE",
      message: "Le contenu du fichier ne correspond pas à son type.",
    };
  }
  if (opts.engineFormatsOnly && dims.format === "webp") {
    return {
      ok: false,
      status: 415,
      code: "UNSUPPORTED_FORMAT",
      message: "Le format WebP n'est pas pris en charge pour cette image : utilisez JPEG ou PNG.",
    };
  }
  if (req) {
    const check = checkAgainst(dims, req);
    if (!check.ok) {
      return {
        ok: false,
        status: 422,
        code: check.reason === "RATIO" ? "IMAGE_RATIO" : "IMAGE_RESOLUTION",
        message: check.message,
      };
    }
  }
  return { ok: true, width: dims.width, height: dims.height };
}

/** Une cle fournie par le client doit appartenir a l'un des prefixes attendus (org, evenement, utilisateur). */
export function keyHasPrefix(key: string, prefixes: readonly string[]): boolean {
  return !key.includes("..") && prefixes.some((prefix) => key.startsWith(prefix));
}

const KEY_REJECTED: UploadVerdict = { ok: false, status: 400, code: "INVALID_IMAGE", message: "Image introuvable." };

export async function validateStoredImage(
  key: string,
  req: ImageRequirement | null,
  opts: { engineFormatsOnly?: boolean; allowedPrefixes: readonly string[] },
): Promise<UploadVerdict> {
  // Meme reponse qu'un fichier absent : aucun oracle d'existence sur les fichiers d'autrui.
  if (!keyHasPrefix(key, opts.allowedPrefixes)) return KEY_REJECTED;
  let body: Buffer;
  try {
    ({ body } = await getFile(key));
  } catch {
    return { ok: false, status: 400, code: "INVALID_IMAGE", message: "Image introuvable." };
  }
  const dims = readImageDimensions(body);
  return validateImageBuffer(body, dims ? `image/${dims.format}` : "application/octet-stream", req, opts);
}

export class EventImagesNoncompliantError extends Error {
  readonly code = "EVENT_IMAGES_NONCOMPLIANT";
  readonly httpStatus = 422;
  constructor(readonly issues: ImageIssue[]) {
    super(
      `Images de l'évènement à recadrer : ${issues.map((i) => `${SLOT_LABEL[i.slot]} — ${i.message}`).join(" ; ")} ` +
        "Corrigez-les dans les paramètres de l'évènement avant de générer les badges.",
    );
    this.name = "EventImagesNoncompliantError";
  }
}

export async function assertEventImagesCompliant(event: EventImageSource): Promise<void> {
  const issues = await evaluateEventImages(event);
  if (issues.length > 0) throw new EventImagesNoncompliantError(issues);
}

export async function assertEventImagesCompliantById(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: EVENT_IMAGE_SELECT });
  if (event) await assertEventImagesCompliant(event);
}

export function eventImagesErrorResponse(err: EventImagesNoncompliantError): NextResponse {
  return NextResponse.json(
    { error: err.message, code: err.code, message: err.message, issues: err.issues },
    { status: err.httpStatus },
  );
}

type Rejection = Extract<UploadVerdict, { ok: false }>;

// Corps d'erreur commun a tous les points d'envoi d'image : { error, code, message }.
export function rejectionResponse(verdict: Rejection, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json(
    { error: verdict.message, code: verdict.code, message: verdict.message, ...extra },
    { status: verdict.status },
  );
}

// Photo d'identite (7:9, 210 x 270 px minimum) : null si conforme, sinon la reponse de rejet.
export function checkIdPhotoBuffer(buf: Buffer, mime: string): NextResponse | null {
  const verdict = validateImageBuffer(buf, mime, ID_PHOTO_REQUIREMENT);
  return verdict.ok ? null : rejectionResponse(verdict);
}

export async function checkIdPhotoKey(key: string, allowedPrefixes: readonly string[]): Promise<NextResponse | null> {
  const verdict = await validateStoredImage(key, ID_PHOTO_REQUIREMENT, { allowedPrefixes });
  return verdict.ok ? null : rejectionResponse(verdict);
}
