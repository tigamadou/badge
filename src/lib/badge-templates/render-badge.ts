import { renderHtml, type HtmlDocument } from "@tigamadou/pdf-engine/html";
import { montserratFaces } from "@tigamadou/pdf-engine/fonts";
import { RENDERER_MAX_BODY_BYTES } from "@tigamadou/pdf-engine/export";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTemplate } from "./resolve";
import { resolveEventTemplateId } from "./event-template-variables";
import { buildTemplateContext } from "./build-context";
import { buildValues } from "./build-values";
import { optionVariables } from "./template-options";
import { NextResponse } from "next/server";
import { getExporter, isRendererUnavailable, rendererUnavailableResponse } from "@/lib/renderer";

// Relations necessaires au rendu d'un badge (contexte du template, controle
// d'appartenance a l'evenement, statut, nommage du fichier).
export const badgeRegistrationInclude = {
  event: {
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      logo: true,
      securityInstructions: true,
      banner: true,
      templateOptions: true,
      badgeTemplateId: true,
      orgId: true,
    },
  },
  category: { select: { name: true, color: true, neutralBadge: true, anonymous: true } },
} satisfies Prisma.RegistrationInclude;

export type BadgeRegistration = Prisma.RegistrationGetPayload<{
  include: typeof badgeRegistrationInclude;
}>;

export async function loadBadgeRegistration(id: string): Promise<BadgeRegistration | null> {
  return prisma.registration.findUnique({ where: { id }, include: badgeRegistrationInclude });
}

// Template effectif d'un evenement : evenement -> organisation -> plateforme.
export async function resolveEventTemplate(event: { badgeTemplateId: string | null; orgId: string }) {
  return resolveTemplate(await resolveEventTemplateId(event));
}

export class BadgeTooLargeError extends Error {}

// Marge de 64 Kio sous la limite du service pour l'enveloppe JSON.
export const MAX_DOCUMENT_BYTES = RENDERER_MAX_BODY_BYTES - 64 * 1024;

// Rend le document vivant d'un badge avec le template effectif (evenement ->
// organisation -> plateforme). Pur, sans appel au service. Le controle
// d'appartenance et de statut reste a l'appelant.
export async function renderBadgeDocument(
  registration: BadgeRegistration,
): Promise<{ document: HtmlDocument; templateId: string }> {
  const template = await resolveEventTemplate(registration.event);

  const templateCtx = await buildTemplateContext({
    id: registration.id,
    snapshotFirstName: registration.snapshotFirstName,
    snapshotLastName: registration.snapshotLastName,
    snapshotStructure: registration.snapshotStructure,
    snapshotPhoto: registration.snapshotPhoto,
    allAccessGranted: registration.allAccessGranted,
    event: {
      title: registration.event.title,
      date: registration.event.date,
      location: registration.event.location,
      logo: registration.event.logo,
      securityInstructions: registration.event.securityInstructions,
      banner: registration.event.banner,
      templateOptions: registration.event.templateOptions,
    },
    category: registration.category,
  }, {
    optionImages: optionVariables(template.variables, template.bindings)
      .filter((v) => v.kind === "image")
      .map((v) => v.name),
  });

  const values = buildValues(templateCtx, template.variables, template.bindings);
  const document = renderHtml(template.manifest, {
    values,
    assets: template.assets,
    defaultFont: montserratFaces(),
  });

  const size = Buffer.byteLength(JSON.stringify({ document }));
  if (size > MAX_DOCUMENT_BYTES) {
    const mo = (size / 1024 / 1024).toFixed(1);
    const limite = Math.round(RENDERER_MAX_BODY_BYTES / 1024 / 1024);
    throw new BadgeTooLargeError(
      `document du badge trop volumineux (${mo} Mo, limite ${limite} Mo) : réduire la photo, le logo ou la bannière`,
    );
  }
  return { document, templateId: template.meta.id };
}

// Document fige, affichable par <page-view> : jamais de document vivant cote navigateur.
export async function renderBadgeHtml(
  registration: BadgeRegistration,
): Promise<{ document: HtmlDocument; templateId: string }> {
  const { document, templateId } = await renderBadgeDocument(registration);
  return { document: await getExporter().freeze(document), templateId };
}

export async function renderBadgePdf(
  registration: BadgeRegistration,
): Promise<{ pdf: Uint8Array; templateId: string }> {
  const { document, templateId } = await renderBadgeDocument(registration);
  return { pdf: await getExporter().pdf(document), templateId };
}

// Rendu en echec dans un lot : garde l'inscription fautive pour la reponse.
export class BadgeRenderError extends Error {
  constructor(
    readonly registrationId: string,
    readonly original: unknown,
  ) {
    super(`rendu en echec pour ${registrationId}`);
  }
}

// Reponse commune des routes de rendu : 503 si le service manque ou tarde, sinon 500.
// Le message n'est expose que pour un badge trop lourd, qui se corrige cote contenu.
export function badgeRenderFailure(err: unknown, registrationId: string, route: string): NextResponse {
  console.error(`[${route}] rendu en echec pour ${registrationId}`, err);
  if (isRendererUnavailable(err)) return rendererUnavailableResponse();
  const body =
    err instanceof BadgeTooLargeError
      ? { error: "RENDER_FAILED", id: registrationId, message: err.message }
      : { error: "RENDER_FAILED", id: registrationId };
  return NextResponse.json(body, { status: 500 });
}
