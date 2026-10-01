import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTemplate } from "./resolve";
import { resolveEventTemplateId } from "./event-template-variables";
import { buildTemplateContext } from "./build-context";
import { buildValues } from "./build-values";
import { optionVariables } from "./template-options";

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

// Rend le PDF d'un badge avec le template effectif (evenement -> organisation ->
// plateforme). Le controle d'appartenance et de statut reste a l'appelant.
export async function renderBadgePdf(
  registration: BadgeRegistration,
): Promise<{ pdf: Buffer; templateId: string }> {
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

  const Component = template.Component;
  const values = buildValues(templateCtx, template.variables, template.bindings);
  const pdf = await renderToBuffer(<Component values={values} />);
  return { pdf, templateId: template.meta.id };
}
