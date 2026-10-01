import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBadgeTemplateId } from "@/lib/settings";
import { resolveTemplate } from "./resolve";
import { buildTemplateContext } from "./build-context";
import { buildValues } from "./build-values";

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

// Lit le badgeTemplateId de PlatformSettings (singleton). En son absence, on rend une
// chaine vide : resolveTemplate la traitera comme un identifiant inconnu et retombera
// sur la famille `default` en le signalant.
async function getPlatformBadgeTemplateId(): Promise<{ badgeTemplateId: string }> {
  const platform = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { badgeTemplateId: true },
  });
  return platform ?? { badgeTemplateId: "" };
}

// Rend le PDF d'un badge avec le template effectif (evenement -> organisation ->
// plateforme). Le controle d'appartenance et de statut reste a l'appelant.
export async function renderBadgePdf(
  registration: BadgeRegistration,
): Promise<{ pdf: Buffer; templateId: string }> {
  const [organization, platform] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: registration.event.orgId },
      select: { badgeTemplateId: true },
    }),
    getPlatformBadgeTemplateId(),
  ]);
  const template = await resolveTemplate(
    resolveBadgeTemplateId({ badgeTemplateId: registration.event.badgeTemplateId }, organization, platform),
  );

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
    },
    category: registration.category,
  });

  const Component = template.Component;
  const values = buildValues(templateCtx, template.variables, template.bindings);
  const pdf = await renderToBuffer(<Component values={values} />);
  return { pdf, templateId: template.meta.id };
}
